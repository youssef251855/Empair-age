/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { 
  ShieldCheck, 
  Users, 
  Plus, 
  LogOut, 
  Coins, 
  Droplet, 
  Compass, 
  Flame, 
  Send, 
  FolderLock 
} from 'lucide-react';

export const AllianceTab: React.FC = () => {
  const { 
    currentCountry, 
    alliances, 
    createAlliance, 
    joinAlliance, 
    leaveAlliance, 
    donateResourceToAlliance 
  } = useGame();

  const [allianceNameInput, setAllianceNameInput] = useState<string>('');
  const [allianceTagInput, setAllianceTagInput] = useState<string>('');
  const [allianceDescInput, setAllianceDescInput] = useState<string>('');

  // Donation state
  const [donateType, setDonateType] = useState<'gold' | 'oil' | 'iron' | 'food'>('gold');
  const [donateAmount, setDonateAmount] = useState<number>(100);

  if (!currentCountry) return null;

  const handleCreateAlliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allianceNameInput || !allianceTagInput) {
      alert("الرجاء تحديد الاسم والشعار المختصر بدقة!");
      return;
    }
    try {
      await createAlliance(allianceNameInput, allianceTagInput, allianceDescInput);
      alert(`مبروك! تم تأسيس حلف [${allianceNameInput}] بنجاح وتوثيقه في السجلات الإقليمية.`);
      setAllianceNameInput('');
      setAllianceTagInput('');
      setAllianceDescInput('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDonate = async () => {
    if (donateAmount <= 0) return;
    try {
      await donateResourceToAlliance(donateType, donateAmount);
      alert(`تم تحويل ${donateAmount} من الأسلحة/الموارد بنجاح لخزينة الحلف المشتركة.`);
    } catch(err) {
      console.error(err);
    }
  };

  const playerAlliance = alliances.find(a => a.id === currentCountry.allianceId);

  return (
    <div className="space-y-6">
      
      {playerAlliance ? (
        // --- 1. VIEW OF USER IN AN ALLIANCE ---
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Info and Shared Vault */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Alliance Bio Banner */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl"></div>
              
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-amber-500 w-10 h-10 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-slate-100">{playerAlliance.name}</h2>
                    <span className="px-2.5 py-0.5 rounded text-xs bg-amber-500 text-slate-950 font-black tracking-widest font-mono">
                      {playerAlliance.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">المؤسس أو المتحدث الرسمي: {playerAlliance.leaderCountryName}</p>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-800/80 pt-4 text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-lg">
                <span className="text-amber-400 font-bold block mb-1">بيان الميثاق العسكري والتحالف الدولي:</span>
                {playerAlliance.description || "لم يكتب ميثاق خاص بهذا الحلف بعد، تواصل مع مؤسس الحلف لوضع رؤى وخطة واضحة."}
              </div>
            </div>

            {/* Shared Coalition Treasury Vault */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FolderLock className="text-amber-500 w-4 h-4" />
                خزينة الإمدادات الاستراتيجية للحلف
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                
                {/* Gold Pool */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
                  <Coins className="text-amber-400 w-5 h-5 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-400">الذهب المشترك</p>
                  <p className="text-sm font-black font-mono text-amber-300 mt-0.5">
                    {playerAlliance.resourcePool?.gold || 0}
                  </p>
                </div>

                {/* Oil Pool */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
                  <Droplet className="text-blue-400 w-5 h-5 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-400">الوقود والنفط</p>
                  <p className="text-sm font-black font-mono text-blue-300 mt-0.5">
                    {playerAlliance.resourcePool?.oil || 0}
                  </p>
                </div>

                {/* Iron Pool */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
                  <Compass className="text-slate-300 w-5 h-5 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-400">الحديد والمعادن</p>
                  <p className="text-sm font-black font-mono text-slate-200 mt-0.5">
                    {playerAlliance.resourcePool?.iron || 0}
                  </p>
                </div>

                {/* Food Pool */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
                  <Flame className="text-emerald-400 w-5 h-5 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-400">الحبوب والغذاء</p>
                  <p className="text-sm font-black font-mono text-emerald-300 mt-0.5">
                    {playerAlliance.resourcePool?.food || 0}
                  </p>
                </div>

              </div>

              {/* Donation module Form */}
              <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-200">دعم قوافل الإمداد العسكري</h4>
                  <p className="text-[10px] text-slate-400">تبرع بمجهودك الفردي لتنمية المجهود الحربي المشترك للحلف.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={donateType}
                    onChange={(e) => setDonateType(e.target.value as any)}
                    className="bg-slate-900 text-slate-200 text-xs px-2 py-1.5 border border-slate-800 rounded"
                  >
                    <option value="gold">الذهب (💰)</option>
                    <option value="oil">النفط (🛢️)</option>
                    <option value="iron">الحديد (⚙️)</option>
                    <option value="food">الغذاء (🌾)</option>
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={donateAmount}
                    onChange={(e) => setDonateAmount(Number(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-800 text-xs text-slate-100 p-1.5 text-center font-mono rounded"
                  />

                  <button
                    onClick={handleDonate}
                    className="bg-amber-500 hover:bg-amber-600 font-bold text-slate-950 text-xs px-4 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    تحويل
                  </button>
                </div>
              </div>

            </div>

          </div>

          {/* Members list & Exit Alliance */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Coalition Roster */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="text-slate-400 w-4 h-4" />
                رابطة الدول الأعضاء بالحلف
              </h3>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {playerAlliance.members?.map((m, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-2.5 rounded border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span>{m.flagEmoji || '🏳️'}</span>
                      <strong className="text-slate-200 font-semibold">{m.countryName}</strong>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded leading-none ${m.role === 'leader' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700/30 text-slate-400'}`}>
                      {m.role === 'leader' ? 'قائد الحلف' : 'حليف معاهد'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Exit out */}
              <div className="pt-4 border-t border-slate-800/80 mt-4">
                <button
                  onClick={async () => {
                    const confirm = window.confirm("هل أنت متأكد من رغبتك بالانسحاب من التحالف؟ الانسحاب يفقدك الصداقات المشتركة وميزانية الدعم!");
                    if (confirm) {
                      await leaveAlliance();
                      alert("انسحبت بسلام من ميثاق التحالف.");
                    }
                  }}
                  className="w-full bg-rose-950/70 hover:bg-rose-900 border border-rose-800 hover:text-white text-rose-200 py-2 rounded text-xs px-3 transition-all cursor-pointer flex items-center justify-center gap-1.5 font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  مغادرة التحالف أو تفكيك الميثاق
                </button>
              </div>

            </div>

          </div>

        </div>
      ) : (
        // --- 2. JOIN OR CREATE ALLIANCE INTERFACES ---
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Formulator for new alliance */}
          <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-xl">
            <h3 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2 mb-2">
              <Plus className="text-amber-500 w-5 h-5" />
              تأسيس تحالف عسكري جديد
            </h3>
            <p className="text-xs text-slate-400 mb-6">يتطلب تشريع وتدوين حلف متكامل 500 قطعة ذهبية ككلفة تشغيل وتعديل للمدرجات الاستراتيجية.</p>

            <form onSubmit={handleCreateAlliance} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">اسم الحلف بالكامل</label>
                <input
                  type="text"
                  placeholder="مثال: حلف شمال الأطلسي، العهد الذهبي"
                  value={allianceNameInput}
                  onChange={(e) => setAllianceNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2.5 rounded focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">الشعار أو الرمز المختصر (TAG)</label>
                <input
                  type="text"
                  placeholder="مثال: NATO, ARAB, GOLD"
                  maxLength={5}
                  value={allianceTagInput}
                  onChange={(e) => setAllianceTagInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2.5 uppercase rounded focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">بيان الحلف ومسودة المعاهدة والأحكام</label>
                <textarea
                  placeholder="اكتب هنا شروط الانضمام، الواجبات الدفاعية، ومنظومة العمليات..."
                  rows={4}
                  value={allianceDescInput}
                  onChange={(e) => setAllianceDescInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2.5 rounded focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs py-2.5 rounded transition-all active:scale-95 cursor-pointer shadow-lg"
              >
                تأسيس التحالف ودفع 💰500 ذهب
              </button>
            </form>
          </div>

          {/* List existing Alliances to join */}
          <div className="lg:col-span-8 bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-xl">
            <h3 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2 mb-2">
              <Users className="text-slate-400 w-5 h-5" />
              التحالفات العالمية القائمة
            </h3>
            <p className="text-xs text-slate-400 mb-6">استكشف الاتفاقيات الدولية وأرسل مرسوم دولتك لطلب الميثاق العسكري المشترك.</p>

            {alliances.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p>لا تتواجد تحالفات نشطة على الخريطة الإقليمية حالياً.</p>
                <p className="text-xs mt-1 text-slate-600">كن أنت القائد المبادر وقم بتأسيس الحلف الأول لجمع الرايات!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alliances.map((a) => (
                  <div key={a.id} className="bg-slate-900/60 p-4 rounded-lg border border-slate-800/80 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-extrabold text-slate-200">{a.name}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-amber-400 font-mono font-black border border-slate-700">
                          {a.tag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-3">
                        {a.description || 'حلف ذو غايات سرية وتكتيكية بمسرح المعركة.'}
                      </p>
                      <p className="text-[10px] text-slate-500">مؤسس الحلف: <span className="text-slate-300 font-semibold">{a.leaderCountryName}</span></p>
                    </div>

                    <button
                      onClick={() => joinAlliance(a.id)}
                      className="w-full bg-slate-800 hover:bg-slate-750 hover:text-amber-400 border border-slate-700 text-slate-200 text-xs py-2 rounded transition-all cursor-pointer font-bold"
                    >
                      مبايعة والانضمام للحلف 🎌
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
