import React from 'react';
import { useGame } from '../context/GameContext';
import { Newspaper, TrendingUp, Flag, EyeOff } from 'lucide-react';

export const NewsTab: React.FC = () => {
  const { currentCountry, countries } = useGame();

  if (!currentCountry) return null;

  // Simulate calculating the most economically powerful countries.
  // In a real scenario, this would trigger periodically on the backend or game loop.
  const sortedByEconomy = [...countries].sort((a, b) => b.gold - a.gold);

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <Newspaper className="w-8 h-8 text-blue-400" />
        <div>
          <h2 className="text-xl font-black text-slate-100">النشرة الإخبارية الدولية</h2>
          <p className="text-xs text-slate-400 mt-1">تحديثات دورية تتضمن تقارير عن القوى الاقتصادية والعسكرية العظمى وفقاً لتسريبات الاستخبارات.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500"></div>
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-200">أقوى الاقتصادات على الساحة الدولية</h3>
          </div>
          
          <div className="space-y-3">
            {sortedByEconomy.slice(0, 5).map((nation, index) => (
              <div key={nation.id} className="flex justify-between items-center bg-slate-950/60 p-3 rounded border border-slate-800 transition-hover hover:border-slate-600">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-black text-slate-500 w-4">{index + 1}.</span>
                  <span className="text-lg">{nation.flagUrl || '🏳️'}</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">{nation.name}</span>
                    <span className="text-[9px] text-slate-500">الحاكم: {nation.leaderName}</span>
                  </div>
                </div>
                <div className="text-left font-mono">
                  <span className="text-xs text-amber-500 font-bold">ميزانية ضخمة مصنفة سريا</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500"></div>
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <Flag className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-slate-200">لمحة من الترسانة العسكرية</h3>
          </div>
          
          <div className="space-y-3">
            {sortedByEconomy.slice(0, 5).map((nation) => (
              <div key={nation.id} className="flex justify-between items-center bg-slate-950/60 p-3 rounded border border-slate-800 transition-hover hover:border-slate-600">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{nation.flagUrl || '🏳️'}</span>
                  <span className="text-xs font-bold text-slate-300">{nation.name}</span>
                </div>
                <div className="text-left">
                  {nation.id === currentCountry.id ? (
                    <div className="text-[10px] text-slate-400 font-mono">
                      <span className="text-rose-400 font-bold">{nation.army.tanks || 0} دبابات</span> | المشاة: {nation.army.infantry || 0}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-60">
                      <EyeOff className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500">معلومات محجوبة (يتطلب تجسس)</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
