/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useGame } from '../context/GameContext';
import { 
  ShieldAlert, 
  Flame, 
  RefreshCw, 
  UserX, 
  Terminal, 
  Zap, 
  Compass, 
  AlertTriangle 
} from 'lucide-react';

export const AdminConsole: React.FC = () => {
  const { 
    isAdmin, 
    countries, 
    triggerRandomWorldEvent, 
    adminResetSeason, 
    adminBanCountry 
  } = useGame();

  if (!isAdmin) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-8 text-center max-w-md mx-auto shadow-2xl space-y-4">
        <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto animate-pulse" />
        <h3 className="text-xl font-black text-slate-100">برتوكول حماية النظام المدني الدولي</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          عذراً، هذا المسار يدرج ضمن لوحة الاستخبارات العليا الفيدرالية وهو محصور لمسؤولي الصيانة وفرق التطوير المعتمدين بـ **Empire Age**.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
      
      {/* Title */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
          <Terminal className="text-amber-500 w-6 h-6 shrink-0" />
          لوحة الإدارة الفيدرالية العليا
        </h2>
        <p className="text-xs text-slate-400 mt-1">غرفة تقدير الموقف والتحكم بالأحداث العالمية المأساوية والاستثمارية.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* World Events and Seasons manager */}
        <div className="space-y-4 border border-slate-800 p-4 rounded-xl bg-slate-950/40">
          <h3 className="text-sm font-extrabold text-slate-300 flex items-center gap-1.5 pb-2 border-b border-slate-800/80">
            <Zap className="text-yellow-500 w-4 h-4" />
            توليد الكوارث والأحداث العالمية التفاعلية
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            محاكاة مجلس الأمن لإعلام الدول بالطوارئ. يؤدي الضغط على الزر أدناه لاختيار عشوائي لحدث عالمي (مثل انهيار أسواق البورصة، هبوب عواصف شمسية تفرغ المولدات الكهربائية، أو تفجر آبار البترول) وبثه في المذياع المشترك.
          </p>

          <button
            onClick={triggerRandomWorldEvent}
            className="w-full bg-yellow-500 hover:bg-yellow-600 font-extrabold text-slate-950 text-xs py-2.5 rounded transition-all cursor-pointer shadow-lg text-center"
          >
            بث نداء طوارئ وحدث إقليمي طارئ 📢
          </button>

          <div className="pt-4 border-t border-slate-800/60 mt-4 space-y-3">
            <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              منطقة إعصار المحيط وتصفير المواسم (سيادي)
            </h4>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              يقوم هذا المطلب باستئصال المقاصير السيادية السابقة بالتحالفات، محو الحاميات، إعادة السلوك neutrally للمقاطعات البالغ عددها 36 منطقة وتتويج المتصدر بـ لوحة الشرف التاريخية لبدء الموسم التالي.
            </p>
            <button
              onClick={adminResetSeason}
              className="w-full bg-rose-650 hover:bg-rose-700 text-slate-100 text-xs py-2.5 rounded font-black cursor-pointer transition-all border border-rose-500/35 uppercase tracking-wide text-center"
            >
              إعادة تصفير الخريطة وبدء الموسم الجديد ⚔️
            </button>
          </div>
        </div>

        {/* Players management and Ban control list */}
        <div className="space-y-4 border border-slate-800 p-4 rounded-xl bg-slate-950/40">
          <h3 className="text-sm font-extrabold text-slate-300 flex items-center gap-1.5 pb-2 border-b border-slate-800/80">
            <UserX className="text-rose-500 w-4 h-4" />
            سوابق وحزم الحسابات وإدارة شؤون اللاعبين
          </h3>
          <p className="text-xs text-slate-400">راجع قائمة الدول السيادية الناشئة، وبنود الانتهاك للحد من أي محاكاة غش أو اختراق فني.</p>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {countries.map((c) => (
              <div key={c.id} className="bg-slate-900 border border-slate-850 p-2.5 rounded flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span>{c.flagUrl}</span>
                  <div>
                    <strong className="text-slate-200">{c.name}</strong>
                    <p className="text-[10px] text-slate-500">الرئيس: {c.leaderName}</p>
                  </div>
                </div>

                {/* Ban togglers */}
                {c.isBanned ? (
                  <button
                    onClick={() => adminBanCountry(c.id, false)}
                    className="bg-emerald-950 text-emerald-300 border border-emerald-900 text-[10px] px-2.5 py-1 rounded cursor-pointer font-bold"
                  >
                    فك الفيدرالي
                  </button>
                ) : (
                  <button
                    onClick={() => adminBanCountry(c.id, true)}
                    className="bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-200 text-[10px] px-2.5 py-1 rounded cursor-pointer transition-all"
                  >
                    حظر الحساب 🚫
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
