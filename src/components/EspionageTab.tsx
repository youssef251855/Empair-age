/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { 
  Eye, 
  Search, 
  ShieldAlert, 
  Terminal, 
  UserX, 
  FileText, 
  Coins, 
  Droplet, 
  Zap 
} from 'lucide-react';

export const EspionageTab: React.FC = () => {
  const { currentCountry, countries, spies, executeEspionage } = useGame();
  
  const [targetId, setTargetId] = useState<string>('');
  const [missionType, setMissionType] = useState<'intel' | 'steal_oil' | 'steal_gold' | 'sabotage_defense'>('intel');
  const [executing, setExecuting] = useState<boolean>(false);

  if (!currentCountry) return null;

  // Filter out player's own country
  const potentialTargets = countries.filter(c => c.id !== currentCountry.id);
  
  // Players' spies logs history list sorting newest first
  const playerSpiesLogs = spies
    .filter(s => s.ownerCountryId === currentCountry.id)
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  const handleLaunchSpyMission = async () => {
    if (!targetId) {
      alert("الرجاء اختيار الدولة المستهدفة أولاً!");
      return;
    }
    
    setExecuting(true);
    try {
      await executeEspionage(targetId, missionType);
      alert("تم إرجاع التقرير المركزي السري! افحص لوحة سجل الجاسوسية بالأسفل للاطلاع على النتائج العسكرية.");
    } catch (e) {
      console.error(e);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* 1. Send spy and target selection widget */}
      <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2 mb-2">
            <Eye className="text-amber-500 w-5 h-5 animate-pulse" />
            شعبة الاستخبارات والعمليات السرية
          </h2>
          <p className="text-xs text-slate-400 mb-6 font-sans">
            قم بتجنيد وتكليف عناصر النخبة المدربين من القوات الخاصة لتنفيذ غارات صامتة أو سرقة خزينة الخصوم الاقتصادية والعسكرية.
          </p>

          <div className="space-y-4">
            {/* Target selection */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">اختر الدولة الهدف للعملية</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2.5 rounded focus:border-amber-500 focus:outline-none"
              >
                <option value="">-- اضغط للاختيار والتكليف --</option>
                {potentialTargets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flagUrl} {c.name} (القائد: {c.leaderName})
                  </option>
                ))}
              </select>
            </div>

            {/* Mission select options */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">نوع المهمة الموكلة للعميل</label>
              <div className="space-y-2">
                
                {/* Intel mission */}
                <label className="p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="mission_type"
                    value="intel"
                    checked={missionType === 'intel'}
                    onChange={() => setMissionType('intel')}
                    className="accent-amber-500 shrink-0"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">استطلاع عسكري وحصد معلومات</h4>
                    <p className="text-[10px] text-slate-400">تقييم ترسانة العدو وحيازة صور القواعد الساحلية والسرية.</p>
                  </div>
                </label>

                {/* Heist oil */}
                <label className="p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="mission_type"
                    value="steal_oil"
                    checked={missionType === 'steal_oil'}
                    onChange={() => setMissionType('steal_oil')}
                    className="accent-amber-500 shrink-0"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">قرصنة وتخريب ناقلات النفط (🛢️)</h4>
                    <p className="text-[10px] text-slate-400">استحواذ وسرقة ما نسبته 15% من الخزان البترولي للخصم.</p>
                  </div>
                </label>

                {/* Heist Gold */}
                <label className="p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="mission_type"
                    value="steal_gold"
                    checked={missionType === 'steal_gold'}
                    onChange={() => setMissionType('steal_gold')}
                    className="accent-amber-500 shrink-0"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">اختراق الخزانة وسرقة السبائك (💰)</h4>
                    <p className="text-[10px] text-slate-400">تحويل 12% من سبائك الخزينة الذهبية لتمويل خزائن دولتك العظيمة.</p>
                  </div>
                </label>

                {/* Defense sabotage */}
                <label className="p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="mission_type"
                    value="sabotage_defense"
                    checked={missionType === 'sabotage_defense'}
                    onChange={() => setMissionType('sabotage_defense')}
                    className="accent-amber-500 shrink-0"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">تخريب الثكنات العسكرية وتصفية الجنود</h4>
                    <p className="text-[10px] text-slate-400">تفجير خنادق حرس الحدود مما يقلل دفاع وحجم المشاة التابعين لهم بـ 20%.</p>
                  </div>
                </label>

              </div>
            </div>
          </div>
        </div>

        {/* Cost and Trigger */}
        <div className="mt-6 border-t border-slate-850 pt-4">
          <div className="text-xs bg-amber-500/10 border border-amber-500/20 rounded p-2 text-amber-400 font-bold text-center mb-3">
            تكلفة البعثة السرية: 💰150 ذهب سائل لبدء التسلل الميداني
          </div>

          <button
            onClick={handleLaunchSpyMission}
            disabled={executing}
            className="w-full bg-amber-500 disabled:opacity-50 hover:bg-amber-600 font-extrabold text-slate-950 text-xs py-3 rounded tracking-wide transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 text-center"
          >
            {executing ? 'تسلل العميل بنطاق الرصد...' : 'إطلاق عميل المخابرات الفيدرالية 📡'}
          </button>
        </div>
      </div>

      {/* 2. Scrolling history reports logging console */}
      <div className="lg:col-span-8 bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2 mb-2">
            <Terminal className="text-emerald-500 w-5 h-5" />
            السجل الاستخباراتي والبرقيات الدبلوماسية
          </h2>
          <p className="text-xs text-slate-400 mb-4">يعرض نتائج التسلل الأخير، نسبة تسرب المعلومات، والتقارير الموثقة.</p>

          {playerSpiesLogs.length === 0 ? (
            <div className="text-center py-20 text-slate-500 bg-slate-950/40 rounded-lg border border-slate-900 flex flex-col justify-center items-center">
              <FileText className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-bold">لا يوجد سجل عمليات استخباراتية سابقة.</p>
              <p className="text-xs mt-1 text-slate-600">اختر بلداً معادياً لتدشين الضربات والغارات التجسسية الصامتة.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {playerSpiesLogs.map((spy) => (
                <div 
                  key={spy.id}
                  className={`border p-4 rounded-lg flex flex-col gap-3 font-sans transition-all shadow-md ${spy.status === 'caught' ? 'bg-rose-950/20 border-rose-900/60' : 'bg-slate-900/60 border-slate-800'}`}
                >
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <div className="text-xs flex items-center gap-2">
                      <span className="font-extrabold text-slate-200">الهدف: {spy.targetCountryName}</span>
                      <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold leading-none capitalize ${spy.mission === 'intel' ? 'bg-blue-500/10 text-blue-400 border border-blue-900/40' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {spy.mission === 'intel' && 'جمع بيانات عسكرية'}
                        {spy.mission === 'steal_oil' && 'قرصنة آبار البترول'}
                        {spy.mission === 'steal_gold' && 'نهب سبائك الخزانة'}
                        {spy.mission === 'sabotage_defense' && 'تخريب التحصينات'}
                      </span>
                    </div>

                    <div className="text-xs">
                      {spy.status === 'caught' ? (
                        <span className="text-rose-400 font-extrabold flex items-center gap-1">
                          <UserX className="w-3.5 h-3.5 shrink-0" /> تصفية العميل ومصادرته
                        </span>
                      ) : (
                        <span className="text-[#10b981] font-black">✔️ البعثة تكللت بالنجاح</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 bg-slate-950/60 p-3 rounded text-xs leading-relaxed font-mono text-slate-300">
                    {spy.logs?.map((line, lidx) => (
                      <p key={lidx} className="flex gap-2">
                        <span className="text-[#10b981] font-bold shrink-0">&gt;</span>
                        <span>{line}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-rose-400 mt-4 bg-rose-950/10 border border-rose-900/20 p-2.5 rounded flex items-center gap-2 justify-center">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>تنبيه: تتكبد الدولة خطر غرامات قاسية وفضائح دبلوماسية في حال رصد جواسيسكم متلبسين داخل عواصم الجوار.</span>
        </div>

      </div>

    </div>
  );
};
