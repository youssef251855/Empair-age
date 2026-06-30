import React, { useEffect, useRef, useState } from 'react';
import { PixiMapEngine } from '../../game/pixi/PixiMapEngine';
import { useGame } from '../../context/GameContext';
import { listenToUnits } from '../../services/unitService';

interface PixiMapProps {
  onSelectProvince: (id: string) => void;
  selectedProvinceId: string | null;
}

export const PixiMapWrapper: React.FC<PixiMapProps> = ({ onSelectProvince, selectedProvinceId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PixiMapEngine | null>(null);
  const { territories, loading, selectedMatchId } = useGame();
  const [engineReady, setEngineReady] = useState(false);
  const [geoJsonFeatures, setGeoJsonFeatures] = useState<any[] | null>(null);

  // 1. Initialize PIXI engine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new PixiMapEngine();
    
    // Read user preference
    const quality = localStorage.getItem('graphicsQuality') || 'high';
    const isLow = quality === 'low';

    engine.init({
      container: containerRef.current,
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 500,
      lowGraphics: isLow
    }).then(() => {
      engine.onFeatureClick = onSelectProvince;
      engineRef.current = engine;
      setEngineReady(true);
    });

    const handleResize = () => {
      if (engineRef.current && containerRef.current) {
        engineRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []); // Run once on mount

  // 2. Fetch GeoJSON features once
  useEffect(() => {
    if (!engineReady || !engineRef.current || geoJsonFeatures) return;
    
    fetch('/assets/maps/countries-50m.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.features) {
          setGeoJsonFeatures(data.features);
          if (engineRef.current) {
            engineRef.current.renderMapPolygons(data.features, territories, selectedProvinceId, selectedMatchId);
          }
        }
      })
      .catch(err => console.error("Could not load map json:", err));
      
  }, [engineReady]);

  // 3. Update political colors dynamically on database updates (Zero Fetch!)
  useEffect(() => {
    if (!engineReady || !engineRef.current || !geoJsonFeatures) return;
    
    engineRef.current.drawMap(territories, selectedProvinceId, selectedMatchId);
  }, [territories, selectedProvinceId, selectedMatchId, geoJsonFeatures, engineReady]);

  // 4. Update units state
  useEffect(() => {
     if (!engineReady || !engineRef.current || !selectedMatchId) return;
     
     const unsubscribeUnits = listenToUnits(selectedMatchId, (liveUnits) => {
        if (engineRef.current) {
          engineRef.current.updateUnits(liveUnits);
        }
     });

     return () => {
       unsubscribeUnits();
     };
  }, [engineReady, selectedMatchId]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[420px] md:h-[600px] relative bg-slate-900 border border-slate-800 shadow-2xl rounded-xl overflow-hidden" 
    />
  );
};
