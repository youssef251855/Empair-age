import React, { useEffect, useState, useRef } from 'react';
import { ProvinceState, seedProvincesFromGeoJSON, listenToProvinces } from '../services/provinceService';
import { updateUnitTarget, listenToUnits } from '../services/unitService';
import { useGame } from '../context/GameContext';
import { Shield, Coins, Droplet, Flame, Compass, Maximize2, Zap, Plus, Minus, Info, Target, Navigation } from 'lucide-react';
import { MapUnit } from '../types';

interface MapProps {
  onSelectProvince: (prov: ProvinceState) => void;
  selectedProvinceId: string | null;
}

// Ray-Casting algorithm for high-speed polygon hit detection (X matches longitude, Y matches latitude)
function isPointInPolygon(point: { x: number; y: number }, vs: [number, number][]) {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Preloaded unit icons for high-performance canvas rendering
const preloadedSoldierImg = typeof window !== 'undefined' ? new Image() : null;
if (preloadedSoldierImg) preloadedSoldierImg.src = '/icons/soldier.png';

const preloadedTankImg = typeof window !== 'undefined' ? new Image() : null;
if (preloadedTankImg) preloadedTankImg.src = '/icons/tank.png';

const preloadedPlaneImg = typeof window !== 'undefined' ? new Image() : null;
if (preloadedPlaneImg) preloadedPlaneImg.src = '/icons/military_plane.png';

export const Map: React.FC<MapProps> = ({ onSelectProvince, selectedProvinceId }) => {
  const { currentCountry, selectedMatchId, countries, spies, territories } = useGame();

  const [units, setUnits] = useState<MapUnit[]>([]);
  const [geojsonData, setGeojsonData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'political' | 'alliances' | 'war' | 'resources'>('political');

  // Adaptive Performance Diagnostics
  const performanceMode = useRef<'low' | 'high'>('high');
  useEffect(() => {
    // Check for explicit user setting first
    const explicitSetting = localStorage.getItem('graphicsQuality');
    if (explicitSetting) {
      performanceMode.current = explicitSetting === 'high' ? 'high' : 'low';
      console.log(`Graphics mode forced by user setting to: ${explicitSetting}`);
      return;
    }

    // Auto-detect weak devices based on cores or memory
    const hardwareCores = navigator.hardwareConcurrency || 4;
    // @ts-ignore
    const deviceMemory = navigator.deviceMemory || 4;
    
    if (hardwareCores <= 4 || deviceMemory <= 4) {
      performanceMode.current = 'low';
      console.log('Low graphics mode auto-enabled to save resources.');
    }
  }, []);

  const lastHoverCheckRef = useRef<number>(0);

  // Canvas Interaction & Camera States
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Virtual dimensions mapping Mercator coordinate bounds
  const virtualWidth = 1000;
  const virtualHeight = 550;

  const zoomRef = useRef<number>(1.2);
  const panXRef = useRef<number>(100);
  const panYRef = useRef<number>(50);

  const [hoveredPos, setHoveredPos] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<any | null>(null);

  // Selection state
  const [selectedUnit, setSelectedUnit] = useState<MapUnit | null>(null);
  const [unitMoveMode, setUnitMoveMode] = useState<boolean>(false);

  // Dragging camera states
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Real-time smooth motion interpolation state
  const drawnPositionsRef = useRef<Record<string, { lat: number; lng: number; lastTick: number }>>({});

  // Combat spark particles for Layer 3 FX
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>>([]);

  const pathsRef = useRef<Map<string, Path2D[]>>(new globalThis.Map());
  const bboxesRef = useRef<Map<string, [number, number, number, number]>>(new globalThis.Map());

  // Dynamic references kept fresh for the high-frequency animation loop
  const provincesRef = useRef<Map<string, ProvinceState>>(new globalThis.Map());
  const unitsRef = useRef<MapUnit[]>([]);
  const selectedUnitIdRef = useRef<string | null>(null);
  const hoveredProvinceIdRef = useRef<string | null>(null);

  useEffect(() => {
    const lookup = new globalThis.Map<string, ProvinceState>();
    territories.forEach(t => lookup.set(t.id, t as ProvinceState));
    provincesRef.current = lookup;
  }, [territories]);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  useEffect(() => {
    selectedUnitIdRef.current = selectedUnit?.id || null;
    // Keep local unit details in sync on model reload from database
    if (selectedUnit) {
      const refreshed = units.find(u => u.id === selectedUnit.id);
      if (refreshed) setSelectedUnit(refreshed);
    }
  }, [selectedUnit, units]);

  useEffect(() => {
    hoveredProvinceIdRef.current = hoveredProvince?.expectedDbId || null;
  }, [hoveredProvince]);

  // Project Spherical coordinates directly to 2D flat Cartesian virtual space
  const projectCoords = (lat: number, lng: number) => {
    const xPercent = (lng + 180) / 360;
    const yPercent = (85 - lat) / 170;
    return {
      x: xPercent * virtualWidth,
      y: yPercent * virtualHeight,
    };
  };

  // Convert flat screen pixels back into Spherical Coordinates
  const unprojectPixels = (canvasX: number, canvasY: number) => {
    const virtualX = (canvasX - panXRef.current) / zoomRef.current;
    const virtualY = (canvasY - panYRef.current) / zoomRef.current;
    const xPercent = virtualX / virtualWidth;
    const yPercent = virtualY / virtualHeight;
    const lng = xPercent * 360 - 180;
    const lat = 85 - yPercent * 170;
    return {
      lat: Math.max(-85, Math.min(85, lat)),
      lng: Math.max(-180, Math.min(180, lng)),
    };
  };

  // Helper to replace raw Red and raw Green flags/national colors with elegant, premium, modern, neutral tactical gameplay shades 
  // (e.g. Deep Sky Blue, Royal Purple) so that the map is free of confusing red/green indicators by default.
  const sanitizeColorForTacticalTheme = (color: string | undefined): string => {
    if (!color) return 'rgba(148, 163, 184, 0.25)';
    const c = color.toLowerCase().trim();

    // Map common green hues to premium Sky Blue / Cyan
    if (
      c.includes('16a34a') || 
      c.includes('10b981') || 
      c.includes('22c55e') || 
      c.includes('15803d') ||
      c === '#16a34a' ||
      c === '#10b981' ||
      c === '#22c55e' ||
      c === '#15803d'
    ) {
      return '#0284c7'; // Deep Sky Blue
    }

    // Map common aggressive red hues to elegant Royal Purple
    if (
      c.includes('dc2626') || 
      c.includes('ef4444') || 
      c.includes('b91c1c') || 
      c.includes('f43f5e') ||
      c === '#dc2626' ||
      c === '#ef4444' ||
      c === '#b91c1c' ||
      c === '#f43f5e'
    ) {
      return '#7c3aed'; // Royal Purple
    }

    return color;
  };

  // Helper to resolve province colors based on active displays overlay
  const getProvinceColor = (prov: ProvinceState): string => {
    if (prov.battleStatus === 'clashing') {
      const alpha = 0.45 + 0.15 * Math.sin(Date.now() / 150);
      return `rgba(239, 68, 68, ${alpha})`; // Flashing Battle Zone Red
    }

    if (displayMode === 'resources') {
      const spec = prov.resourceSpecialty;
      if (spec === 'gold') return 'rgba(217, 119, 6, 0.45)'; // Rich Amber Gold
      if (spec === 'oil') return 'rgba(13, 148, 136, 0.45)';  // Petro-Teal
      if (spec === 'iron') return 'rgba(71, 85, 105, 0.5)';   // Slate Iron
      if (spec === 'food') return 'rgba(22, 163, 74, 0.4)';  // Agricultural Green
      if (spec === 'electricity') return 'rgba(2, 132, 199, 0.45)'; // Cobalt Energy
      return 'rgba(148, 163, 184, 0.15)';
    }

    if (displayMode === 'war') {
      const g = prov.garrison;
      const forces = (g?.infantry || 0) + (g?.specialForces || 0) + (g?.tanks || 0) + (g?.artillery || 0) + (g?.jets || 0);
      if (forces > 45) return 'rgba(153, 27, 27, 0.65)'; // Crimson Bunker
      if (forces > 10) return 'rgba(185, 28, 28, 0.4)';  // Active Conflict zone
      return 'rgba(148, 163, 184, 0.25)'; // Slate gray for peaceful sector
    }

    // Default & Alliances coloring mode (Gray map with Green for Allies, Red for Active Battles/Wars)
    if (!prov.ownerCountryId) return 'rgba(148, 163, 184, 0.1)';

    // Check if friendly (us or alliance member)
    const isFriendly = prov.ownerCountryId === currentCountry?.id || (
      currentCountry?.allianceId &&
      countries?.find(c => c.id === prov.ownerCountryId)?.allianceId === currentCountry.allianceId
    );

    if (isFriendly) {
      return 'rgba(34, 197, 94, 0.55)'; // Elegant Emerald Green for Alliance
    }

    // Check if under occupation/war or clashing
    if (prov.occupyingCountryId && prov.occupyingCountryId !== prov.ownerCountryId) {
      return 'rgba(239, 68, 68, 0.55)'; // War/Occupation Red
    }

    return 'rgba(100, 116, 139, 0.25)'; // Default neutral/other Slate Gray
  };

  // 1. Fetch GeoJSON and Listen to Live Data
  useEffect(() => {
    let isMounted = true;
    if (!selectedMatchId) return;

    async function loadAssetsAndSeeding() {
      try {
        setLoading(true);
        const response = await fetch('/assets/maps/countries-50m.json');
        if (!response.ok) {
          throw new Error('Failed to load map boundary file.');
        }
        const geojson = await response.json();

        if (isMounted) {
          setGeojsonData(geojson);
        }

        // Auto-seed provinces to the database if they are empty
        await seedProvincesFromGeoJSON(geojson, selectedMatchId);
      } catch (err: any) {
        console.error('Error loading world map: ', err);
        if (isMounted) {
          setErrorMsg('فشل تحميل حدود الخريطة الجغرافية. تأكد من وجود ملف assets/maps/countries-50m.json');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAssetsAndSeeding();

    // Subscribe to live battle unit markers
    const unsubscribeUnits = listenToUnits(selectedMatchId, (liveUnits) => {
      if (isMounted) setUnits(liveUnits);
    });

    return () => {
      isMounted = false;
      unsubscribeUnits();
    };
  }, [selectedMatchId]);

  // Center the camera on initial load to match the Middle East beautifully
  useEffect(() => {
    if (!loading && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pt = projectCoords(24.0, 45.0); // Middle East coords
      const startZoom = 1.6;
      zoomRef.current = startZoom;
      panXRef.current = rect.width / 2 - pt.x * startZoom;
      panYRef.current = rect.height / 2 - pt.y * startZoom;
    }
  }, [loading]);

  useEffect(() => {
    if (!geojsonData || !geojsonData.features) return;
    if (pathsRef.current.size > 0) return; // Only process once per session

    // Read graphics quality setting to determine geometry simplification density
    const quality = localStorage.getItem('graphicsQuality') || 'high';
    // skip factor: low = 4 (draw every 4th vertex), medium = 2, high = 1 (all vertices)
    const step = quality === 'low' ? 4 : quality === 'medium' ? 2 : 1;

    geojsonData.features.forEach((feat: any) => {
      const geoJsonId = feat.properties.id;
      const geo = feat.geometry;
      if (!geo || !geoJsonId) return;

      const featurePaths: Path2D[] = [];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      const addToPath = (ring: [number, number][]) => {
        if (ring.length === 0) return;
        const path = new Path2D();
        
        // Always include the first and last points to close the polygon
        const p0 = projectCoords(ring[0][1], ring[0][0]);
        if (p0.x < minX) minX = p0.x;
        if (p0.x > maxX) maxX = p0.x;
        if (p0.y < minY) minY = p0.y;
        if (p0.y > maxY) maxY = p0.y;
        path.moveTo(p0.x, p0.y);
        
        for (let i = 1; i < ring.length - 1; i += step) {
          const pt = projectCoords(ring[i][1], ring[i][0]);
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
          path.lineTo(pt.x, pt.y);
        }
        
        const plast = projectCoords(ring[ring.length - 1][1], ring[ring.length - 1][0]);
        if (plast.x < minX) minX = plast.x;
        if (plast.x > maxX) maxX = plast.x;
        if (plast.y < minY) minY = plast.y;
        if (plast.y > maxY) maxY = plast.y;
        path.lineTo(plast.x, plast.y);
        path.closePath();
        
        featurePaths.push(path);
      };

      if (geo.type === 'Polygon') {
        geo.coordinates.forEach((ring: any) => addToPath(ring));
      } else if (geo.type === 'MultiPolygon') {
        geo.coordinates.forEach((poly: any) => {
          poly.forEach((ring: any) => addToPath(ring));
        });
      }

      pathsRef.current.set(geoJsonId, featurePaths);
      bboxesRef.current.set(geoJsonId, [minX, minY, maxX, maxY]);
    });
    console.log("Vector Path2D generation completed for Tactical Map");
  }, [geojsonData]);

  // Find geographical sector hit under coordinates
  const findProvinceAtCoords = (lat: number, lng: number) => {
    if (!geojsonData || !geojsonData.features) return null;

    for (const feat of geojsonData.features) {
      const geo = feat.geometry;
      const geoJsonId = feat.properties.id;
      if (!geo || !geoJsonId) continue;

      // Ultra-high-speed bounding box fast-path check
      if (feat.properties.bbox) {
        const [minLng, minLat, maxLng, maxLat] = feat.properties.bbox;
        if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
          continue;
        }
      } else {
        // Calculate and cache bounding box dynamically
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
        const processRing = (ring: [number, number][]) => {
          for (let i = 0; i < ring.length; i++) {
            const coordLng = ring[i][0];
            const coordLat = ring[i][1];
            if (coordLng < minLng) minLng = coordLng;
            if (coordLng > maxLng) maxLng = coordLng;
            if (coordLat < minLat) minLat = coordLat;
            if (coordLat > maxLat) maxLat = coordLat;
          }
        };

        if (geo.type === 'Polygon') {
          geo.coordinates.forEach((ring: any) => processRing(ring));
        } else if (geo.type === 'MultiPolygon') {
          geo.coordinates.forEach((poly: any) => {
            poly.forEach((ring: any) => processRing(ring));
          });
        }
        feat.properties.bbox = [minLng, minLat, maxLng, maxLat];

        if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
          continue;
        }
      }

      const isInsideFeature = () => {
        const checkPolygon = (ring: [number, number][]) => {
          return isPointInPolygon({ x: lng, y: lat }, ring);
        };

        if (geo.type === 'Polygon') {
          return checkPolygon(geo.coordinates[0]);
        } else if (geo.type === 'MultiPolygon') {
          return geo.coordinates.some((poly: any) => checkPolygon(poly[0]));
        }
        return false;
      };

      if (isInsideFeature()) {
        const expectedDbId = `${selectedMatchId}_${geoJsonId}`;
        const firestate = provincesRef.current.get(expectedDbId);
        return { feat, firestate, expectedDbId };
      }
    }
    return null;
  };

  // Double-Buffered High-Performance Canvas Rendering Loop
  useEffect(() => {
    if (loading || !canvasRef.current) return;

    let animFrame: number;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Clear with dark, high-contrast tactical command colors
      ctx.fillStyle = '#060814';
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 1: الأرض والجغرافيا (Map Background + Polygons) ---
      if (geojsonData && geojsonData.features) {
        geojsonData.features.forEach((feat: any) => {
          const geoJsonId = feat.properties.id;
          const geo = feat.geometry;
          if (!geo || !geoJsonId) return;

          // VIEWPORT CULLING (Skip drawing off-screen polygons!)
          const bbox = bboxesRef.current.get(geoJsonId);
          if (bbox) {
            const [minX, minY, maxX, maxY] = bbox;
            // Apply scale and pan directly to bounds checking bounds vs screen
            const screenMinX = minX * zoomRef.current + panXRef.current;
            const screenMaxX = maxX * zoomRef.current + panXRef.current;
            const screenMinY = minY * zoomRef.current + panYRef.current;
            const screenMaxY = maxY * zoomRef.current + panYRef.current;
            if (screenMaxX < -50 || screenMinX > width + 50 || screenMaxY < -50 || screenMinY > height + 50) {
              return; // Polygon is outside the screen viewport completely!
            }
          }

          const expectedDbId = `${selectedMatchId}_${geoJsonId}`;
          const dbProv = provincesRef.current.get(expectedDbId);

          const isSelected = selectedProvinceId === expectedDbId;
          const isHovered = hoveredProvinceIdRef.current === expectedDbId;

          // Resolve rendering colors
          const fillColor = dbProv ? getProvinceColor(dbProv) : 'rgba(148, 163, 184, 0.08)';
          const cleanProvColor = dbProv?.color ? sanitizeColorForTacticalTheme(dbProv.color) : null;
          let strokeColor = cleanProvColor ? cleanProvColor : 'rgba(56, 189, 248, 0.1)';
          let strokeWidth = 0.8;

          if (dbProv?.battleStatus === 'clashing') {
            const flashAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 150);
            strokeColor = `rgba(239, 68, 68, ${0.4 + 0.6 * flashAlpha})`;
            strokeWidth = 2.5;
          } else if (isSelected) {
            strokeColor = '#f59e0b'; // Amber Gold Halo
            strokeWidth = 2.0;
          } else if (isHovered) {
            strokeColor = '#38bdf8'; // Tactical Cyan Halo
            strokeWidth = 1.5;
          } else if (displayMode === 'political' && dbProv?.ownerCountryId) {
            strokeColor = cleanProvColor || 'rgba(56, 189, 248, 0.4)';
            strokeWidth = 1.2;
          }

          const p2dArray = pathsRef.current.get(geoJsonId);
          if (p2dArray) {
            ctx.save();
            ctx.translate(panXRef.current, panYRef.current);
            ctx.scale(zoomRef.current, zoomRef.current);
            
            p2dArray.forEach((path) => {
              ctx.fillStyle = fillColor;
              ctx.fill(path);
              
              if (isHovered) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
                ctx.fill(path);
              }

              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth / zoomRef.current;
              ctx.stroke(path);
            });
            ctx.restore();
          }

          // Render Province Labels if zoom scale is wide enough or if there is an active battle clash
          if (dbProv && (zoomRef.current > 1.1 || dbProv.battleStatus === 'clashing')) {
            const labelLat = feat.properties.centerLat !== undefined ? feat.properties.centerLat : (90 - (dbProv.posY / 100) * 180);
            const labelLng = feat.properties.centerLng !== undefined ? feat.properties.centerLng : ((dbProv.posX / 100) * 360 - 180);
            if (labelLat !== undefined && labelLng !== undefined) {
              const pt = projectCoords(labelLat, labelLng);
              const sx = pt.x * zoomRef.current + panXRef.current;
              const sy = pt.y * zoomRef.current + panYRef.current;

              if (dbProv.battleStatus === 'clashing') {
                // Draw flashing engagement aura rings
                ctx.beginPath();
                const radiusPulse = 14 + 10 * ((Date.now() % 1200) / 1200);
                ctx.arc(sx, sy, radiusPulse, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(239, 68, 68, ${1 - ((Date.now() % 1200) / 1200)})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Draw central explosion fire spark particles over time
                if (performanceMode.current === 'high' && Math.random() < 0.20 && particlesRef.current.length < 300) {
                  particlesRef.current.push({
                    x: sx + (Math.random() - 0.5) * 16,
                    y: sy + (Math.random() - 0.5) * 16,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    life: 0.8 + Math.random() * 0.4,
                    color: Math.random() < 0.5 ? '#f97316' : '#ef4444' // Flame colors!
                  });
                }

                // Draw battle emblem: Crossed Swords ⚔️
                ctx.font = '16px Cairo, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⚔️', sx, sy - 14);

                // Clash timer rendering
                if (dbProv.battleReleaseTime) {
                  const remaining = Math.max(0, Math.round((dbProv.battleReleaseTime - Date.now()) / 1000));
                  ctx.font = 'bold 9px Cairo, sans-serif';
                  ctx.fillStyle = '#ef4444';
                  ctx.fillText(`${remaining}s`, sx, sy - 28);
                }
              }

              const cleanName = dbProv.name.split(' - ')[1] || dbProv.name.split(' ')[0] || dbProv.name;
              const flag = dbProv.flagEmoji || '🏳️';
              const displayText = zoomRef.current > 3.0 ? `${flag} ${cleanName}` : `${flag}`;

              // Draw soft text background box
              ctx.font = 'bold 8px Cairo, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              const textW = ctx.measureText(displayText).width + 6;
              ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
              ctx.fillRect(sx - textW / 2, sy - 5, textW, 11);

              ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
              ctx.strokeRect(sx - textW / 2, sy - 5, textW, 11);

              ctx.fillStyle = isSelected ? '#f59e0b' : '#cbd5e1';
              ctx.fillText(displayText, sx, sy + 0.5);

              // 🛡 Defense Value
              if (dbProv.defenseValue !== undefined) {
                ctx.fillStyle = '#64748b';
                ctx.font = '7px Cairo, sans-serif';
                ctx.fillText(`🛡 ${Math.round(dbProv.defenseValue)}`, sx, sy + 12);
              }

              // ⚔️ Occupation Progress Bar
              if (dbProv.occupationProgress !== undefined && dbProv.occupationProgress > 0) {
                const barWidth = 24;
                const barHeight = 4;
                const barX = sx - barWidth / 2;
                const barY = sy - 12;

                ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                ctx.fillRect(barX, barY, barWidth, barHeight);

                ctx.fillStyle = '#ef4444'; // Red occupation progress
                ctx.fillRect(barX, barY, barWidth * (dbProv.occupationProgress / 100), barHeight);
                
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(barX, barY, barWidth, barHeight);
              }
            }
          }
        });
      }

      // --- COORDINATES TACTICAL GRID (Layer 1 Overlay) ---
      if (performanceMode.current === 'high') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.03)';
        ctx.lineWidth = 1.0;
        // Draw grid lines mapping 10-degree increments
        for (let lg = -180; lg <= 180; lg += 15) {
          ctx.beginPath();
          const pt1 = projectCoords(-85, lg);
          const pt2 = projectCoords(85, lg);
          ctx.moveTo(pt1.x * zoomRef.current + panXRef.current, pt1.y * zoomRef.current + panYRef.current);
          ctx.lineTo(pt2.x * zoomRef.current + panXRef.current, pt2.y * zoomRef.current + panYRef.current);
          ctx.stroke();
        }
        for (let lt = -75; lt <= 75; lt += 15) {
          ctx.beginPath();
          const pt1 = projectCoords(lt, -180);
          const pt2 = projectCoords(lt, 180);
          ctx.moveTo(pt1.x * zoomRef.current + panXRef.current, pt1.y * zoomRef.current + panYRef.current);
          ctx.lineTo(pt2.x * zoomRef.current + panXRef.current, pt2.y * zoomRef.current + panYRef.current);
          ctx.stroke();
        }
      }

      // --- LAYER 3: INTERACTION, RANGE & MOVEMENT FLOW (Dotted guides / circles) ---
      const now = Date.now();
      const activeUnits = unitsRef.current.filter((unit) => {
        if (!currentCountry) return true; // spectator / admin
        if (unit.ownerCountryId === currentCountry.id) return true; // own units always visible

        // Check if they are allies
        const targetCountry = countries?.find(c => c.id === unit.ownerCountryId);
        const isAlly = currentCountry?.allianceId && 
                       targetCountry?.allianceId && 
                       currentCountry.allianceId !== "" &&
                       targetCountry.allianceId !== "" &&
                       targetCountry.allianceId === currentCountry.allianceId;
        if (isAlly) return true;

        // Check if successfully spied upon
        const hasEspionage = spies?.some(spy => 
          spy.ownerCountryId === currentCountry.id && 
          spy.targetCountryId === unit.ownerCountryId &&
          spy.status === 'successful'
        );
        return !!hasEspionage;
      });

      // Update particle physics
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        ctx.beginPath();
        const radius = Math.max(0, Math.min(8, p.life * 1.5));
        if (radius > 0) {
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        return p.life > 0;
      });

      // Synchronize smooth real-time target motion interpolations
      activeUnits.forEach((unit) => {
        let drawPos = drawnPositionsRef.current[unit.id];
        if (!drawPos) {
          drawPos = { lat: unit.lat, lng: unit.lng, lastTick: now };
          drawnPositionsRef.current[unit.id] = drawPos;
        }

        const elapsed = (now - drawPos.lastTick) / 1000;
        drawPos.lastTick = now;

        if (unit.status === 'moving' && unit.targetLat !== null && unit.targetLng !== null) {
          const speedDegPerSec = unit.speed * 0.15; // Calibrated displacement vector
          const dLat = unit.targetLat - drawPos.lat;
          const dLng = unit.targetLng - drawPos.lng;
          const distance = Math.sqrt(dLat * dLat + dLng * dLng);

          if (distance > 0.01) {
            const step = speedDegPerSec * elapsed;
            if (step >= distance) {
              drawPos.lat = unit.targetLat;
              drawPos.lng = unit.targetLng;
            } else {
              drawPos.lat += (dLat / distance) * step;
              drawPos.lng += (dLng / distance) * step;
            }
          } else {
            drawPos.lat = unit.targetLat;
            drawPos.lng = unit.targetLng;
          }
        } else {
          // Glide towards actual coordinate snapshots
          drawPos.lat += (unit.lat - drawPos.lat) * 0.08;
          drawPos.lng += (unit.lng - drawPos.lng) * 0.08;
        }

        // Draw movement lines for active trajectories
        if (unit.status === 'moving' && unit.targetLat !== null && unit.targetLng !== null) {
          const ptStart = projectCoords(drawPos.lat, drawPos.lng);
          const ptEnd = projectCoords(unit.targetLat, unit.targetLng);

          const sx = ptStart.x * zoomRef.current + panXRef.current;
          const sy = ptStart.y * zoomRef.current + panYRef.current;
          const ex = ptEnd.x * zoomRef.current + panXRef.current;
          const ey = ptEnd.y * zoomRef.current + panYRef.current;

          // Glowing tactical line
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = unit.ownerCountryId === currentCountry?.id ? 'rgba(56, 189, 248, 0.45)' : 'rgba(239, 68, 68, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Dest circle end dot
          ctx.beginPath();
          ctx.arc(ex, ey, 4, 0, Math.PI * 2);
          ctx.fillStyle = unit.ownerCountryId === currentCountry?.id ? '#06b6d4' : '#ef4444';
          ctx.fill();

        }

        // Combat sparks injection if fighting status triggered
        if (unit.status === 'fighting' && Math.random() < 0.1) {
          const pt = projectCoords(drawPos.lat, drawPos.lng);
          const sx = pt.x * zoomRef.current + panXRef.current;
          const sy = pt.y * zoomRef.current + panYRef.current;
          particlesRef.current.push({
            x: sx + (Math.random() - 0.5) * 8,
            y: sy + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
            color: '#f59e0b',
          });
        }
      });

      // Selection Halo Ring & Range circle on Layer 3
      const liveSelectedId = selectedUnitIdRef.current;
      if (liveSelectedId) {
        const selUnit = activeUnits.find(u => u.id === liveSelectedId);
        const drawPos = drawnPositionsRef.current[liveSelectedId];
        if (selUnit && drawPos) {
          const pt = projectCoords(drawPos.lat, drawPos.lng);
          const sx = pt.x * zoomRef.current + panXRef.current;
          const sy = pt.y * zoomRef.current + panYRef.current;

          const size = 18;

          // 1. Dotted range circle around the division
          ctx.beginPath();
          const rangePx = selUnit.range * 6 * zoomRef.current; // scale factor
          ctx.arc(sx, sy, rangePx, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.2;
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          // 2. Pulse target indicator ring
          ctx.beginPath();
          const pulseFraction = (Date.now() % 1000) / 1000;
          ctx.arc(sx, sy, size + 4 + pulseFraction * 6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245, 158, 11, ${1 - pulseFraction})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // --- LAYER 2: سبريتات الوحدات ومؤشرات الصحة (Units Vector Sprites) ---
      // Army Stacking Mechanism: Group units that are too close on screen
      const clusters: { x: number; y: number; units: typeof activeUnits }[] = [];
      activeUnits.forEach((unit) => {
        const drawPos = drawnPositionsRef.current[unit.id];
        if (!drawPos) return;

        const pt = projectCoords(drawPos.lat, drawPos.lng);
        const sx = pt.x * zoomRef.current + panXRef.current;
        const sy = pt.y * zoomRef.current + panYRef.current;

        // Skip rendering if drastically off screen to optimize resources
        if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) return;
        
        let foundCluster = false;
        if (zoomRef.current < 2.5) { // Only group when zoomed out
          for (const c of clusters) {
            const dist = Math.sqrt((c.x - sx) ** 2 + (c.y - sy) ** 2);
            if (dist < 24) { // px merge threshold
              c.units.push(unit);
              foundCluster = true;
              break;
            }
          }
        }
        
        if (!foundCluster) {
          clusters.push({ x: sx, y: sy, units: [unit] });
        }
      });

      clusters.forEach((cluster) => {
        const primaryUnit = cluster.units[0];
        const sx = cluster.x;
        const sy = cluster.y;
        
        const isUnitSelected = cluster.units.some(u => u.id === liveSelectedId);
        const size = isUnitSelected ? 18 : 14;
        const uColor = primaryUnit.color || '#f59e0b';
        const stackCount = cluster.units.length;

        // Base background division circle
        ctx.beginPath();
        ctx.arc(sx, sy, size + 2, 0, Math.PI * 2);
        ctx.fillStyle = isUnitSelected ? 'rgba(15, 23, 42, 0.95)' : 'rgba(3, 7, 18, 0.9)';
        ctx.strokeStyle = uColor;
        ctx.lineWidth = isUnitSelected ? 3.0 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Stack indicator
        if (stackCount > 1) {
          ctx.beginPath();
          ctx.arc(sx + size, sy - size, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${stackCount}`, sx + size, sy - size);
        }

        // 60FPS Micro Animation Factor
        const bounceOffset = Math.sin((Date.now() / 150) + primaryUnit.id.charCodeAt(0)) * 1.2;

        const unitListToDraw = performanceMode.current === 'high' ? [primaryUnit] : [primaryUnit]; // Keep reference for scope, but only draw primary face
        const unit = primaryUnit;

        if (unit.type === 'soldier') {
          if (preloadedSoldierImg && preloadedSoldierImg.complete && preloadedSoldierImg.naturalWidth !== 0) {
            ctx.drawImage(preloadedSoldierImg, sx - size + 2, sy - size + 2, (size - 2) * 2, (size - 2) * 2);
          } else {
            // --- ULTRA-POLISHED TACTICAL SOLDIER ILLUSTRATION ---
            // Military crosshair background
            ctx.beginPath();
            ctx.arc(sx, sy, size - 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1.0;
            ctx.stroke();

            // Draw head and helmet
            ctx.beginPath();
            ctx.arc(sx, sy - 3 + (bounceOffset * 0.3), 4, 0, Math.PI * 2);
            ctx.fillStyle = uColor;
            ctx.fill();

            // Glowing neon visor
            ctx.beginPath();
            ctx.ellipse(sx, sy - 3 + (bounceOffset * 0.3), 2.5, 1, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#22d3ee';
            ctx.fill();

            // Body chest armor plate path
            ctx.beginPath();
            ctx.moveTo(sx - 5, sy + 6);
            ctx.lineTo(sx + 5, sy + 6);
            ctx.lineTo(sx + 3.5, sy + 1);
            ctx.lineTo(sx - 3.5, sy + 1);
            ctx.closePath();
            ctx.fillStyle = uColor;
            ctx.fill();
          }
        } else if (unit.type === 'tank') {
          if (preloadedTankImg && preloadedTankImg.complete && preloadedTankImg.naturalWidth !== 0) {
            ctx.drawImage(preloadedTankImg, sx - size + 2, sy - size + 2, (size - 2) * 2, (size - 2) * 2);
          } else {
            // --- DETAILED IMMERSIVE HEAVY TANK ILLUSTRATION ---
            // Left and right metallic treads
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(sx - 9, sy - 6, 3, 12);
            ctx.fillRect(sx + 6, sy - 6, 3, 12);

            // Main tank steel armor chassis
            ctx.fillStyle = uColor;
            ctx.fillRect(sx - 6, sy - 5, 12, 10);

            // Central core rotary turret cupola
            ctx.beginPath();
            ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
          }
        } else if (unit.type === 'jet') {
          if (preloadedPlaneImg && preloadedPlaneImg.complete && preloadedPlaneImg.naturalWidth !== 0) {
            let flightAngle = -Math.PI / 2;
            if (unit.targetLat !== null && unit.targetLng !== null) {
              flightAngle = Math.atan2(unit.targetLat - unit.lat, unit.targetLng - unit.lng);
            }
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(flightAngle + Math.PI / 2); // Rotate to face direction
            ctx.drawImage(preloadedPlaneImg, -size + 2, -size + 2, (size - 2) * 2, (size - 2) * 2);
            ctx.restore();
          } else {
            // --- STEALTH MULTIROLE FIGHTER JET ILLUSTRATION ---
            let flightAngle = -Math.PI / 2;
            if (unit.targetLat !== null && unit.targetLng !== null) {
              flightAngle = Math.atan2(unit.targetLat - unit.lat, unit.targetLng - unit.lng);
            }

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(flightAngle);

            // Wing profile
            ctx.beginPath();
            ctx.moveTo(8, 0);       // nose cone tip
            ctx.lineTo(-3, 8);      // starboard wingtip
            ctx.lineTo(-2, 3);      // fuselage fold inner
            ctx.lineTo(-7, 4);      // tail starboard stabilator
            ctx.lineTo(-6, 0);      // tail engines fold center
            ctx.lineTo(-7, -4);     // tail port stabilator
            ctx.lineTo(-2, -3);     // fuselage fold inner port
            ctx.lineTo(-3, -8);     // port wingtip
            ctx.closePath();

            ctx.fillStyle = uColor;
            ctx.fill();
            ctx.restore();
          }
        } else if (unit.type === 'missile') {
          // --- PROCEDURAL INTERCONTINENTAL BALLISTIC MISSILE (ICBM) ---
          let missileAngle = -Math.PI / 2;
          if (unit.targetLat !== null && unit.targetLng !== null) {
            missileAngle = Math.atan2(unit.targetLat - unit.lat, unit.targetLng - unit.lng);
          }

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(missileAngle);

          // Active rocket thrust plasma plume
          ctx.beginPath();
          const boosterSize = 5 + Math.random() * 6;
          const boosterGrad = ctx.createLinearGradient(-12, 0, -4, 0);
          boosterGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          boosterGrad.addColorStop(0.4, '#ef4444');
          boosterGrad.addColorStop(1, '#e11d48');
          ctx.fillStyle = boosterGrad;
          ctx.moveTo(-5, -2.5);
          ctx.lineTo(-5 - boosterSize, 0);
          ctx.lineTo(-5, 2.5);
          ctx.closePath();
          ctx.fill();

          // Fuel tank assembly frame (cylinder fuselage)
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(-5, -2, 10, 4);

          // Danger/Warning yellow collar stripes
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(0, -2, 2, 4);

          // Explosive warhead pointed nose cone
          ctx.beginPath();
          ctx.moveTo(5, -2);
          ctx.lineTo(9, 0);
          ctx.lineTo(5, 2);
          ctx.closePath();
          ctx.fillStyle = uColor;
          ctx.fill();

          // Steerable stabilizer wings (Tail fins)
          ctx.beginPath();
          ctx.moveTo(-5, -2);
          ctx.lineTo(-8, -4.5);
          ctx.lineTo(-3, -2);
          ctx.closePath();
          ctx.fillStyle = '#ef4444';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-5, 2);
          ctx.lineTo(-8, 4.5);
          ctx.lineTo(-3, 2);
          ctx.closePath();
          ctx.fillStyle = '#ef4444';
          ctx.fill();

          ctx.restore();
        } else {
          // Default Headquarters / Base structure
          ctx.fillStyle = uColor;
          ctx.beginPath();
          ctx.moveTo(sx, sy - size + 4);
          ctx.lineTo(sx + size - 4, sy + size - 4);
          ctx.lineTo(sx - size + 4, sy + size - 4);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.rect(sx - 3, sy, 6, size - 4);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
        }

        // Mini HP Health bar
        const hpPct = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
        const barW = size * 1.5;
        const barH = 2.5;
        const bx = sx - barW / 2;
        const by = sy + size + 3;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(bx, by, barW, barH);

        ctx.fillStyle = hpPct > 0.5 ? '#10b981' : hpPct > 0.22 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(bx, by, barW * hpPct, barH);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, barW, barH);

        // Friendly vs Enemy indicator tag
        ctx.fillStyle = unit.ownerCountryId === currentCountry?.id ? '#38bdf8' : '#fda4af';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(unit.ownerCountryName.slice(0, 7), sx, sy - size - 2);

        // Flash battle badge if in combat
        if (unit.status === 'fighting') {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 9px Cairo, sans-serif';
          ctx.fillText('⚔️', sx, sy - size - 10);
        }
      });

    }; // End of render

    let lastTime = 0;
    const targetFPS = performanceMode.current === 'high' ? 60 : 30;
    const interval = 1000 / targetFPS;

    const renderLoop = (time: number) => {
      const deltaTime = time - lastTime;
      if (deltaTime >= interval) {
        lastTime = time - (deltaTime % interval);
        render();
      }
      animFrame = requestAnimationFrame(renderLoop);
    };
    animFrame = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [loading, geojsonData, selectedProvinceId, displayMode, currentCountry, countries]);

  // Hook DPI-scaled Canvas Size to avoid fuzzy/pixelated visual outputs
  useEffect(() => {
    if (!canvasRef.current || loading) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current!;
      const container = containerRef.current!;

      const width = container.clientWidth;
      const height = container.clientHeight || 550;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [loading]);

  // Listen for tactical air strike bombardment events to spawn explosion sparks!
  useEffect(() => {
    const handleAirstrikeEvent = (e: any) => {
      const { posX, posY, casualties } = e.detail;
      if (posX === undefined || posY === undefined) return;

      // Unconvert percentage-based pos coordinates if applicable
      const realLat = (posY >= 0 && posY <= 100) ? (90 - (posY / 100) * 180) : posY;
      const realLng = (posX >= 0 && posX <= 100) ? ((posX / 100) * 360 - 180) : posX;

      const pt = projectCoords(realLat, realLng);
      const sx = pt.x * zoomRef.current + panXRef.current;
      const sy = pt.y * zoomRef.current + panYRef.current;

      // Spawn 45 majestic fire explosion particles instantly on map canvas!
      for (let i = 0; i < 45; i++) {
        const speed = 1.2 + Math.random() * 4.8;
        const angle = Math.random() * Math.PI * 2;
        particlesRef.current.push({
          x: sx,
          y: sy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.2 + Math.random() * 0.8,
          color: Math.random() < 0.35 ? '#ef4444' : (Math.random() < 0.70 ? '#f97316' : '#eab308')
        });
      }
    };

    const handleInvasionMarchEvent = (e: any) => {
      const { startLat, startLng, endLat, endLng, color, count } = e.detail;
      if (startLat === undefined || endLat === undefined) return;

      // Unconvert percentage-based pos coordinates if applicable (between 0 and 100)
      const realStartLat = (startLat >= 0 && startLat <= 100) ? (90 - (startLat / 100) * 180) : startLat;
      const realStartLng = (startLng >= 0 && startLng <= 100) ? ((startLng / 100) * 360 - 180) : startLng;
      const realEndLat = (endLat >= 0 && endLat <= 100) ? (90 - (endLat / 100) * 180) : endLat;
      const realEndLng = (endLng >= 0 && endLng <= 100) ? ((endLng / 100) * 360 - 180) : endLng;

      const ptStart = projectCoords(realStartLat, realStartLng);
      const ptEnd = projectCoords(realEndLat, realEndLng);
      const sx = ptStart.x * zoomRef.current + panXRef.current;
      const sy = ptStart.y * zoomRef.current + panYRef.current;
      const ex = ptEnd.x * zoomRef.current + panXRef.current;
      const ey = ptEnd.y * zoomRef.current + panYRef.current;

      const dx = ex - sx;
      const dy = ey - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Spawn marching troops representing the invasion
      for (let i = 0; i < (count || 50); i++) {
        // Randomize speed so they form a scattered column
        const speedMultiplier = 0.3 + Math.random() * 0.8;
        // Jitter starting positions slightly
        const jitterX = (Math.random() - 0.5) * 30;
        const jitterY = (Math.random() - 0.5) * 30;
        // Direction vector normalized
        const vx = (dx / dist) * Math.min(2.0, dist / 30) * speedMultiplier;
        const vy = (dy / dist) * Math.min(2.0, dist / 30) * speedMultiplier;

        particlesRef.current.push({
          x: sx + jitterX,
          y: sy + jitterY,
          vx: vx,
          vy: vy,
          life: 8.0 + Math.random() * 4.0, // Lasts for several seconds as they march
          color: Math.random() < 0.3 ? '#ffffff' : (color || '#ef4444') // Add white flash/flags
        });
      }
    };

    window.addEventListener('map-airstrike', handleAirstrikeEvent);
    window.addEventListener('map-invasion-march', handleInvasionMarchEvent);
    return () => {
      window.removeEventListener('map-airstrike', handleAirstrikeEvent);
      window.removeEventListener('map-invasion-march', handleInvasionMarchEvent);
    };
  }, [projectCoords]);

  // Handle Dragging / Camera Panning & Unit Selections
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const unprojected = unprojectPixels(mouseX, mouseY);

    // 1. Click-to-Select tactical military division units first
    const clickedUnit = units.find((unit) => {
      const drawPos = drawnPositionsRef.current[unit.id];
      if (!drawPos) return false;
      const pt = projectCoords(drawPos.lat, drawPos.lng);
      const sx = pt.x * zoomRef.current + panXRef.current;
      const sy = pt.y * zoomRef.current + panYRef.current;
      const dist = Math.sqrt((mouseX - sx) ** 2 + (mouseY - sy) ** 2);
      return dist <= 20; // within 20px bubble
    });

    if (clickedUnit) {
      setSelectedUnit(clickedUnit);
      setUnitMoveMode(false);
      return;
    }

    // 2. If in move mode, issue target vector or combat attack command
    if (unitMoveMode && selectedUnit && selectedUnit.ownerCountryId === currentCountry?.id) {
      // Find what province lay underneath the target coordinates
      updateUnitTarget(selectedUnit.id, selectedUnit.lat, selectedUnit.lng, unprojected.lat, unprojected.lng, selectedUnit.speed);
      setUnitMoveMode(false);
      return;
    }

    // 3. Otherwise treat as Map Province polygon selector click
    const hit = findProvinceAtCoords(unprojected.lat, unprojected.lng);
    if (hit && hit.firestate) {
      onSelectProvince(hit.firestate);
    } else {
      setSelectedUnit(null); // Click empty ocean clears select
    }

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Drag / Pan mechanics (No need to calculate hover hit-tests during dragging/panning!)
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      panXRef.current += dx;
      panYRef.current += dy;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // High performance throttle: check hovered sector geometry max 30 times per second
    const now = Date.now();
    if (now - lastHoverCheckRef.current > 33) {
      lastHoverCheckRef.current = now;
      const unprojected = unprojectPixels(mouseX, mouseY);
      setHoveredPos({ lat: unprojected.lat, lng: unprojected.lng, x: mouseX, y: mouseY });
      
      const hit = findProvinceAtCoords(unprojected.lat, unprojected.lng);
      if (hit) {
        setHoveredProvince(hit);
      } else {
        setHoveredProvince(null);
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Modern GIS Desktop Mousewheel Zoom to cursor coordinates
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const oldZoom = zoomRef.current;
    let newZoom = e.deltaY < 0 ? zoomRef.current * zoomFactor : zoomRef.current / zoomFactor;
    newZoom = Math.max(0.4, Math.min(8.0, newZoom));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const unprojected = unprojectPixels(mouseX, mouseY);
    zoomRef.current = newZoom;

    // Back project to align camera so point underneath pointer remains stable
    const px = (unprojected.lng + 180) / 360 * virtualWidth;
    const py = (85 - unprojected.lat) / 170 * virtualHeight;

    panXRef.current = mouseX - px * newZoom;
    panYRef.current = mouseY - py * newZoom;
  };

  // Zoom helpers for mobile devices/onscreen navigation
  const handleOnscreenZoom = (multiplier: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const unprojected = unprojectPixels(cx, cy);
    const newZoom = Math.max(0.4, Math.min(8.0, zoomRef.current * multiplier));
    zoomRef.current = newZoom;

    const px = (unprojected.lng + 180) / 360 * virtualWidth;
    const py = (85 - unprojected.lat) / 170 * virtualHeight;

    panXRef.current = cx - px * newZoom;
    panYRef.current = cy - py * newZoom;
  };

  const handleRecenter = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pt = projectCoords(24.0, 45.0);
    const defaultZoom = 1.35;
    zoomRef.current = defaultZoom;
    panXRef.current = rect.width / 2 - pt.x * defaultZoom;
    panYRef.current = rect.height / 2 - pt.y * defaultZoom;
  };

  return (
    <div className="relative w-full h-[420px] md:h-[600px] bg-[#020617] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col shadow-black/80 font-sans" ref={containerRef}>
      {/* Floating Tactical Layer Mode Selector */}
      <div className="absolute top-4 right-4 z-[100] flex bg-slate-950/90 border border-slate-800 rounded-xl p-1 gap-1 shadow-2xl backdrop-blur-xl shrink-0">
        <button
          onClick={() => setDisplayMode('political')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer font-bold ${
            displayMode === 'political'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="الحدود السياسية للمقاطعات"
        >
          <Compass className="w-4 h-4" />
          <span className="hidden sm:inline">السياسي</span>
        </button>
        <button
          onClick={() => setDisplayMode('alliances')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer font-bold ${
            displayMode === 'alliances'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="فرز بالتحالفات العسكرية"
        >
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">التحالفات</span>
        </button>
        <button
          onClick={() => setDisplayMode('war')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer font-bold ${
            displayMode === 'war'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="حجم جبهات الصدام والتسليح"
        >
          <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
          <span className="hidden sm:inline">الحرب</span>
        </button>
        <button
          onClick={() => setDisplayMode('resources')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer font-bold ${
            displayMode === 'resources'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="الاحتياطيات والإنتاج"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">الموارد</span>
        </button>
      </div>

      {/* Floating Navigation Controls */}
      <div className="absolute top-4 left-4 z-[100] flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          className="bg-slate-950/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-amber-400 p-2.5 rounded-xl shadow-xl cursor-pointer transition-all flex items-center justify-center backdrop-blur-md"
          title="إعادة تركيز الخريطة"
        >
          <Maximize2 className="w-4.5 h-4.5" />
        </button>
        <button
          onClick={() => handleOnscreenZoom(1.25)}
          className="bg-slate-950/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-amber-400 p-2.5 rounded-xl shadow-xl cursor-pointer transition-all flex items-center justify-center backdrop-blur-md"
          title="تكبير"
        >
          <Plus className="w-4.5 h-4.5" />
        </button>
        <button
          onClick={() => handleOnscreenZoom(0.8)}
          className="bg-slate-950/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-amber-400 p-2.5 rounded-xl shadow-xl cursor-pointer transition-all flex items-center justify-center backdrop-blur-md"
          title="تصغير"
        >
          <Minus className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Real-time coordinates and sector HUD */}
      {hoveredPos && (
        <div className="absolute top-4 left-24 z-[90] bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2 shadow-xl backdrop-blur-md hidden md:flex items-center gap-3 text-[10px] font-mono text-slate-400">
          <div>
            <span className="text-sky-400 font-bold">GRID: </span>
            <span>X: {Math.floor((hoveredPos.lng + 180) / 3.6)}, Y: {Math.floor((85 - hoveredPos.lat) / 1.7)}</span>
          </div>
          <div className="w-px h-3 bg-slate-800"></div>
          <div>
            <span className="text-amber-400 font-bold">COORDS: </span>
            <span>{hoveredPos.lat.toFixed(2)}°N, {hoveredPos.lng.toFixed(2)}°E</span>
          </div>
          {hoveredProvince && (
            <>
              <div className="w-px h-3 bg-slate-800"></div>
              <div>
                <span className="text-emerald-400 font-bold">إقليم: </span>
                <span className="font-sans font-semibold text-slate-200">{hoveredProvince.firestate?.name || hoveredProvince.feat.properties.name}</span>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col justify-center items-center bg-[#070b16] gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-300">جاري تحميل وتزامن المقاطعات القتالية التفاعلية...</p>
        </div>
      ) : errorMsg ? (
        <div className="flex-1 flex flex-col justify-center items-center bg-[#070b16] p-6 text-center">
          <Compass className="w-12 h-12 text-rose-500 mb-2 animate-pulse" />
          <p className="text-sm font-bold text-slate-200">{errorMsg}</p>
        </div>
      ) : (
        <div className="flex-1 relative w-full h-full overflow-hidden select-none">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />

          {/* Dynamic Map Legend Overlay */}
          <div className="absolute top-16 md:top-4 right-4 z-[90] bg-slate-950/85 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3.5 text-[10px] md:text-xs font-bold text-slate-300">
            {displayMode === 'political' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-slate-500/40"></span>
                  <span>أقاليم ذات سيادة سياسية</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-slate-800"></span>
                  <span>مناطق دولية مفتوحة</span>
                </div>
              </>
            )}
            {displayMode === 'alliances' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-blue-500 shadow-md"></span>
                  <span>إمبراطوريتي الحالية</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-emerald-500"></span>
                  <span>حلفائي المشتركين</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-slate-500/50"></span>
                  <span>دول حيادية مستقلة (لا علاقة)</span>
                </div>
              </>
            )}
            {displayMode === 'war' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-rose-800 animate-pulse"></span>
                  <span>جبهات ساخنة وقوة حشد فتاكة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-slate-950"></span>
                  <span>قطاعات سلمية ومستقرة</span>
                </div>
              </>
            )}
            {displayMode === 'resources' && (
              <div className="flex flex-wrap items-center gap-2">
                <span>🪙 ذهب</span>
                <span>🛢️ نفط</span>
                <span>⛓️ حديد</span>
                <span>🌾 غذاء</span>
                <span>⚡ طاقة</span>
              </div>
            )}
          </div>

          {/* Guide Overlay for Unit Move placement ordering */}
          {unitMoveMode && selectedUnit && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-amber-500/90 border border-amber-300 text-slate-950 font-black text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
              <Navigation className="w-3.5 h-3.5 animate-pulse" />
              <span>اضغط على الخريطة لتوجيه فرقة [{selectedUnit.ownerCountryName}]</span>
            </div>
          )}

          {/* Floating HUD Panel for Selected Unit */}
          {selectedUnit && (
            <div className="absolute bottom-4 left-4 z-[100] bg-slate-950/95 border border-slate-800 rounded-2xl p-4 w-72 shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-start mb-3 border-b border-slate-800 pb-2.5">
                <div>
                  <h4 className="text-amber-400 font-extrabold text-sm leading-tight flex items-center gap-1.5 font-sans">
                    {selectedUnit.type === 'soldier' && '🪖'}
                    {selectedUnit.type === 'tank' && '🛡️'}
                    {selectedUnit.type === 'jet' && '✈️'}
                    {selectedUnit.type === 'missile' && '🚀'}
                    الفرقة العسكرية
                  </h4>
                  <p className="text-slate-400 text-[10px] mt-1 font-semibold">{selectedUnit.ownerCountryName}</p>
                </div>
                <div className="bg-black/80 px-2 py-1 rounded-lg border border-slate-800">
                  <span className="text-emerald-400 font-mono text-xs font-bold">{selectedUnit.hp}</span>
                  <span className="text-slate-500 font-mono text-[10px]">/{selectedUnit.maxHp} HP</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-900 font-mono">
                <p>الهجوم: <span className="text-rose-400 font-bold">{selectedUnit.attack}</span></p>
                <p>المدى: <span className="text-blue-400 font-bold">{selectedUnit.range}</span></p>
                <p className="col-span-2">الحالة: <span className="text-amber-400 font-bold">{selectedUnit.status === 'moving' ? 'تتحرك 🚀' : selectedUnit.status === 'fighting' ? 'تشتبك ⚔️' : 'متأهبة ✅'}</span></p>
              </div>

              {currentCountry?.id === selectedUnit.ownerCountryId && (
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUnitMoveMode(!unitMoveMode);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      unitMoveMode
                        ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {unitMoveMode ? 'إلغاء الأمر' : 'تحريك القوات 🚀'}
                  </button>
                  <button
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer bg-rose-900/80 hover:bg-rose-800 text-rose-200 border-rose-700/60 disabled:opacity-50"
                    disabled={selectedUnit.status === 'fighting'}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const { getDocs, query, where, collection, doc, updateDoc, deleteDoc, db } = await import('../lib/firebase');
                        const unitsSnapshot = await getDocs(query(collection(db, 'units'), where('matchId', '==', selectedMatchId)));
                        const enemies = unitsSnapshot.docs
                          .map((d) => ({ id: d.id, ...d.data() } as MapUnit))
                          .filter((u) => u.ownerCountryId !== currentCountry.id);

                        // Locate closest hostile troop unit
                        let closestEnemy: MapUnit | null = null;
                        let minDx = Infinity;
                        enemies.forEach((en) => {
                          const dist = Math.sqrt(Math.pow(en.lat - selectedUnit.lat, 2) + Math.pow(en.lng - selectedUnit.lng, 2));
                          if (dist < minDx) {
                            minDx = dist;
                            closestEnemy = en;
                          }
                        });

                        if (!closestEnemy || minDx > selectedUnit.range * 6) {
                          alert('لا توجد وحدات معادية قريبة في نطاق الهجوم العسكري!');
                          return;
                        }

                        // Set status to fighting in database
                        await updateDoc(doc(db, 'units', selectedUnit.id), { status: 'fighting', lastUpdatedAt: Date.now() });

                        alert(`اشتباك ناري مع قوات ${closestEnemy.ownerCountryName}! جاري احتساب المعركة (5 ثواني)...`);

                        setTimeout(async () => {
                          let enemyHp = closestEnemy!.hp - selectedUnit.attack;
                          let myHp = selectedUnit.hp - closestEnemy!.attack * 0.45;

                          if (enemyHp <= 0) {
                            await deleteDoc(doc(db, 'units', closestEnemy!.id));
                            alert('نجحت الضربة! تم إبادة الوحدة المعادية بالكامل.');
                          } else {
                            await updateDoc(doc(db, 'units', closestEnemy!.id), { hp: enemyHp });
                          }

                          if (myHp <= 0) {
                            await deleteDoc(doc(db, 'units', selectedUnit.id));
                            setSelectedUnit(null);
                          } else {
                            await updateDoc(doc(db, 'units', selectedUnit.id), { status: 'idle', hp: Math.round(myHp) });
                          }
                        }, 5000);
                      } catch (err) {
                        console.error('Combat execute failure:', err);
                      }
                    }}
                  >
                    {selectedUnit.status === 'fighting' ? 'يشتبك حاليًا...' : 'اشتباك هجومي ⚔️'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
