/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useGame } from '../context/GameContext';
import { 
  Coins, 
  Droplet, 
  Compass, 
  Flame, 
  Users, 
  Zap, 
  LogOut, 
  ShieldAlert, 
  CalendarClock, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const ResourceHeader: React.FC = () => {
  const { currentCountry, logout, activeSeason, territories, harvestLocalTick, selectedMatchId, matches, rechargeCredits } = useGame();

  if (!currentCountry) return null;

  const playerTerritoriesCount = territories.filter(t => t.ownerCountryId === currentCountry.id).length;

  const currentMatch = matches.find(m => m.id === selectedMatchId);

  const getGameTime = () => {
    if (!currentMatch) return 'يوم 1 | 12:00';
    const start = new Date(currentMatch.createdAt || Date.now()).getTime();
    const elapsedMs = Date.now() - start;
    const elapsedRealHours = elapsedMs / (1000 * 60 * 60);
    const elapsedGameHours = elapsedRealHours * 3; // 1 real hour = 3 game hours!
    
    const totalGameMinutes = Math.floor(elapsedGameHours * 60);
    const gameDays = Math.floor(totalGameMinutes / (24 * 60)) + 1;
    const remainingMinutes = totalGameMinutes % (24 * 60);
    const gameHour = Math.floor(remainingMinutes / 60);
    const gameMinute = remainingMinutes % 60;
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `اليوم ${gameDays} | ${pad(gameHour)}:${pad(gameMinute)}`;
  };

  return (
    <div className="bg-[#111827]/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 px-3 md:px-4 py-2.5 md:py-3 text-slate-100 shadow-xl font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-2 md:gap-3">
        
        {/* Flag, General Bio, and Alliance Status in responsive wrap flow */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-800/50 sm:border-b-0 sm:pb-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src="https://yousst4youssef.rf.gd/uploads/file_1781366556_1074_0.png" 
              alt="Empire Age Logo" 
              referrerPolicy="no-referrer"
              className="w-10 h-10 object-contain filter drop-shadow-[0_0_8px_rgba(245,158,11,0.35)] shrink-0"
            />
            <span 
              className="text-3xl md:text-4xl filter drop-shadow select-none animate-bounce shrink-0" 
              role="img" 
              aria-label="Flag"
            >
              {currentCountry.flagUrl}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h1 className="text-base md:text-xl font-extrabold text-[#f1f5f9] tracking-wide truncate max-w-[170px] sm:max-w-none">{currentCountry.name}</h1>
                <span 
                  className="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] uppercase font-bold shrink-0"
                  style={{ backgroundColor: `${currentCountry.color}22`, color: currentCountry.color, border: `1px solid ${currentCountry.color}44` }}
                >
                  {currentCountry.capital} (العاصمة)
                </span>
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 truncate">القائد الإمبراطوري: <span className="text-amber-400 font-semibold">{currentCountry.leaderName}</span></p>
            </div>
          </div>

          {/* Connected alliances shield indicator */}
          <div className="flex items-center gap-1.5 self-start sm:self-center bg-slate-800/60 px-2 py-0.5 sm:py-1 rounded text-[11px] md:text-xs border border-slate-700/80 shrink-0">
            <span className="text-slate-400">الحلف:</span>
            <span className="text-amber-500 font-bold">{currentCountry.allianceName || 'مستقل'}</span>
          </div>
        </div>

        {/* Dynamic Resource Numbers dashboard grid - Mathematically Symmetrical row splits on Phone viewport */}
        <div className="grid grid-cols-4 md:grid-cols-7 gap-1 md:gap-2 bg-slate-900/50 p-1 md:p-1.5 rounded-xl border border-slate-800">
          
          {/* Gold */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-slate-950/60 px-1.5 md:px-3 py-1 md:py-1.5 rounded border border-slate-800/80 col-span-1 min-w-0">
            <Coins className="text-amber-400 w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate hidden md:block">الخزانة والذهب</p>
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate block md:hidden">الذهب</p>
              <p className="text-[10px] md:text-xs font-mono font-bold text-amber-300 truncate">{currentCountry.gold.toLocaleString()}</p>
            </div>
          </div>

          {/* Oil */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-slate-950/60 px-1.5 md:px-3 py-1 md:py-1.5 rounded border border-slate-800/80 col-span-1 min-w-0">
            <Droplet className="text-blue-400 w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate hidden md:block">النفط الخام</p>
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate block md:hidden">النفط</p>
              <p className="text-[10px] md:text-xs font-mono font-bold text-blue-300 truncate">{currentCountry.oil.toLocaleString()}</p>
            </div>
          </div>

          {/* Iron */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-slate-950/60 px-1.5 md:px-3 py-1 md:py-1.5 rounded border border-slate-800/80 col-span-1 min-w-0">
            <Compass className="text-slate-400 w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate hidden md:block">المعادن والحديد</p>
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate block md:hidden">الحديد</p>
              <p className="text-[10px] md:text-xs font-mono font-bold text-slate-200 truncate">{currentCountry.iron.toLocaleString()}</p>
            </div>
          </div>

          {/* Food */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-slate-950/60 px-1.5 md:px-3 py-1 md:py-1.5 rounded border border-slate-800/80 col-span-1 min-w-0">
            <Flame className="text-emerald-400 w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate hidden md:block">مخازن الغذاء</p>
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate block md:hidden">الغذاء</p>
              <p className="text-[10px] md:text-xs font-mono font-bold text-emerald-300 truncate">{currentCountry.food.toLocaleString()}</p>
            </div>
          </div>

          {/* Electricity */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-slate-950/60 px-1.5 md:px-3 py-1 md:py-1.5 rounded border border-slate-800/80 col-span-1 min-w-0">
            <Zap className="text-yellow-400 w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate hidden md:block">المولد الذري</p>
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate block md:hidden">طاقة</p>
              <p className="text-[10px] md:text-xs font-mono font-bold text-yellow-300 truncate">{currentCountry.electricity}/500</p>
            </div>
          </div>

          {/* Premium Credits Display 💎 */}
          <div className="flex items-center justify-between bg-slate-950/80 px-1.5 md:px-2 animate-pulse py-1 rounded border border-amber-500/30 col-span-2 md:col-span-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <Sparkles className="text-amber-400 w-3.5 h-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[8px] text-slate-400 truncate hidden md:block">سندات إمبراطورية</p>
                <p className="text-[8px] text-slate-400 truncate block md:hidden">سندات 💎</p>
                <p className="text-[10px] md:text-[11px] font-bold text-amber-300 font-mono truncate">{(currentCountry.empireCredits || 0).toLocaleString()}</p>
              </div>
            </div>
            <button 
              onClick={rechargeCredits}
              title="شحن مجاني فوري"
              className="text-[9px] bg-amber-500 hover:bg-amber-600 text-slate-950 px-1 py-0.5 font-black rounded shrink-0 cursor-pointer ml-1 active:scale-95 transition-all"
            >
              +
            </button>
          </div>

          {/* Population */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-slate-950/60 px-1.5 md:px-3 py-1 md:py-1.5 rounded border border-slate-800/80 col-span-1 min-w-0">
            <Users className="text-cyan-400 w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate hidden md:block">تعداد السكان</p>
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate block md:hidden">سكان</p>
              <p className="text-[10px] md:text-xs font-mono font-bold text-cyan-300 truncate">{(currentCountry.population / 1000).toFixed(0)}K</p>
            </div>
          </div>
        </div>

        {/* Seasonal Stats & Logouts Actions container */}
        <div className="flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar py-0.5">
          
          <div className="flex items-center gap-2">
            {/* Game Imperial Clock (1 hour real-time = 3 game hours) */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-amber-500/30 shadow-inner shrink-0">
              <CalendarClock className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
              <div className="text-right">
                <span className="text-[8px] text-amber-400 font-bold leading-none mb-0.5 hidden md:block">ساعة الإمبراطورية (1س = 3س)</span>
                <span className="text-[8px] text-amber-400 font-bold leading-none mb-0.5 block md:hidden">ساعة القيادة</span>
                <span className="font-mono text-[10px] md:text-[11px] font-black text-slate-100 leading-none">{getGameTime()}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-slate-800 shrink-0">
              <CalendarClock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <div className="text-right">
                <span className="text-[8px] md:text-[10px] text-slate-400 block leading-none mb-0.5">الموسم</span>
                <span className="font-bold text-amber-400 text-[10px] md:text-xs leading-none">{activeSeason ? `#${activeSeason.number}` : '#1'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Manual harvest button loop to show ticking logic helper */}
            <button 
              onClick={harvestLocalTick}
              title="تحديث الاقتصاد الآن وجني الضرائب"
              className="p-1.5 md:p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>

            {/* Sign out */}
            <button
              onClick={logout}
              className="flex items-center gap-1 bg-rose-950/50 hover:bg-rose-900 border border-rose-800/80 text-rose-200 text-[10px] md:text-xs px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg cursor-pointer transition-all shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">تسجيل خروج</span>
              <span className="inline sm:hidden">خروج</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
