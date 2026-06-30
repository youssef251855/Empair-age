/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { BUILDING_DEFS, UNIT_DEFS } from '../lib/gameData';
import { Army } from '../types';
import { 
  Building2, 
  ShieldAlert, 
  ChevronUp, 
  Users, 
  Zap, 
  Percent, 
  Wrench, 
  Briefcase, 
  Flame, 
  HeartHandshake
} from 'lucide-react';

// Highly-polished tactical warfare units illustration assets
import infantryImg from '../assets/images/infantry_unit_1781367477292.jpg';
import tankImg from '../assets/images/tank_unit_1781367491965.jpg';
import jetImg from '../assets/images/fighter_jet_1781367509068.jpg';
import missileImg from '../assets/images/missile_unit_1781367527035.jpg';

export const DashboardTab: React.FC = () => {
  const { currentCountry, buildOrUpgrade, trainArmy, territories, selectedMatchId } = useGame();
  
  // Local unit training counters
  const [trainAmounts, setTrainAmounts] = useState<Record<string, number>>({
    infantry: 50,
    specialForces: 10,
    tanks: 5,
    artillery: 5,
    jets: 1,
    reconPlanes: 0,
    warships: 0,
    submarines: 0,
    missiles: 0
  });

  if (!currentCountry) return null;

  const handleTrainAmountChange = (unit: string, val: number) => {
    setTrainAmounts(prev => ({
      ...prev,
      [unit]: Math.max(0, val)
    }));
  };

  const handleExecuteTraining = async (unit: keyof Army) => {
    const amt = trainAmounts[unit] || 0;
    if (amt <= 0) return;
    try {
      await trainArmy(unit, amt);
      
      // Auto-spawn a visual map unit to fulfill user request: "وعندما ابني جيش يظهر كائن على المحافظات"
      // Generate a small cluster or at least 1 visual unit on the map for realistic feel
      if (unit === 'infantry' || unit === 'tanks' || unit === 'jets') {
          const uType = unit === 'infantry' ? 'soldier' : (unit === 'tanks' ? 'tank' : 'jet');
          let hp = 100, attack = 15, range = 2, speed = 5;
          if (uType === 'tank') { hp = 300; attack = 50; range = 3; speed = 3; } 
          else if (uType === 'jet') { hp = 150; attack = 80; range = 6; speed = 8; }
          
          import('../services/unitService').then(({ spawnUnit, updateUnitStatus }) => {
            const newUnitId = `unit_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            spawnUnit({
              id: newUnitId,
              matchId: selectedMatchId || '',
              ownerCountryId: currentCountry.id,
              ownerCountryName: currentCountry.name,
              color: currentCountry.color || '#f59e0b',
              type: uType,
              hp, maxHp: hp, attack, speed, range,
              // Spawn unit inside player's own territories, fallback to Middle-East (approximate)
              lat: (() => {
                const myTerrs = (territories || []).filter(t => t.ownerCountryId === currentCountry.id);
                if (myTerrs.length > 0) {
                  const selectedTerr = myTerrs[Math.floor(Math.random() * myTerrs.length)];
                  const finalLat = 90 - (selectedTerr.posY / 100) * 180;
                  return finalLat + (Math.random() * 1.0 - 0.5);
                }
                return 24.0 + (Math.random() * 5 - 2.5);
              })(),
              lng: (() => {
                const myTerrs = (territories || []).filter(t => t.ownerCountryId === currentCountry.id);
                if (myTerrs.length > 0) {
                  const selectedTerr = myTerrs[Math.floor(Math.random() * myTerrs.length)];
                  const finalLng = (selectedTerr.posX / 100) * 360 - 180;
                  return finalLng + (Math.random() * 1.0 - 0.5);
                }
                return 45.0 + (Math.random() * 5 - 2.5);
              })(),
              targetLat: null, targetLng: null,
              status: 'training' as any,
              lastUpdatedAt: Date.now()
            });

            setTimeout(() => {
              updateUnitStatus(newUnitId, 'idle');
            }, 10000); // 10 seconds of training time then it becomes idle
          });
      }

      alert(`الحمد لله! تم الانتهاء بنجاح من تدريب وحشد ${amt} من قوات [${UNIT_DEFS[unit]?.arabicName}] وإرسالهم للمخازن المركزية. وقد ظهرت أُفواج على خريطة المحافظات!`);
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. National Strategic Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Population & Migration card */}
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400">التعداد الوطني العام</p>
            <h4 className="text-xl font-black text-slate-100 mt-1 font-mono">
              {currentCountry.population.toLocaleString()} <span className="text-xs font-normal">نسمة</span>
            </h4>
            <p className="text-[10px] text-emerald-400 mt-0.5">📈 نمو إيجابي مستمر</p>
          </div>
          <Users className="text-cyan-400 w-10 h-10 bg-cyan-950/40 p-2 rounded-lg" />
        </div>

        {/* Unemployment stats */}
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400">معدل البطالة الكلية</p>
            <h4 className="text-xl font-black text-slate-100 mt-1 font-mono">
              {currentCountry.unemploymentRate}%
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">مؤشر الوظائف الصناعية</p>
          </div>
          <Briefcase className="text-emerald-400 w-10 h-10 bg-emerald-950/40 p-2 rounded-lg" />
        </div>

        {/* Tax Rate Controller */}
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400">الضرائب المفروضة</p>
            <h4 className="text-xl font-black text-slate-100 mt-1 font-mono">
              {currentCountry.taxRate}%
            </h4>
            <p className="text-[10px] text-amber-400 mt-0.5">العائد/ساعة: +{Math.floor((currentCountry.population / 10000) * (currentCountry.taxRate / 10))} ذهب</p>
          </div>
          <Percent className="text-amber-400 w-10 h-10 bg-amber-950/40 p-2 rounded-lg" />
        </div>

        {/* Current Energy Level */}
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400">المولدات الكهربائية</p>
            <h4 className="text-xl font-black text-slate-100 mt-1 font-mono">
              {currentCountry.electricity} <span className="text-xs font-normal">ميجاوات</span>
            </h4>
            <p className="text-[10px] text-yellow-400 mt-0.5">وضع الشبكة: مستقرة ⚡</p>
          </div>
          <Zap className="text-yellow-400 w-10 h-10 bg-yellow-950/40 p-2 rounded-lg" />
        </div>

      </div>

      {/* 2. Construction and Army Training Cabinets split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Buildings Construction list */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-2xl">
          <h2 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2 mb-4">
            <Building2 className="text-amber-500 w-5 h-5" />
            منشآت البنية التحتية والمصانع
          </h2>
          <p className="text-xs text-slate-400 mb-6">أنشئ وطور المصانع لتوليد الموارد الأساسية، وزيادة الوظائف للمواطنين.</p>

          <div className="space-y-4">
            {Object.entries(BUILDING_DEFS).map(([key, item]) => {
              const typedKey = key as keyof typeof BUILDING_DEFS;
              return (
                <div key={key} className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-200">{item.arabicName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-amber-400 border border-slate-700 font-mono">
                        المستوى 1
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                    <div className="text-[11px] text-[#10b981] font-semibold flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      الإنتاج: {item.production.description} (يستهلك {item.energyDemand} طاقة لتشغيله)
                    </div>
                    
                    {/* Construction Cost row */}
                    <div className="text-[10px] text-slate-400 pt-1.5 flex gap-3">
                      <span>الذهب: <strong className="text-amber-500">{item.cost.gold}</strong></span>
                      <span>الحديد: <strong className="text-slate-300">{item.cost.iron}</strong></span>
                      <span>النفط: <strong className="text-blue-400">{item.cost.oil}</strong></span>
                    </div>
                  </div>

                  {/* Construct Trigger */}
                  <button
                    onClick={() => buildOrUpgrade(typedKey)}
                    className="shrink-0 bg-gradient-to-l from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-bold text-xs px-4 py-2 border border-amber-400/30 rounded cursor-pointer transition-all hover:shadow-lg active:scale-95"
                  >
                    بناء / ترقية ➕
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Army Mobilization panel */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-2xl">
          <h2 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2 mb-4">
            <HeartHandshake className="text-red-500 w-5 h-5" />
            مجمع تدريب القوات والعتاد العسكري
          </h2>
          <p className="text-xs text-slate-400 mb-6">احشد كتائبك القتالية وزد الإمدادات المركزية لتأمين حمايتك أو غزو الأعداء.</p>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {Object.entries(UNIT_DEFS).map(([key, item]) => {
              const armyKey = key as keyof Army;
              const standingCount = currentCountry.army[armyKey] || 0;

              // Helper to resolve generated high-speed warfare images
              const getUnitImg = (unitId: string) => {
                if (unitId === 'infantry' || unitId === 'specialForces') return infantryImg;
                if (unitId === 'tanks' || unitId === 'artillery') return tankImg;
                if (unitId === 'jets' || unitId === 'reconPlanes') return jetImg;
                if (unitId === 'missiles') return missileImg;
                if (unitId === 'antiAir') return missileImg;
                return tankImg; // ships / sea fallback
              };

              return (
                <div key={key} className="bg-slate-900/40 p-4 rounded-lg border border-slate-800/80 hover:border-slate-700/60 transition-all">
                  <div className="flex gap-4 items-center mb-2">
                    <img 
                      src={(getUnitImg(key) as any)?.src || getUnitImg(key)} 
                      alt={item.arabicName} 
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-800 shadow-md shrink-0 filter brightness-95 hover:brightness-110 hover:scale-105 transition-all duration-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-200">
                            {item.arabicName} <span className="text-xs text-slate-500 font-normal">({item.name})</span>
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="text-xs bg-red-950/40 text-red-400 font-bold px-2 py-1 rounded border border-red-900">
                            متواجد: <strong className="font-mono text-slate-100">{standingCount}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Battle Parameters summary */}
                  <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 mb-3 pt-2.5 border-t border-slate-800/60">
                    <span>الهجوم: <strong className="text-rose-400">{item.power}</strong></span>
                    <span>الدفاع: <strong className="text-emerald-400">{item.defense}</strong></span>
                    <span>التكلفة الفردية: 💰{item.cost.gold} ذهب • ⚙️{item.cost.iron} حديد • 🛢️{item.cost.oil} نفط • 🌾{item.cost.food} غذاء</span>
                  </div>

                  {/* Amount train box */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300">الكمية:</span>
                      <input 
                        type="number" 
                        min="1"
                        value={trainAmounts[key] || 0}
                        onChange={(e) => handleTrainAmountChange(key, Number(e.target.value))}
                        className="w-20 bg-slate-950/80 border border-slate-800 text-slate-100 px-2 py-1 select-all font-mono text-center rounded text-xs"
                      />
                    </div>
                    
                    <button
                      onClick={() => handleExecuteTraining(armyKey)}
                      className="flex-1 bg-red-950/60 hover:bg-red-900 text-red-200 text-xs py-1.5 rounded font-bold cursor-pointer transition-all border border-red-900/60 active:scale-95 text-center"
                    >
                      تجنيد وحشد القوات ⚔️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
