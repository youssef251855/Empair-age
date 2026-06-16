import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Compass, Shield, Users, Calendar, ArrowRight, UserCheck, Plus, Sparkles, AlertTriangle, Copy, Check } from 'lucide-react';

export const MatchSelection: React.FC = () => {
  const { 
    matches, 
    allMyCountries, 
    selectMatch, 
    logout, 
    currentUser,
    countries: allLiveCountries 
  } = useGame();

  const [showJoinLobby, setShowJoinLobby] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Divide matches into: 1) Already Joined, 2) Joinable
  const joinedMatchIds = allMyCountries.map(c => c.matchId).filter(Boolean) as string[];
  
  const filteredMatches = matches.filter(m => 
    searchQuery.trim() === '' || 
    m.id.toLowerCase().includes(searchQuery.trim().toLowerCase()) || 
    m.id.replace('match_', '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const myCampaigns = filteredMatches.filter(m => joinedMatchIds.includes(m.id));
  const availableCampaigns = filteredMatches.filter(m => !joinedMatchIds.includes(m.id));

  // Auto-generator visual countdown helper (12 Hours cycle tracker)
  const getNextGenerationCountdown = () => {
    if (matches.length === 0) return 'جاري التوليد...';
    try {
      const latest = matches[0];
      const latestTime = new Date(latest.createdAt).getTime();
      const nextTime = latestTime + (12 * 60 * 60 * 1000); // +12 Hours
      const remainingMs = nextTime - Date.now();
      
      if (remainingMs <= 0) return 'توليد خارجي وشيك...';
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours} ساعة و ${mins} دقيقة لتوليد الجبهة التالية`;
    } catch {
      return 'توليد ديناميكي مستمر';
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0b0f19] to-black text-slate-100 font-sans p-4 md:p-8 dir-rtl">
      
      {/* Top Console Command Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between border-b border-slate-800 pb-6 mb-8 gap-4">
        <div className="flex items-center gap-3">
          <img 
            src="/icons/logo.png" 
            alt="Empire Age Logo" 
            referrerPolicy="no-referrer"
            className="w-14 h-14 object-contain filter drop-shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse"
          />
          <div className="text-right">
            <h1 className="text-2xl font-black tracking-widest text-[#f1f5f9] font-mono flex items-center gap-2">
              EMPIRE AGE
              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-sans font-normal animate-pulse">
                لوبي الحملات الحربية
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">مجمع الخرائط التكتيكية وأجهزة البث اللوجستي</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-left md:text-right">
            <p className="text-xs text-slate-400 font-medium">العميل الفيدرالي: <span className="text-amber-400 font-bold">{currentUser?.email}</span></p>
            <p className="text-[10px] text-slate-500">{getNextGenerationCountdown()}</p>
          </div>
          <button
            onClick={logout}
            className="bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 text-slate-400 hover:text-rose-400 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
          >
            خروج آمن
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto space-y-10">
        
        {/* News Flash Alert */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
            <p className="text-xs text-slate-400 leading-relaxed">
              تنبيه القيادة العامة: يتم تحديث وتوليد خرائط عسكرية جديدة تلقائيًا بفواصل زمنية منتظمة تبلغ <span className="text-amber-400 font-bold">12 ساعة</span> لضمان تجدد السياسة لجميع القادة الجدد.
            </p>
          </div>
          <div className="text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-lg">
            {getNextGenerationCountdown()}
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="mb-6 relative max-w-lg mx-auto">
          <input
            type="text"
            placeholder="ابحث عن خريطة باستخدام الـ ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 text-slate-200 text-sm py-3 px-4 rounded-xl focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-slate-600 text-center dir-ltr"
            style={{ direction: 'ltr' }}
          />
        </div>

        {/* Section 1: User's Joined Campaigns */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span>جبهات القتال المنضم إليها ({myCampaigns.length})</span>
            </h2>
            
            <button
              onClick={() => setShowJoinLobby(!showJoinLobby)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 shadow-lg shadow-amber-500/10 flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4 text-slate-950 stroke-[3px]" />
              <span>انضم إلى خريطة جديدة</span>
            </button>
          </div>

          {myCampaigns.length === 0 ? (
            <div className="bg-slate-950/20 border border-dashed border-slate-800/80 rounded-2xl p-12 text-center space-y-4">
              <Plus className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
              <div className="space-y-1">
                <h3 className="font-bold text-slate-300">لم تنضم بعد إلى أي بطولة حية!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  يمكنك غزو العالم وتشكيل الأحلاف السياسية العظمى الآن من خلال الانضمام لأحد ساحات الحرب المتاحة أدناه.
                </p>
              </div>
              <button
                onClick={() => setShowJoinLobby(true)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs px-6 py-2.5 rounded-xl cursor-pointer transition-all inline-block font-semibold"
              >
                تصفح الخرائط المفتوحة لتأسيس دولتك
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myCampaigns.map((match) => {
                // Find associated country registered by this user inside this match
                const userCountry = allMyCountries.find(c => c.matchId === match.id);
                return (
                  <div 
                    key={match.id}
                    className="bg-[#111827]/90 border border-emerald-950/50 hover:border-emerald-500/40 rounded-2xl p-5 hover:transform hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-350 cursor-pointer flex flex-col justify-between space-y-6 shadow-xl"
                    onClick={() => selectMatch(match.id)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                          نشط ولواء عسكري قائم
                        </span>
                        <div 
                          className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full transition-colors"
                          onClick={(e) => handleCopy(e, match.id)}
                        >
                          <span className="text-[10px] text-slate-400 font-mono select-all">
                            ID: {match.id.replace('match_', '')}
                          </span>
                          {copiedId === match.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                        </div>
                      </div>
                      
                      <h3 className="text-base font-black text-slate-100">{match.name}</h3>
                      
                      <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-900 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{userCountry?.flagUrl || '🏳️'}</span>
                          <div className="text-right">
                            <p className="font-extrabold text-[#f1f5f9] leading-snug">{userCountry?.name || 'دولة بلا اسم'}</p>
                            <p className="text-[9px] text-slate-500 leading-none mt-0.5">القائد: {userCountry?.leaderName || 'عام'}</p>
                          </div>
                        </div>
                        <div className="text-left font-mono">
                          <p className="text-[9px] text-slate-500 leading-none">تاريخ التأسيس</p>
                          <p className="text-[10px] text-slate-300 font-bold mt-1">
                            {userCountry ? new Date(userCountry.gold === 1500 ? Date.now() : Date.now()).toLocaleDateString('ar-EG') : 'الآن'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/85 pt-4">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Users className="w-3.5 h-3.5" />
                        <span>قادة الخارطة: {allLiveCountries.filter(c => c.matchId === match.id).length}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          selectMatch(match.id);
                        }}
                        className="text-[11px] font-black text-[#f59e0b] hover:text-amber-400 flex items-center gap-1 transition-colors pointer-cursor"
                      >
                        <span>دخول غرفة القيادة</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Open and Joinable Campaigns */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-t border-slate-900 pt-6">
            <h2 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <span>الساحات المفتوحة للانضمام والتأسيس الدولي ({availableCampaigns.length})</span>
            </h2>
            <p className="text-xs text-slate-500 font-mono">محدثة فوريًا</p>
          </div>

          {availableCampaigns.length === 0 ? (
            <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-8 text-center text-slate-500 text-xs">
              لا توجد حملات حربية معزولة حاليًا. سيقوم النظام لتلقائي بالانبعاث وتوليد خارطة بمسمى جديد حال الصفر.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {availableCampaigns.map((match) => {
                const mapCountriesCount = allLiveCountries.filter(c => c.matchId === match.id).length;
                return (
                  <div 
                    key={match.id}
                    className="bg-[#111827]/50 hover:bg-[#111827] border border-slate-850 hover:border-amber-500/30 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-6"
                    onClick={() => selectMatch(match.id)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                          غزو مفتوح حـالًا
                        </span>
                        <div 
                          className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full transition-colors"
                          onClick={(e) => handleCopy(e, match.id)}
                        >
                          <span className="text-[10px] text-slate-400 font-mono select-all">
                            ID: {match.id.replace('match_', '')}
                          </span>
                          {copiedId === match.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                        </div>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-200">{match.name}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed h-12 overflow-hidden text-ellipsis">
                        انخرط في معركة تكتيكية شاملة! قم بتسجيل إمبراطوريتك وحصّن مقاطعاتك ونفذ خطط المخابرات لإسقاط الأعداء.
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-850 pt-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[10px]">
                          تاريخ البث: {new Date(match.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          selectMatch(match.id);
                        }}
                        className="text-[10px] font-bold bg-slate-900 hover:bg-amber-500 text-slate-300 hover:text-slate-950 px-3.5 py-2 rounded-xl transition-all border border-slate-800"
                      >
                        انضم وتأسيس
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      <footer className="max-w-6xl mx-auto py-12 border-t border-slate-900 mt-20 text-center text-xs text-slate-600 space-y-2">
        <p>© 2026-2027 إمبراطوريات الحرب والسيادة التفاعلية - Empire Age. كل المزامنة والكتل العسكرية تعود للقمر الفيدرالي.</p>
        <p className="font-mono text-[10px] text-slate-700">Database Engine: Firebase Firestore Pro v12</p>
      </footer>

    </div>
  );
};
