import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { MapUnit } from '../types';
import { listenToUnits } from '../services/unitService';

import soldierImg from '../assets/images/unit_soldier_sprite_1781285256720.jpg';
import tankImg from '../assets/images/unit_tank_sprite_1781285273442.jpg';
import jetImg from '../assets/images/unit_jet_sprite_1781285287017.jpg';

interface UnitLayerProps {
  mapInstance: L.Map | null;
  matchId: string;
  onSelectUnit: (unit: MapUnit) => void;
  selectedUnitId: string | null;
  currentCountryId: string | null;
}

export const UnitLayer: React.FC<UnitLayerProps> = ({
  mapInstance,
  matchId,
  onSelectUnit,
  selectedUnitId,
  currentCountryId
}) => {
  const [units, setUnits] = useState<MapUnit[]>([]);
  const markersRef = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (!matchId) return;
    const unsub = listenToUnits(matchId, (liveUnits) => {
      setUnits(liveUnits);
    });
    return () => unsub();
  }, [matchId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.keys(markersRef.current).forEach(id => {
        if (markersRef.current[id] && mapInstance) {
          mapInstance.removeLayer(markersRef.current[id]);
        }
      });
      markersRef.current = {};
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;

    // Remove deleted units
    const currentIds = new Set(units.map(u => u.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        mapInstance.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    // We will store actual current pos calculations
    const now = Date.now();

    // Filter units: only show player's own units UNLESS we have some espionage flag (for simplicity now, just own units, or all if we want to simulate intel later but for now strictly own units + bot's units maybe? User said "عض القوات للدولة الذي اختارها المستخدم فقط وبقية الدول بالتجسس")
    const visibleUnits = units.filter(u => u.ownerCountryId === currentCountryId);

    // Update or create units
    visibleUnits.forEach(unit => {
      const isSelected = selectedUnitId === unit.id;
      let existingMarker = markersRef.current[unit.id];

      // Format custom HTML Icon
      let iconImg = (soldierImg as any)?.src || soldierImg;
      if (unit.type === 'tank') iconImg = (tankImg as any)?.src || tankImg;
      if (unit.type === 'jet') iconImg = (jetImg as any)?.src || jetImg;

      let statusBadge = '✅ جاهز';
      if (unit.status === 'moving') statusBadge = '🚀 يتحرك';
      if (unit.status === 'training' as any) statusBadge = '⚙️ قيد التدريب';

      const html = `
        <div class="relative flex flex-col items-center justify-center pointer-events-auto transition-transform duration-300" style="transform: scale(${isSelected ? 1.2 : 1})">
          <div class="w-8 h-8 rounded-full overflow-hidden border-2 shadow-xl shrink-0 bg-slate-900 flex items-center justify-center" style="border-color: ${unit.color || '#f59e0b'}; box-shadow: 0 0 10px ${isSelected ? unit.color : 'transparent'}">
            ${unit.type === 'missile'
              ? `<span class="text-xs">🚀</span>`
              : `<img src="${iconImg}" class="w-full h-full object-cover mix-blend-lighten" />`
            }
          </div>
          <div class="absolute -top-4 whitespace-nowrap px-1 rounded-sm bg-black/80 text-[7px] font-bold text-white border border-slate-700">
            ${statusBadge} | ${unit.hp}HP
          </div>
          <div class="absolute -bottom-2 whitespace-nowrap bg-black/90 px-1 rounded text-[7px] text-white border border-slate-700">
            ${unit.ownerCountryName}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: `unit-marker ${isSelected ? '!z-[1000]' : '!z-[600]'}`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      // Calculate current position if moving
      let currentLat = unit.lat;
      let currentLng = unit.lng;

      if (unit.status === 'moving' && unit.targetLat !== null && unit.targetLng !== null) {
        // speed is let's say "degrees per second".
        const elapsedSec = (now - unit.lastUpdatedAt) / 1000;
        
        // Convert map speed (which is a raw number) into a small fraction per second.
        // speed = 5 means 0.5 degrees per second, for example.
        const velocity = unit.speed * 0.1;
        
        const distLat = unit.targetLat - unit.lat;
        const distLng = unit.targetLng - unit.lng;
        const totalDist = Math.sqrt(distLat*distLat + distLng*distLng);
        
        if (totalDist > 0) {
          const travelled = velocity * elapsedSec;
          if (travelled >= totalDist) {
            // Reached
            currentLat = unit.targetLat;
            currentLng = unit.targetLng;
          } else {
            // Interpolate
            const ratio = travelled / totalDist;
            currentLat = unit.lat + distLat * ratio;
            currentLng = unit.lng + distLng * ratio;
          }
        }
      }

      if (existingMarker) {
        existingMarker.setLatLng([currentLat, currentLng]);
        existingMarker.setIcon(icon);
      } else {
        const marker = L.marker([currentLat, currentLng], { icon }).addTo(mapInstance);
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectUnit(unit);
        });
        markersRef.current[unit.id] = marker;
      }
    });
  }, [units, mapInstance, selectedUnitId]);

  // Request Animation Frame loop to constantly update moving marker positions for smooth client-side rendering
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      const now = Date.now();
      
      const visibleLoopUnits = units.filter(u => u.ownerCountryId === currentCountryId);
      visibleLoopUnits.forEach(unit => {
        if (unit.status === 'moving' && unit.targetLat !== null && unit.targetLng !== null) {
          const elapsedSec = (now - unit.lastUpdatedAt) / 1000;
          const velocity = unit.speed * 0.1;
          
          const distLat = unit.targetLat - unit.lat;
          const distLng = unit.targetLng - unit.lng;
          const totalDist = Math.sqrt(distLat*distLat + distLng*distLng);
          
          if (totalDist > 0) {
            const travelled = velocity * elapsedSec;
            let currentLat = unit.targetLat;
            let currentLng = unit.targetLng;
            
            if (travelled < totalDist) {
              const ratio = travelled / totalDist;
              currentLat = unit.lat + distLat * ratio;
              currentLng = unit.lng + distLng * ratio;
            }

            const marker = markersRef.current[unit.id];
            if (marker) {
              marker.setLatLng([currentLat, currentLng]);
            }
          }
        }
      });

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [units]);

  return null;
};
