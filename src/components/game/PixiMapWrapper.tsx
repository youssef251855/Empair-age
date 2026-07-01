import React, { useEffect, useRef, useState } from 'react';
import { Compass, Shield, Flame, Zap, Maximize2, Plus, Minus } from 'lucide-react';
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
  
  const [displayMode, setDisplayMode] = useState<'political' | 'alliances' | 'war' | 'resources'>('political');

  // Track previous battle statuses to detect NEW attacks
  const prevBattleStatusRef = useRef<Record<string, string>>({});

  // Sync displayMode
  useEffect(() => {
    if (engineReady && engineRef.current) {
      engineRef.current.setDisplayMode(displayMode);
    }
  }, [displayMode, engineReady]);

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
    <div className="relative w-full h-[420px] md:h-[600px] bg-[#020617] rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col shadow-black/80 font-sans">
      <div 
        ref={containerRef} 
        className="absolute inset-0 z-0" 
      />
      
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
          onClick={() => engineRef.current?.recenter()}
          className="bg-slate-950/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-amber-400 p-2.5 rounded-xl shadow-xl cursor-pointer transition-all flex items-center justify-center backdrop-blur-md"
          title="إعادة تركيز الخريطة"
        >
          <Maximize2 className="w-4.5 h-4.5" />
        </button>
        <button
          onClick={() => engineRef.current?.zoomIn()}
          className="bg-slate-950/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-amber-400 p-2.5 rounded-xl shadow-xl cursor-pointer transition-all flex items-center justify-center backdrop-blur-md"
          title="تكبير"
        >
          <Plus className="w-4.5 h-4.5" />
        </button>
        <button
          onClick={() => engineRef.current?.zoomOut()}
          className="bg-slate-950/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-amber-400 p-2.5 rounded-xl shadow-xl cursor-pointer transition-all flex items-center justify-center backdrop-blur-md"
          title="تصغير"
        >
          <Minus className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
};
