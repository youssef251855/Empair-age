import React, { useState, useEffect } from 'react';
import { Settings, Monitor, ShieldAlert, Cpu, Bell, BellRing } from 'lucide-react';
import { useGame } from '../context/GameContext';

export const SettingsTab: React.FC = () => {
  const { logout, currentUser } = useGame();
  
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [notificationPermission, setNotificationPermission] = useState<string>('default');

  useEffect(() => {
    const savedQuality = localStorage.getItem('graphicsQuality') as ('low' | 'medium' | 'high') | null;
    if (savedQuality) {
      setGraphicsQuality(savedQuality);
    }
    
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleQualityChange = (quality: 'low' | 'medium' | 'high') => {
    setGraphicsQuality(quality);
    localStorage.setItem('graphicsQuality', quality);
    // Reload the page slightly to apply changes seamlessly, or we can just trigger a state change in Map
    window.location.reload();
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('متصفحك الحالي لا يدعم ميزة الإشعارات.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        alert('🎉 تم تفعيل الإشعارات بنجاح! ستتلقى تنبيهات حية ومباشرة عن المعارك والرسائل.');
      } else if (permission === 'denied') {
        alert('⚠️ تم رفض إذن الإشعارات. لتفعيلها، يرجى السماح بها من إعدادات القفل في شريط عنوان المتصفح.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendTestNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('ميزة الإشعارات غير مدعومة في متصفحك.');
      return;
    }

    if (Notification.permission !== 'granted') {
      alert('الرجاء الضغط على زر "طلب وتفعيل الإشعارات" أولاً لتتمكن من تلقي الإشعارات.');
      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          registration.showNotification('إمباير إيدج | Empire Age ⚔️', {
            body: 'هذا إشعار تجريبي للتأكد من عمل نظام التنبيهات المتقدم بنجاح! 🚀',
            icon: '/icons/logo.png',
            tag: 'test-notification',
            badge: '/icons/logo.png'
          });
          return;
        }
      }
    } catch (swErr) {
      console.warn("Could not send test notification via ServiceWorker, trying direct construction:", swErr);
    }

    try {
      new Notification('إمباير إيدج | Empire Age ⚔️', {
        body: 'هذا إشعار تجريبي للتأكد من عمل نظام التنبيهات المتقدم بنجاح! 🚀',
        icon: '/icons/logo.png',
      });
    } catch (err) {
      alert('فشل إرسال الإشعار المباشر، تأكد من أنك قمت بتفعيل الإشعارات في متصفحك.');
    }
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-4">
        <Settings className="w-8 h-8 text-slate-400" />
        <div>
          <h2 className="text-2xl font-black text-[#f1f5f9] tracking-widest">الاعدادات</h2>
          <p className="text-sm text-slate-500">تكوين الخيارات الفنية وإدارة الأداء</p>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* PWA & Notifications Settings */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            تنبيهات الهاتف وإشعارات PWA المتقدمة
          </h3>
          
          <p className="text-sm text-slate-400 mb-6 font-mono">
            احصل على تنبيهات لحظية فورية على هاتفك أو حاسوبك حتى لو لم تكن اللعبة مفتوحة! ستصلك إشعارات عند اندلاع المعارك، تلقي برقيات دبلوماسية، أو عند تعرض أراضيك لغزو عسكري.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <BellRing className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="font-bold text-slate-200 text-sm">حالة إذن الإشعارات الحالي:</div>
                <div className="text-xs mt-0.5">
                  {notificationPermission === 'granted' ? (
                    <span className="text-emerald-400 font-bold">● مفعلة ونشطة بالكامل ✅</span>
                  ) : notificationPermission === 'denied' ? (
                    <span className="text-rose-400 font-bold">● محظورة ⚠️ (يرجى إعطاء الصلاحية من المتصفح)</span>
                  ) : (
                    <span className="text-amber-400 font-bold">● لم يتم الطلب بعد (انتظار تفعيل الصلاحية)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
              {notificationPermission !== 'granted' && (
                <button
                  onClick={requestNotificationPermission}
                  className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 px-5 py-2 rounded-lg font-black text-xs transition-all cursor-pointer"
                >
                  تفعيل الإشعارات الآن 🔔
                </button>
              )}
              <button
                onClick={sendTestNotification}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer border border-slate-700"
              >
                إرسال إشعار تجريبي 🎯
              </button>
            </div>
          </div>
        </div>

        {/* Graphics & Performance Settings */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-amber-500" />
            جودة الرسوميات وأداء الخريطة
          </h3>
          
          <p className="text-sm text-slate-400 mb-6 font-mono">
            اختر جودة الرسوميات وتفاصيل الخريطة بما يتناسب مع قوة جهازك لتجنب التقطيع، وسيتم تطبيق التغييرات فورا.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <button 
              onClick={() => handleQualityChange('low')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${graphicsQuality === 'low' ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
            >
              <Cpu className={`w-8 h-8 ${graphicsQuality === 'low' ? 'text-sky-400' : 'text-slate-500'}`} />
              <div className="text-center">
                <div className={`font-bold ${graphicsQuality === 'low' ? 'text-sky-400' : 'text-slate-300'}`}>جهاز ضعيف</div>
                <div className="text-xs text-slate-500 mt-1">خريطة خفيفة ومبسطة جدا (أداء أسرع)</div>
              </div>
            </button>

            <button 
              onClick={() => handleQualityChange('medium')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${graphicsQuality === 'medium' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
            >
              <Monitor className={`w-8 h-8 ${graphicsQuality === 'medium' ? 'text-amber-400' : 'text-slate-500'}`} />
              <div className="text-center">
                <div className={`font-bold ${graphicsQuality === 'medium' ? 'text-amber-400' : 'text-slate-300'}`}>جهاز متوسط</div>
                <div className="text-xs text-slate-500 mt-1">أداء متوازن بتفاصيل خريطة متوسطة</div>
              </div>
            </button>

            <button 
              onClick={() => handleQualityChange('high')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${graphicsQuality === 'high' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
            >
              <ShieldAlert className={`w-8 h-8 ${graphicsQuality === 'high' ? 'text-rose-400' : 'text-slate-500'}`} />
              <div className="text-center">
                <div className={`font-bold ${graphicsQuality === 'high' ? 'text-rose-400' : 'text-slate-300'}`}>جهاز قوي</div>
                <div className="text-xs text-slate-500 mt-1">أعلى دقة للخريطة وتفاصيل بصرية كاملة</div>
              </div>
            </button>

          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-200 mb-4">الحساب</h3>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              تسجيل الدخول كـ: <span className="text-amber-500 font-mono text-xs">{currentUser?.email}</span>
            </div>
            <button
              onClick={logout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-6 py-2 rounded font-bold transition-colors w-full md:w-auto border border-red-500/20"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
