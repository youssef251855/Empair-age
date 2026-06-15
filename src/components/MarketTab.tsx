import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ShoppingCart, Coins, Shield, Swords, Plane } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const MarketTab: React.FC = () => {
  const { currentCountry } = useGame();
  const [loading, setLoading] = useState(false);

  if (!currentCountry) return null;

  const handleBuyWeapon = async (type: 'infantry' | 'tanks' | 'jets', goldCost: number, amount: number) => {
    if (currentCountry.gold < goldCost) {
      alert('العملة الذهبية غير كافية لإتمام هذه الصفقة!');
      return;
    }
    setLoading(true);
    try {
      const newArmy = { ...currentCountry.army };
      newArmy[type] = (newArmy[type] || 0) + amount;
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        gold: currentCountry.gold - goldCost,
        army: newArmy
      });
      alert(`تم استيراد ${amount} من ${type === 'infantry' ? 'المشاة' : type === 'tanks' ? 'الدبابات' : 'الطائرات'} وإضافتها لقواتك المركزية.`);
    } catch (e) {
      console.error(e);
      alert('فشل إتمام الصفقة، قد يكون هناك خطأ بالشبكة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <ShoppingCart className="w-8 h-8 text-amber-500" />
        <div>
          <h2 className="text-xl font-black text-slate-100">سوق الأسلحة الدولي والسوق السوداء</h2>
          <p className="text-xs text-slate-400 mt-1">تستطيع هنا إبرام صفقات شراء أسلحة باستخدام العملة الذهبية (الاقتصاد المجرد). كلما زادت ضرائبك واقتصادك زادت العملة الذهبية.</p>
        </div>
      </div>

      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center justify-between mb-8">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-bold mb-1">الرصيد القومي المتاح للصرف:</span>
          <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xl font-black">
            <Coins className="w-5 h-5" />
            {currentCountry.gold.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Infantry Deal */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-amber-500/30 transition-all flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-lg shadow-black">
            <Shield className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 mb-1">فيلق مشاة مترجلين</h3>
          <p className="text-[10px] text-slate-500 mb-4">يعتمدون على الأسلحة الخفيفة ومتفجرات C4.</p>
          <div className="mt-auto w-full">
            <div className="flex justify-between items-center bg-black/40 px-3 py-2 rounded mb-3 border border-slate-800/60">
              <span className="text-xs text-slate-400">الكمية: 1000 وحدة</span>
              <span className="text-xs text-amber-400 font-bold font-mono">15,000 ذهب</span>
            </div>
            <button 
              disabled={loading || currentCountry.gold < 15000}
              onClick={() => handleBuyWeapon('infantry', 15000, 1000)}
              className="w-full py-2.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 border border-amber-500 disabled:opacity-30 disabled:grayscale transition-all shadow-md"
            >
              إرسال طلب استيراد
            </button>
          </div>
        </div>

        {/* Tanks Deal */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-blue-500/30 transition-all flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-lg shadow-black">
            <Swords className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 mb-1">كتيبة دبابات هجومية</h3>
          <p className="text-[10px] text-slate-500 mb-4">آليات مدرعة ثقيلة لغزو الأراضي الوعرة.</p>
          <div className="mt-auto w-full">
            <div className="flex justify-between items-center bg-black/40 px-3 py-2 rounded mb-3 border border-slate-800/60">
              <span className="text-xs text-slate-400">الكمية: 50 آلية</span>
              <span className="text-xs text-amber-400 font-bold font-mono">40,000 ذهب</span>
            </div>
            <button 
              disabled={loading || currentCountry.gold < 40000}
              onClick={() => handleBuyWeapon('tanks', 40000, 50)}
              className="w-full py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-slate-100 border border-blue-500 disabled:opacity-30 disabled:grayscale transition-all shadow-md"
            >
              طلب استيراد مجنزرات
            </button>
          </div>
        </div>

        {/* Jets Deal */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-emerald-500/30 transition-all flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-lg shadow-black">
            <Plane className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 mb-1">سرب مقاتلات نفاثة</h3>
          <p className="text-[10px] text-slate-500 mb-4">سيادة جوية مطلقة لتدمير قواعد العدو.</p>
          <div className="mt-auto w-full">
            <div className="flex justify-between items-center bg-black/40 px-3 py-2 rounded mb-3 border border-slate-800/60">
              <span className="text-xs text-slate-400">الكمية: 10 مقاتلات</span>
              <span className="text-xs text-amber-400 font-bold font-mono">100,000 ذهب</span>
            </div>
            <button 
              disabled={loading || currentCountry.gold < 100000}
              onClick={() => handleBuyWeapon('jets', 100000, 10)}
              className="w-full py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-100 border border-emerald-500 disabled:opacity-30 disabled:grayscale transition-all shadow-md"
            >
              شراء سرب حربي
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
