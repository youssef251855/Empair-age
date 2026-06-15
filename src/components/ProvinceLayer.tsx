import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ProvinceState } from '../services/provinceService';

interface ProvinceLayerProps {
  mapInstance: L.Map | null;
  provinces: ProvinceState[];
  currentCountryId: string | null;
  currentAllianceId: string | null;
  geojsonData: any;
  onSelectProvince: (prov: ProvinceState) => void;
  selectedProvinceId: string | null;
  displayMode?: 'political' | 'alliances' | 'war' | 'resources';
  matchId: string | null;
}

export const ProvinceLayer: React.FC<ProvinceLayerProps> = ({
  mapInstance,
  provinces,
  currentCountryId,
  currentAllianceId,
  geojsonData,
  onSelectProvince,
  selectedProvinceId,
  displayMode = 'political',
  matchId
}) => {
  const layersRef = useRef<Record<string, L.Polygon>>({});
  const labelsRef = useRef<L.Marker[]>([]);

  // Helper to determine the aesthetic coloring based on selected display overlay
  const getProvinceColor = (prov: ProvinceState): string => {
    if (displayMode === 'resources') {
      const spec = prov.resourceSpecialty;
      if (spec === 'gold') return '#b45309';        // Rich amber/gold
      if (spec === 'oil') return '#115e59';         // Petroleum slate/teal
      if (spec === 'iron') return '#475569';        // Heavy metal gray
      if (spec === 'food') return '#15803d';         // Agricultural forest green
      if (spec === 'electricity') return '#0369a1';  // Power generator cobalt blue
      return '#334155';
    }

    if (displayMode === 'war') {
      const g = prov.garrison;
      const forces = (g.infantry || 0) + (g.specialForces || 0) + (g.tanks || 0) + (g.artillery || 0) + (g.jets || 0);
      // Controversial high conflict borders/depleted defense zones are represented here
      if (forces > 45) {
        return '#7f1d1d'; // Crimson bunker red (High militarization)
      }
      if (forces > 0 && forces < 15 && prov.ownerCountryId) {
        return '#991b1b'; // Bleeding conflict border
      }
      return '#0f172a'; // Peaceful silent night background
    }

    if (displayMode === 'alliances') {
      if (!prov.ownerCountryId) {
        return '#334155'; // Independent Neutral Gray
      }
      if (prov.ownerCountryId === currentCountryId) {
        return '#2563eb'; // Current Nation (Electric Blue)
      }
      // Ally (shares same color flag patterns or is same alliance)
      if (prov.color === '#10b981' || prov.color === 'green' || prov.color === '#16a34a') {
        return '#16a34a'; // Allies (Sleek Green)
      }
      return '#dc2626'; // Enemies (Military Crimson Red)
    }

    // Default Political Mode
    if (!prov.ownerCountryId) {
      return 'rgba(100, 116, 139, 0.08)'; // Translucent soft grey so the natural basemap shows underneath
    }
    return prov.color || '#4b5563';
  };

  const [zoomLevel, setZoomLevel] = useState<number>(3);

  useEffect(() => {
    if (!mapInstance) return;
    const updateZoom = () => setZoomLevel(mapInstance.getZoom());
    updateZoom();
    mapInstance.on('zoomend', updateZoom);
    return () => {
      mapInstance.off('zoomend', updateZoom);
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance || !geojsonData) return;

    // Clear existing layer instances
    Object.values(layersRef.current).forEach((layer) => {
      mapInstance.removeLayer(layer);
    });
    layersRef.current = {};

    // Clear existing labels
    labelsRef.current.forEach((marker) => {
      mapInstance.removeLayer(marker);
    });
    labelsRef.current = [];

    // Temporary storage to collect country centers
    const countryCenters: Record<string, { sumLat: number, sumLng: number, count: number }> = {};

    // For each feature in our subdivided GeoJSON, create a Leaflet Polygon
    geojsonData.features.forEach((feat: any) => {
      const geoJsonId = feat.properties.id;
      const geoPoly = feat.geometry;

      if (!geoPoly || geoJsonId === undefined || !matchId) return;
      const expectedDbId = `${matchId}_${geoJsonId}`;

      // Find modern Firestore status for this province
      const firestate = provinces.find((p) => p.id === expectedDbId);
      
      const pColor = firestate ? getProvinceColor(firestate) : 'rgba(100, 116, 139, 0.08)';
      const pName = firestate ? firestate.name : feat.properties.name;
      const pGarrisonCount = firestate 
        ? (firestate.garrison.infantry + firestate.garrison.specialForces + firestate.garrison.tanks + firestate.garrison.artillery + firestate.garrison.jets)
        : 0;
      const pOwnerName = firestate?.ownerCountryName;

      // Calculate center if missing
      let centerLat = feat.properties.centerLat;
      let centerLng = feat.properties.centerLng;
      
      if (centerLat === undefined || centerLng === undefined) {
        try {
          const tempLayer = L.geoJSON(feat);
          const bounds = tempLayer.getBounds();
          const center = bounds.getCenter();
          centerLat = center.lat;
          centerLng = center.lng;
        } catch(e) {
          // fallback
          centerLat = 0; centerLng = 0;
        }
      }

      // Collect data for country centroid aggregation if owned
      if (pOwnerName && centerLat && centerLng) {
        if (!countryCenters[pOwnerName]) countryCenters[pOwnerName] = { sumLat: 0, sumLng: 0, count: 0 };
        countryCenters[pOwnerName].sumLat += centerLat;
        countryCenters[pOwnerName].sumLng += centerLng;
        countryCenters[pOwnerName].count += 1;
      }

      // Set boundary option weight and styles
      const isSelected = selectedProvinceId === expectedDbId;
      
      let strokeColor = 'rgba(255, 255, 255, 0.4)';
      let strokeWidth = 0.6;
      let fillOpacityValue = 0.35;

      if (displayMode === 'political' && firestate?.ownerCountryId) {
        strokeColor = firestate.color || '#000000';
        strokeWidth = 1.2;
      }
      if (isSelected) {
        fillOpacityValue = 0.65;
      }

      const polygonOptions: L.PathOptions = {
        color: isSelected ? '#f59e0b' : strokeColor,
        weight: isSelected ? 3.0 : strokeWidth,
        fillColor: pColor,
        fillOpacity: fillOpacityValue,
        className: 'province-polygon'
      };

      const geoJsonLayer = L.geoJSON(feat, {
        style: polygonOptions
      }).addTo(mapInstance);

      // Create rich premium tactical HTML tooltip details
      const tooltipContent = `
        <div class="font-sans text-right dir-rtl">
          <p class="font-black text-[#f59e0b] text-xs border-b border-slate-700/80 pb-0.5 mb-1">${pName}</p>
          <p class="text-[10px] text-slate-300 font-bold">🎮 السيادة: <span class="text-amber-400">${pOwnerName}</span></p>
          <p class="text-[10px] text-slate-300">⚔️ طاقة الحشد: <span class="font-mono text-emerald-400 font-extrabold">${pGarrisonCount} كتيبة</span></p>
          ${firestate ? `
            <div class="grid grid-cols-2 gap-x-2 text-[9px] text-slate-400 mt-1 border-t border-slate-800/80 pt-1 leading-snug">
              <div>🌾 غذاء: <span class="text-emerald-400 font-bold">${firestate.food}/س</span></div>
              <div>🛢️ نفط: <span class="text-blue-400 font-bold">${firestate.oil}/س</span></div>
              <div>🪙 خزانة: <span class="text-amber-400 font-bold">${firestate.gold}/س</span></div>
              <div>⛓️ حديد: <span class="text-slate-300 font-bold">${firestate.iron}/س</span></div>
            </div>
          ` : ''}
        </div>
      `;

      geoJsonLayer.bindTooltip(tooltipContent, {
        sticky: true,
        direction: 'top',
        className: 'tactical-tooltip'
      });

      // Highlight on hover
      geoJsonLayer.on('mouseover', (e: any) => {
        const layer = e.layer || e.target;
        if (layer.setStyle) {
          layer.setStyle({
            fillOpacity: 0.75,
            weight: 2.2,
            color: '#f59e0b',
            dashArray: '3, 5'
          });
        }
      });

      geoJsonLayer.on('mouseout', (e: any) => {
        const layer = e.layer || e.target;
        if (layer.setStyle) {
          layer.setStyle({
            fillOpacity: selectedProvinceId === expectedDbId ? 0.65 : 0.35,
            weight: selectedProvinceId === expectedDbId ? 3.0 : strokeWidth,
            color: selectedProvinceId === expectedDbId ? '#f59e0b' : strokeColor,
            dashArray: ''
          });
        }
      });

      // Select on Click
      geoJsonLayer.on('click', () => {
        if (firestate) {
          onSelectProvince(firestate);
        }
      });

      layersRef.current[expectedDbId] = geoJsonLayer as unknown as L.Polygon;

      // On-map tactical label markers (Only overlay when coordinates defined)
      if (zoomLevel > 4 && centerLat !== undefined && centerLng !== undefined) {
        const shortName = pName.split(' - ')[1] || pName.split(' ')[0] || pName;
        
        let customHtml = `<div class="tactical-map-label province-zoom text-[8.5px] font-mono font-bold text-slate-400/90 tracking-wide">${shortName}</div>`;
        
        if (displayMode === 'resources' && firestate) {
          const spec = firestate.resourceSpecialty;
          let specEmoji = '🌾';
          if (spec === 'gold') specEmoji = '🪙';
          if (spec === 'oil') specEmoji = '🛢️';
          if (spec === 'iron') specEmoji = '⛓️';
          if (spec === 'electricity') specEmoji = '⚡';
          customHtml = `
            <div class="flex flex-col items-center justify-center select-none pointer-events-none">
              <span class="text-[11px] drop-shadow-md mb-0.5 animate-pulse">${specEmoji}</span>
              <span class="tactical-map-label text-[8px] text-slate-300 font-mono leading-none font-bold">${shortName}</span>
            </div>
          `;
        }

        const labelIcon = L.divIcon({
          html: customHtml,
          className: 'tactical-label-wrapper',
          iconSize: [60, 24],
          iconAnchor: [30, 12]
        });

        const labelMarker = L.marker([centerLat, centerLng], {
          icon: labelIcon,
          interactive: false
        }).addTo(mapInstance);

        labelsRef.current.push(labelMarker);
      }
    });

    // Render Country Names at high level (Zoom <= 4)
    if (zoomLevel <= 4) {
      Object.entries(countryCenters).forEach(([countryName, data]) => {
        const avgLat = data.sumLat / data.count;
        const avgLng = data.sumLng / data.count;
        
        const labelIcon = L.divIcon({
          html: `<div class="tactical-map-label country-zoom text-sm font-black text-amber-500 drop-shadow-2xl uppercase tracking-widest">${countryName}</div>`,
          className: 'tactical-label-wrapper !z-[800]',
          iconSize: [120, 30],
          iconAnchor: [60, 15]
        });

        const labelMarker = L.marker([avgLat, avgLng], {
          icon: labelIcon,
          interactive: false
        }).addTo(mapInstance);

        labelsRef.current.push(labelMarker);
      });
    }

    return () => {
      // Cleanup layers on unmount or refresh
      Object.values(layersRef.current).forEach((layer) => {
        mapInstance.removeLayer(layer);
      });
      labelsRef.current.forEach((marker) => {
        mapInstance.removeLayer(marker);
      });
    };
  }, [mapInstance, geojsonData, provinces, currentCountryId, currentAllianceId, selectedProvinceId, displayMode, zoomLevel]);

  return null;
};
