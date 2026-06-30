/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { FLAG_PRESETS, COLOR_PRESETS } from '../lib/gameData';
import { seedProvincesFromGeoJSON } from '../services/provinceService';
import { 
  Compass, 
  Sparkles, 
  MapPin, 
  User, 
  Palette, 
  Layers,
  Bot,
  Globe,
  Shield,
  Coins
} from 'lucide-react';

export const RegistrationForm: React.FC = () => {
  const { registerCountry, countries, selectedMatchId } = useGame();

  const [regMode, setRegMode] = useState<'claim' | 'custom'>('claim');
  const [selectedBotCountryId, setSelectedBotCountryId] = useState<string>('');

  const [name, setName] = useState<string>('');
  const [leaderName, setLeaderName] = useState<string>('');
  const [capital, setCapital] = useState<string>('');
  const [color, setColor] = useState<string>(COLOR_PRESETS[0]);
  const [flagEmoji, setFlagEmoji] = useState<string>(FLAG_PRESETS[0]);
  const [description, setDescription] = useState<string>('');

  const [loadingForm, setLoadingForm] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);

  // Filter vacant bot-controlled sovereign countries
  const botCountries = countries.filter(c => c.isBot === true || (c.userId && c.userId.startsWith('bot_')));

  useEffect(() => {
    let isMounted = true;
    if (botCountries.length === 0 && selectedMatchId && !seeding) {
      const doSeed = async () => {
        setSeeding(true);
        try {
          const response = await fetch('/assets/maps/countries-50m.json');
          if (response.ok) {
            const geojson = await response.json();
            await seedProvincesFromGeoJSON(geojson, selectedMatchId);
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (isMounted) setSeeding(false);
        }
      };
      doSeed();
    }
    return () => { isMounted = false; };
  }, [botCountries.length, selectedMatchId]);

  const handleSelectBotCountry = (c: any) => {
    setSelectedBotCountryId(c.id);
    setName(c.name);
    setFlagEmoji(c.flagUrl || '🎌');
    setColor(c.color || '#4b5563');
    setDescription(c.description || '');
    setCapital(c.capital || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (regMode === 'claim') {
      if (!selectedBotCountryId) {
        alert("الرجاء اختيار الدولة السيادية التي تود تولي قيادتها وإلغاء تحكم البوت عنها!");
        return;
      }
      if (!leaderName.trim() || !capital.trim()) {
        alert("الرجاء إدخال اسمك كقائد للبلاد وتحديد اسم عاصمتك الاستراتيجية!");
        return;
      }
    } else {
      if (!name.trim() || !leaderName.trim() || !capital.trim()) {
        alert("الرجاء إدخال جميع البيانات التأسيسية الهامة: الاسم، القائد، والعاصمة المخصصة!");
        return;
      }
    }

    setLoadingForm(true);
    try {
      await registerCountry({
        name,
        flagEmoji,
        color,
        capital,
        description,
        leaderName,
        claimCountryId: regMode === 'claim' ? selectedBotCountryId : undefined
      });
      alert(`التهاني السيادية! تم استلام مقاليد القيادة لـ [${name}] رسمياً. انطلق لخطة المعركة والخرائط!`);
    } catch(err) {
      console.error(err);
    } finally {
      setLoadingForm(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 font-sans">
      
      {/* Bio decoration header */}
      <div className="text-center space-y-2 border-b border-slate-800 pb-5">
        <Sparkles className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
        <h2 className="text-2xl font-black text-slate-100">بوابة مجلس قيادة الجبهة والأركان العالمية</h2>
        <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
          انضم فوراً لمسرح المعارك ومخططات الحرب العالمية. تتيح لك النسخة الأولية تولي قيادة أي قوى عظمى شاغرة!
        </p>
      </div>

      {/* Tabs Selection */}
      <div className="grid grid-cols-2 gap-3 p-1 bg-slate-950 rounded-xl border border-slate-900">
        <button
          type="button"
          onClick={() => {
            setRegMode('claim');
            setSelectedBotCountryId('');
          }}
          className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            regMode === 'claim' 
              ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          تولي قيادة دولة قائمة (وتعطيل البوت 🤖)
        </button>
        <button
          type="button"
          onClick={() => {
            setRegMode('custom');
            setName('');
            setCapital('');
            setDescription('');
          }}
          className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            regMode === 'custom' 
              ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          تأسيس إمبراطورية مخصصة 🛠️
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {regMode === 'claim' ? (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-500" />
              اختر الدولة التي تود قيادتها وإلغاء التحكم الآلي (البوت) عنها:
            </h3>

            {seeding ? (
              <div className="text-center p-6 bg-slate-950 rounded-xl border border-slate-800">
                <Bot className="w-8 h-8 text-amber-500 mx-auto animate-bounce mb-3" />
                <p className="text-xs text-slate-400 font-bold">جاري توليد الدول وتوزيع الذكاء الاصطناعي على الخريطة... يرجى الانتظار.</p>
              </div>
            ) : botCountries.length === 0 ? (
              <div className="text-center p-6 bg-slate-950 rounded-xl border border-dashed border-slate-800">
                <p className="text-xs text-slate-500">لا توجد دول شاغرة تحت حكم البوت حالياً في هذا الجهد الحربي. استخدم التأسيس المخصص.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                {botCountries.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectBotCountry(c)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-right relative flex flex-col justify-between ${
                      selectedBotCountryId === c.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{c.flagUrl || '🎌'}</span>
                        <div className="text-right">
                          <h4 className="text-xs font-bold text-slate-200">{c.name}</h4>
                          <span className="text-[10px] text-amber-500 font-bold block">{c.capital}</span>
                        </div>
                      </div>
                      <div className="h-5 w-5 rounded-full border border-slate-700 flex items-center justify-center">
                        {selectedBotCountryId === c.id && <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-400">
                      <span>حالة الدفاع: حامية جيش كاملة 🛡️</span>
                      <span className="font-mono text-amber-500">بوت فعال 🤖</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedBotCountryId && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-900 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500">ميزة تولي الحكم:</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  بمجرد تولي قيادة <strong className="text-amber-400">{name}</strong>، سترث تلقائياً كافة المحافظات والموارد والحاميات العسكرية العظيمة التابعة لها، كما سيتم تعطيل البوت فورياً وتسليم كامل الخرائط لسيادتك.
                </p>
                <div className="flex gap-2 pt-1">
                  <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-teal-400 font-mono">سندات حربية: +1000 💎</span>
                  <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-amber-400 font-mono">ذهب: 3000 🪙</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Custom Nation Name */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-amber-500" />
                اسم الإمبراطورية المخصصة
              </label>
              <input
                type="text"
                placeholder="مثال: إمبراطورية الشرق، جمهورية بابل العليا"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs px-3 py-2.5 rounded focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Icons / flag / colors widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs text-slate-400 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-amber-500" />
                  اختر علم الدولة
                </label>
                <div className="grid grid-cols-6 gap-1 bg-slate-950 p-2 rounded-xl border border-slate-900 max-h-[100px] overflow-y-auto">
                  {FLAG_PRESETS.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFlagEmoji(f)}
                      className={`text-xl p-1 rounded transition-all cursor-pointer hover:bg-slate-800 ${flagEmoji === f ? 'bg-slate-800 border border-amber-500' : ''}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-slate-400 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-amber-500" />
                  لون نفوذ الخريطة
                </label>
                <div className="flex flex-wrap gap-2 bg-slate-950 p-2 rounded-xl border border-slate-900">
                  {COLOR_PRESETS.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border transition-all cursor-pointer hover:scale-110 ${color === c ? 'border-white scale-125' : 'border-slate-800'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                استراتيجيتك وطموحات دولتك السيادية
              </label>
              <textarea
                placeholder="مثال: بسط السيادة المطلقة واحتلال مقاطعات آسيا الغربية وحماية آبار النفط المجاورة."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2.5 rounded focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Common Inputs: Leader Name & Capital City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-900">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-amber-500" />
              اسم رئيس أركان الجيش / القائد الحربي
            </label>
            <input
              type="text"
              placeholder="مثال: المارشال، المهيب، الجنرال"
              required
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs px-3 py-2.5 rounded focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              تسمية مقر القيادة المركزية / العاصمة
            </label>
            <input
              type="text"
              placeholder="مثال: قلعة الفجر، حصن الجنوب، النواة"
              required
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs px-3 py-2.5 rounded focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Card Button */}
        <button
          type="submit"
          disabled={loadingForm}
          className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs py-3.5 rounded-xl tracking-wide shadow-lg cursor-pointer transition-all active:scale-95 text-center disabled:opacity-50"
        >
          {loadingForm 
            ? 'جاري تنصيب القيادة وتأمين الحامية...' 
            : regMode === 'claim' 
              ? 'أداء اليمين العسكري وتسلم مقاليد الحكم وإلغاء البوت 🎖️' 
              : 'تفويض كتائب الدفاع وبناء الإمبراطورية المخصصة 🎖️'
          }
        </button>

      </form>

    </div>
  );
};
