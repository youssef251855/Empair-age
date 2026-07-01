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
  const { territories, loading, selectedMatchId, currentCountry } = useGame();
  const [engineReady, setEngineReady] = useState(false);
  const [geoJsonFeatures, setGeoJsonFeatures] = useState<any[] | null>(null);
  
  // Refs for stale closures in event listeners
  const currentCountryRef = useRef(currentCountry);
  useEffect(() => { currentCountryRef.current = currentCountry; }, [currentCountry]);
  
  // Track previous battle statuses to detect NEW attacks
  const prevBattleStatusRef = useRef<Record<string, string>>({});

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

  // 3. Update political colors dynamically on database updates (Zero Fetch!) & Trigger FX
  useEffect(() => {
    if (!engineReady || !engineRef.current || !geoJsonFeatures) return;
    
    engineRef.current.drawMap(territories, selectedProvinceId, selectedMatchId);
    
    // Detect new battles to launch fx
    const myId = currentCountryRef.current?.id;
    territories.forEach(terr => {
      const prevStatus = prevBattleStatusRef.current[terr.id];
      if (terr.battleStatus === 'clashing' && prevStatus !== 'clashing') {
        // Only show to attacker and defender
        if (myId && (terr.battleAttackerId === myId || terr.ownerCountryId === myId)) {
           // Find attacker's starting territory (capital or random territory)
           const attackerStartTerr = territories.find(t => t.ownerCountryId === terr.battleAttackerId && t.isCapital) 
                                  || territories.find(t => t.ownerCountryId === terr.battleAttackerId);
           if (attackerStartTerr) {
             // We need color of attacker
             const attackerColor = attackerStartTerr.color || '#ef4444';
             engineRef.current?.launchInvasionMarch(
                attackerStartTerr.posY, attackerStartTerr.posX,
                terr.posY, terr.posX,
                attackerColor,
                30
             );
           }
        }
      }
      prevBattleStatusRef.current[terr.id] = terr.battleStatus || 'idle';
    });
    
  }, [territories, selectedProvinceId, selectedMatchId, geoJsonFeatures, engineReady]);

  // 4. Update units state
  useEffect(() => {
     if (!engineReady || !engineRef.current || !selectedMatchId) return;
     
     const unsubscribeUnits = listenToUnits(selectedMatchId, (liveUnits) => {
        if (engineRef.current) {
          // Filter units: User only sees their own units, or units from countries that are currently attacking them.
          const myCountryId = currentCountry?.id;
          const attackersOfMyCountry = new Set(
            territories
              .filter(t => t.ownerCountryId === myCountryId && t.battleStatus === 'clashing' && t.battleAttackerId)
              .map(t => t.battleAttackerId)
          );
          
          const visibleUnits = liveUnits.filter(unit => {
            // Admins or observers might not have a country, they see nothing or everything? 
            // If we have no country, we show nothing (or everything, let's say nothing to be safe)
            if (!myCountryId) return false;
            
            // Show if it's my unit
            if (unit.ownerCountryId === myCountryId) return true;
            
            // Show if the unit belongs to an attacker currently attacking my country
            if (attackersOfMyCountry.has(unit.ownerCountryId)) return true;
            
            return false;
          });
          
          engineRef.current.updateUnits(visibleUnits);
        }
     });

     return () => {
       unsubscribeUnits();
     };
  }, [engineReady, selectedMatchId, currentCountry?.id, territories]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[420px] md:h-[600px] relative bg-slate-900 border border-slate-800 shadow-2xl rounded-xl overflow-hidden" 
    />
  );
};
