/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { ResourceHeader } from './components/ResourceHeader';
import { MapTab } from './components/MapTab';
import { DashboardTab } from './components/DashboardTab';
import { AllianceTab } from './components/AllianceTab';
import { EspionageTab } from './components/EspionageTab';
import { ChatComponent } from './components/ChatComponent';
import { LeaderboardTab } from './components/LeaderboardTab';
import { AdminConsole } from './components/AdminConsole';
import { RegistrationForm } from './components/RegistrationForm';
import { MatchSelection } from './components/MatchSelection';
import { MarketTab } from './components/MarketTab';
import { NewsTab } from './components/NewsTab';
import { 
  Shield, 
  Sword, 
  MapPin, 
  Building2, 
  Users, 
  UserCheck, 
  MessageSquare, 
  Award, 
  Compass, 
  Terminal,
  Eye,
  Activity,
  ShoppingCart,
  Newspaper
} from 'lucide-react';

function GameLayout() {
  const { 
    currentUser, 
    currentCountry, 
    loading, 
    login, 
    loginWithEmail,
    registerWithEmail,
    isAdmin,
    selectedMatchId,
    selectMatch,
    messages
  } = useGame();

  // Active tab controllers: 'map' | 'dashboard' | 'alliances' | 'espionage' | 'chat' | 'leaderboards' | 'admin'
  const [activeTab, setActiveTab] = useState<string>('map');

  // Request notifications permission on load
  React.useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // Listen for generic new messages for push notifications
  const prevMessagesLength = React.useRef(messages?.length || 0);

  React.useEffect(() => {
    if (messages && messages.length > prevMessagesLength.current) {
      const latestMessage = messages[0]; // Assuming reversed array where latest is 0
      if (latestMessage && 'Notification' in window && Notification.permission === 'granted' && latestMessage.senderId !== currentUser?.uid) {
        new Notification(latestMessage.senderCountryName || 'بث عاجل', {
          body: latestMessage.text,
          icon: '/icons/logo.png',
        });
      }
    }
    prevMessagesLength.current = messages?.length || 0;
  }, [messages, currentUser]);

  // Email and Password Login States
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setAuthError('الرجاء إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    if (passwordInput.length < 6) {
      setAuthError('يجب أن تكون كلمة المرور مكونة من 6 أحرف على الأقل.');
      return;
    }
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await loginWithEmail(emailInput, passwordInput);
      } else {
        await registerWithEmail(emailInput, passwordInput);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.message?.includes('invalid')) {
        setAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('هذا البريد الإلكتروني مستخدم بالفعل بجلسة أخرى.');
      } else {
        setAuthError('حدث خطأ أثناء الاتصال بالخادم. تأكد من تفعيل موفر البريد الإلكتروني في 콘سول Firebase.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // 1. Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070913] flex flex-col items-center justify-center text-center p-8 text-slate-100 font-sans">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-36 h-36 rounded-full border border-amber-500/10 animate-ping duration-1000" />
          <div className="absolute w-28 h-28 rounded-full border border-amber-500/30 animate-pulse" />
          <img 
            src="/icons/logo.png" 
            alt="Empire Age Logo" 
            referrerPolicy="no-referrer"
            className="w-24 h-24 object-contain filter drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10 animate-pulse"
          />
        </div>
        <h2 className="text-xl font-black text-[#f1f5f9] tracking-widest font-mono">EMPIRE AGE</h2>
        <p className="text-xs text-slate-400 mt-2 animate-pulse">جاري قياس مستودعات التذخير وبث إشارات السيطرة الإقليمية...</p>
      </div>
    );
  }

  // 2. Unauthenticated Screen (Immersive strategy landing launcher page)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0b0f19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0b0f19] to-black flex items-center justify-center p-4">
        <div className="max-w-4xl w-full bg-[#111827]/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md grid grid-cols-1 md:grid-cols-2">
          
          {/* Welcome Intro details */}
          <div className="p-8 flex flex-col justify-between space-y-8 border-b md:border-b-0 md:border-l border-slate-850">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img 
                  src="/icons/logo.png" 
                  alt="Empire Age Logo" 
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 object-contain filter drop-shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse"
                />
                <div>
                  <h1 className="text-2xl font-black tracking-widest text-[#f1f5f9] font-mono leading-none">EMPIRE AGE</h1>
                  <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">مجمع القيادة الفيدرالية</span>
                </div>
              </div>
              <h2 className="text-xl font-extrabold text-[#f1f5f9] mt-3">الاستراتيجية الكبرى وإدارة الإمبراطوريات</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                انطلق في تجربة قيادة عسكرية واقتصادية متكاملة. شيّد المصانع، احشد المدرعات وأسراب المقاتلات، كوّن الاتفاقيات، وتسلل عبر جواسيسك لبسط نفوذك على 36 قطاعا جغرافيا عالميا تفاعليا بمستودعات متجددة كل موسم.
              </p>
            </div>

            {/* Quick specifications features */}
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs">
                <span className="p-1 rounded bg-slate-950 text-amber-400 font-bold shrink-0">1</span>
                <div>
                  <h4 className="font-bold text-slate-200">السيادة القارية والخرائط</h4>
                  <p className="text-[10px] text-slate-500">خريطة تفاعلية تتيح نشر القوات وإدارة ثكنات حرس الحدود وتحصينات الألب والأنديز.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <span className="p-1 rounded bg-slate-950 text-amber-400 font-bold shrink-0">2</span>
                <div>
                  <h4 className="font-bold text-slate-200">صناعة وتجنيد واقعي</h4>
                  <p className="text-[10px] text-slate-500">إنتاج المعادن، المحاصيل والنفط لبقاء دولتك، وحشد طائرات نفاثة مباغتة.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <span className="p-1 rounded bg-slate-950 text-amber-400 font-bold shrink-0">3</span>
                <div>
                  <h4 className="font-bold text-slate-200">دبلوماسية التشفير والجاسوسية</h4>
                  <p className="text-[10px] text-slate-500">غرف حلف للمجهود المشترك، شبكة تجسس لقرصنة الخزائن العامة وتعقب الدبابات.</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500">
              * اللعبة مجهزة بنظام مزامنة سحابية (Firebase SDK) ودفوعات تكتيكية دورية.
            </p>
          </div>

          {/* Login widget block */}
          <div className="p-8 flex flex-col justify-center space-y-6 bg-slate-950/40 relative">
            <div className="absolute inset-0 bg-grid-slate-900 pointer-events-none opacity-20"></div>
            
            <div className="flex flex-col items-center text-center">
              <Compass className="w-16 h-16 text-amber-500 animate-spin-slow filter drop-shadow-[0_0_15px_rgba(245,158,11,0.1)] mb-4" />
              
              <div className="space-y-1 relative z-10 select-none">
                <h3 className="text-lg font-black text-slate-200">
                  {authMode === 'login' ? 'تسجيل الدخول العسكري' : 'تأسيس حساب قائد جديد'}
                </h3>
                <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed">
                  {authMode === 'login' ? 'أدخل تفاصيل الهوية الفيدرالية للاستبسال على الجبهات.' : 'احجز هويتك الفيدرالية للبدء في تشكيل الحلف وتجميع العتاد.'}
                </p>
              </div>
            </div>

            {/* Auth Toggle tabs */}
            <div className="flex border-b border-slate-800 relative z-10">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={`flex-1 pb-2.5 text-xs font-bold transition-all ${authMode === 'login' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-350 hover:text-slate-300'}`}
              >
                بوابة الدخول
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
                className={`flex-1 pb-2.5 text-xs font-bold transition-all ${authMode === 'register' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-350 hover:text-slate-300'}`}
              >
                قائد جديد
              </button>
            </div>

            {/* Error alerts */}
            {authError && (
              <div className="p-3 bg-red-950/50 border border-red-900 text-red-400 rounded-lg text-[11px] text-right font-medium relative z-10 leading-relaxed font-sans">
                {authError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4 relative z-10">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 text-right font-bold tracking-wider mb-1">البريد الإلكتروني الفيدرالي</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@empire.com"
                  className="w-full bg-slate-900/85 border border-slate-800 focus:border-amber-500 text-slate-200 text-xs rounded-xl px-4 py-3 outline-none transition-all placeholder:text-slate-600 text-right font-sans"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 text-right font-bold tracking-wider mb-1">كلمة المرور المشفرة</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="******"
                  className="w-full bg-slate-900/85 border border-slate-800 focus:border-amber-500 text-slate-200 text-xs rounded-xl px-4 py-3 outline-none transition-all placeholder:text-slate-600 text-right font-sans"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-950 font-black text-xs py-3 rounded-xl transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : authMode === 'login' ? (
                  'تسجيل الدخول العسكري'
                ) : (
                  'صياغة حساب القائد'
                )}
              </button>
            </form>

            <div className="relative flex py-1 items-center z-10">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-[10px] text-slate-600 font-bold">أو تفويض الدخول</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Active Google Fallback */}
            <button
              onClick={login}
              type="button"
              className="w-full relative z-10 bg-[#1e293b]/70 hover:bg-[#1e293b] border border-slate-755 border-slate-800 text-slate-300 font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              <img 
                src="https://www.gstatic.com/mobilesdk/160512_mobilesdk/images/auth_service_google.svg" 
                alt="Google sign-in" 
                className="w-4 h-4"
              />
              <span>بوابة الدخول عبر حساب Google</span>
            </button>

            <p className="text-[9px] text-slate-600 text-center select-none leading-normal">
              تنويه: يرجى تفعيل مو فر "البريد الإلكتروني/كلمة المرور" في لوحة تحكم Firebase للعمل بصورة عسكرية متكاملة.
            </p>
          </div>

        </div>
      </div>
    );
  }

  // 2.5 Authenticated but Campaign (Match) not selected yet Lobby
  if (!selectedMatchId) {
    return <MatchSelection />;
  }

  // 3. Authenticated but Country not created yet Form
  if (!currentCountry) {
    return (
      <div className="min-h-screen bg-[#0b0f19] py-12 px-4 flex items-center justify-center">
        <RegistrationForm />
      </div>
    );
  }

  // 4. Ban validation screen
  if (currentCountry.isBanned) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-8 text-center text-slate-100 font-sans">
        <div className="max-w-md bg-[#111827] border border-red-950 rounded-2xl p-8 space-y-4 shadow-2xl">
          <Shield className="w-16 h-16 text-rose-500 mx-auto animate-pulse" />
          <h2 className="text-xl font-black text-[#f1f5f9]">حجابة الحساب والحظر الدبلوماسي</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            تم تقييد وإيقاف إمبراطورية [**{currentCountry.name}**] عن المشاركة بمسرح العمليات العسكرية بقرار صادر من مجلس السلم الدولي لمخالفتك القوانين أو كشف خلايا التجسس بشكل استدلالي مفرط.
          </p>
          <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
            تواصل مع المشرفين لصيانة حسابك بالبريد: efootballpes2025ff@gmail.com
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col justify-start">
      
      {/* Dynamic resources strip panel */}
      <ResourceHeader />

      <main className="max-w-7xl w-full mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        
        {/* Navigation layout folder buttons */}
        <div className="flex overflow-x-auto no-scrollbar md:flex-wrap items-center bg-[#111827] border border-slate-800 p-1.5 rounded-xl gap-1 sm:gap-1.5 shadow-lg shrink-0 flex-nowrap md:overflow-visible">
          
          <button
            onClick={() => selectMatch(null)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg border border-slate-800 hover:border-amber-500/20 text-amber-400 bg-slate-950/60 hover:bg-slate-900 transition-all cursor-pointer font-black shrink-0 whitespace-nowrap"
          >
            <Compass className="w-4 h-4 animate-pulse text-amber-500" />
            <span>غرفة الحملات 📡</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'map' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/50'}`}
          >
            <Compass className="w-4 h-4" />
            <span>خريطة العمليات العالمية</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/50'}`}
          >
            <Building2 className="w-4 h-4" />
            <span>خزينة الإدارة وترقية الجيش</span>
          </button>

          <button
            onClick={() => setActiveTab('alliances')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'alliances' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/50'}`}
          >
            <Users className="w-4 h-4" />
            <span>معاهدات الأحلاف الدولية</span>
          </button>

          <button
            onClick={() => setActiveTab('espionage')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'espionage' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/50'}`}
          >
            <Eye className="w-4 h-4" />
            <span>المخابرات وشعبة التجسس</span>
          </button>

          <button
            onClick={() => setActiveTab('market')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'market' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/50'}`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>سوق التسليح</span>
          </button>

          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'news' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/50'}`}
          >
            <Newspaper className="w-4 h-4" />
            <span>النشرة الدولية</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'chat' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/50'}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>برقيات ومراسلات قنابل الرادارات</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboards')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'leaderboards' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/50'}`}
          >
            <Award className="w-4 h-4" />
            <span>لوحات الشرف والتصنيف الدولي</span>
          </button>

          {/* Optional Admin terminal panel */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 text-xs font-black px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all cursor-pointer md:ml-auto border shrink-0 whitespace-nowrap ${activeTab === 'admin' ? 'bg-red-650 text-slate-100 border-red-500 shadow-md animate-pulse font-extrabold' : 'border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-900/50'}`}
            >
              <Terminal className="w-4 h-4" />
              <span>لوحة التحكم الفيدرالية العليا 💻</span>
            </button>
          )}

        </div>

        {/* Dynamic Inner Tab routing render */}
        <div className="flex-1">
          {activeTab === 'map' && <MapTab />}
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'alliances' && <AllianceTab />}
          {activeTab === 'espionage' && <EspionageTab />}
          {activeTab === 'market' && <MarketTab />}
          {activeTab === 'news' && <NewsTab />}
          {activeTab === 'chat' && <ChatComponent />}
          {activeTab === 'leaderboards' && <LeaderboardTab />}
          {activeTab === 'admin' && isAdmin && <AdminConsole />}
        </div>

      </main>

      <footer className="py-4 border-t border-slate-900/60 bg-[#070b13] text-center text-[10px] text-slate-500">
        <p>© 2026-2027 إمبراطوريات الحرب وإدارة الدول - Empire Age (PWA). كل الحقوق محفوظة لمحافظي السلم الفيدرالي.</p>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}
