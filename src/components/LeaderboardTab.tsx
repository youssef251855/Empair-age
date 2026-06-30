/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { 
  Award, 
  Coins, 
  MapPin, 
  Compass, 
  ShieldCheck, 
  Sword,
  TrendingUp
} from 'lucide-react';

export const LeaderboardTab: React.FC = () => {
  const { countries, territories, alliances } = useGame();
  
  const [boardType, setBoardType] = useState<string>('territories');

  // Helpers to fetch metrics per country
  const getCountryTerritoriesCount = (cid: string) => {
    return territories.filter(t => t.ownerCountryId === cid).length;
  };

  // Compile datasets based on active toggle
  const sortedCountries = [...countries].sort((a, b) => {
    if (boardType === 'territories') {
      return getCountryTerritoriesCount(b.id) - getCountryTerritoriesCount(a.id);
    }
    return 0;
  });

  const sortedAlliances = [...alliances].sort((a, b) => {
    return (b.members?.length || 0) - (a.members?.length || 0);
  });

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <Award className="text-amber-500 w-6 h-6 shrink-0 animate-bounce" />
            التصنيف العام ولوحة الشرف الدولية
          </h2>
          <p className="text-sm text-slate-400">استكشف أقوى الكيانات، الإمبراطوريات الغنية، والأحلاف الأكثر سيطرة بمسرح المعارك.</p>
        </div>

        {/* Categories pickers */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setBoardType('territories')}
            className={`px-3.5 py-2 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${boardType === 'territories' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 border border-slate-800 hover:text-amber-400 text-slate-400'}`}
          >
            <MapPin className="w-4 h-4" />
            الأوسع نفوذاً (المناطق)
          </button>

          <button
            onClick={() => setBoardType('army')}
            className={`px-3.5 py-2 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${boardType === 'army' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 border border-slate-800 hover:text-amber-400 text-slate-400'}`}
          >
            <Sword className="w-4 h-4" />
            الترسانة والجيش
          </button>

          <button
            onClick={() => setBoardType('richest')}
            className={`px-3.5 py-2 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${boardType === 'richest' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 border border-slate-800 hover:text-amber-400 text-slate-400'}`}
          >
            <Coins className="w-4 h-4" />
            الذهب والخزينة والمال
          </button>

          <button
            onClick={() => setBoardType('alliance')}
            className={`px-3.5 py-2 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${boardType === 'alliance' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 border border-slate-800 hover:text-amber-400 text-slate-400'}`}
          >
            <ShieldCheck className="w-4 h-4" />
            الأحلاف الكبرى
          </button>
        </div>
      </div>

      {/* Render Leaderboards lists dynamically */}
      {boardType === 'alliance' ? (
        // Alliance score list view
        <div className="space-y-3">
          {sortedAlliances.length === 0 ? (
            <div className="text-center py-12 text-slate-500 xs:text-xs">
              لا تتواجد أحلاف دولية في السجل المشترك حالياً.
            </div>
          ) : (
            sortedAlliances.map((al, index) => (
              <div 
                key={al.id} 
                className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {/* Position Medal badge */}
                  <span className={`w-8 h-8 rounded-full font-black text-sm flex items-center justify-center font-mono select-none ${index === 0 ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : index === 1 ? 'bg-slate-300 text-slate-950' : index === 2 ? 'bg-amber-800 text-slate-100' : 'bg-slate-800 text-slate-400'}`}>
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 direction-rtl">
                      <h4 className="font-extrabold text-slate-200">{al.name}</h4>
                      <span className="bg-slate-850 px-2 py-0.5 rounded text-[10px] text-amber-500 border border-slate-800 font-mono font-black uppercase">
                        {al.tag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">الرئيس والمحور الرئيسي: {al.leaderCountryName}</p>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-xs bg-slate-950 text-amber-400 border border-slate-800 px-3 py-1.5 rounded-lg font-bold">
                    الأعضاء: <strong className="font-mono text-slate-100">{al.members?.length || 1}</strong>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // Country rankings list view
        <div className="space-y-3">
          {sortedCountries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              استعد لحشد قواك فالميدان فارغ ومفتوح للتنافس الشريف!
            </div>
          ) : (
            sortedCountries.map((c, index) => {
              const landCount = getCountryTerritoriesCount(c.id);

              return (
                <div 
                  key={c.id} 
                  className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 text-xs">
                    {/* Position Medal badge */}
                    <span className={`w-8 h-8 rounded-full font-black text-sm shrink-0 flex items-center justify-center font-mono select-none ${index === 0 ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : index === 1 ? 'bg-slate-300 text-slate-950' : index === 2 ? 'bg-amber-800 text-slate-100' : 'bg-slate-800 text-slate-400'}`}>
                      {index + 1}
                    </span>
                    
                    <span 
                      className="text-3xl filter drop-shadow select-none shrink-0" 
                      role="img" 
                      aria-label="Flag flag"
                    >
                      {c.flagUrl}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-slate-200">{c.name}</h4>
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-400">
                          {c.capital}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">الرئيس: <strong className="text-[#10b981]">{c.leaderName}</strong></p>
                    </div>
                  </div>

                  {/* Operational stats parameters */}
                  <div className="grid grid-cols-2 gap-3 text-right">
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-900 text-center min-w-[100px]">
                      <p className="text-[10px] text-slate-400">ترسانة وخزينة العدو</p>
                      <p className="text-xs font-black text-slate-500 font-mono mt-0.5 text-center">❓ مجهولة</p>
                    </div>

                    <div className="bg-slate-950/40 p-2 rounded border border-slate-900 text-center min-w-[100px]">
                      <p className="text-[10px] text-slate-400">المقاطعات</p>
                      <p className="text-sm font-black text-cyan-400 font-mono mt-0.5">{landCount}</p>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
