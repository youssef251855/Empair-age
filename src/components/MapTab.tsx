/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Territory, Army, Garrison, MapUnit } from '../types';
import { UNIT_DEFS } from '../lib/gameData';
import { PixiMapWrapper } from './game/PixiMapWrapper';
import { ProvinceState } from '../services/provinceService';
import { spawnUnit } from '../services/unitService';
import { useBotEngine } from '../hooks/useBotEngine';
import { 
  Shield, 
  Sword, 
  MapPin, 
  Users, 
  Compass, 
  TrendingUp, 
  Coins, 
  Droplet, 
  Flame, 
  Zap, 
  ArrowLeftRight, 
  Sparkles,
  Award
} from 'lucide-react';

export const MapTab: React.FC = () => {
  const { 
    territories, 
    countries,
    currentCountry, 
    attackTerritory, 
    executeAirStrike,
    moveGarrisonToTerritory, 
    withdrawGarrisonFromTerritory,
    executeEspionage,
    sendChatMessage,
    addBotCountry,
    spies,
    selectedMatchId
  } = useGame();

  useBotEngine();

  const getStrengthEstimate = (amount: number) => {
    if (amount === 0) return 'خالية';
    if (amount < 15) return 'ضعيفة';
    if (amount < 60) return 'متوسطة';
    if (amount >= 60) return 'كبيرة';
    return 'مجهولة';
  };

  // Find an owned province to default to if available
  const defaultOwnedTerritory = React.useMemo(() => {
    if (!currentCountry || territories.length === 0) return null;
    return territories.find(t => t.ownerCountryId === currentCountry.id) || null;
  }, [currentCountry, territories]);

  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);

  const isGarrisonVisible = React.useMemo(() => {
    if (!selectedTerritory || !currentCountry) return false;
    // 1. If we own this territory, yes:
    if (selectedTerritory.ownerCountryId === currentCountry.id) return true;
    
    // 2. If it is an ally's territory (Shared Intelligence), yes:
    if (currentCountry.allianceId && selectedTerritory.ownerCountryId) {
      const terrOwner = countries.find(c => c.id === selectedTerritory.ownerCountryId);
      if (terrOwner && terrOwner.allianceId === currentCountry.allianceId) {
        return true;
      }
    }

    // 3. If it is clashing (active clash), we are either attacker or defending against them, yes:
    if (selectedTerritory.battleStatus === 'clashing') return true;
    
    // 4. If we have a successful spy mission or recon plane on their country:
    const now = Date.now();
    const hasSuccessfulSpy = (spies || []).some(spy => {
      if (spy.ownerCountryId !== currentCountry.id || spy.targetCountryId !== selectedTerritory.ownerCountryId || spy.status !== 'successful') return false;
      const spyTime = new Date(spy.createdAt).getTime();
      // Intelligence expires after 5 minutes
      return (now - spyTime) < (5 * 60 * 1000);
    });
    if (hasSuccessfulSpy) return true;

    // 5. If we have a friendly radar station within range of this province:
    const hasRadarVision = territories.some(t => {
      if (t.ownerCountryId !== currentCountry.id || !t.radarLevel || t.radarLevel <= 0) return false;
      const range = t.radarLevel === 1 ? 12 : (t.radarLevel === 2 ? 25 : 45);
      const dist = Math.sqrt(Math.pow(t.lat - selectedTerritory.lat, 2) + Math.pow(t.lng - selectedTerritory.lng, 2));
      return dist <= range;
    });
    if (hasRadarVision) return true;

    return false;
  }, [selectedTerritory, currentCountry, spies, countries, territories]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Territory[]>([]);

  // Calculate live countdown timer for selected clashing territory
  const [liveClashRemaining, setLiveClashRemaining] = useState<number | null>(null);

  React.useEffect(() => {
    if (!selectedTerritory) return;
    // Keep selectedTerritory fully matched with live territories updates
    const liveMatch = territories.find(t => t.id === selectedTerritory.id);
    if (liveMatch && JSON.stringify(liveMatch.garrison) !== JSON.stringify(selectedTerritory.garrison) || liveMatch?.battleStatus !== selectedTerritory.battleStatus) {
      setSelectedTerritory(liveMatch);
    }
  }, [territories, selectedTerritory]);

  React.useEffect(() => {
    if (!selectedTerritory || selectedTerritory.battleStatus !== 'clashing' || !selectedTerritory.battleReleaseTime) {
      setLiveClashRemaining(null);
      return;
    }

    const timer = setInterval(() => {
      const latest = territories.find(t => t.id === selectedTerritory.id);
      if (!latest || latest.battleStatus !== 'clashing' || !latest.battleReleaseTime) {
        setLiveClashRemaining(null);
        if (latest) setSelectedTerritory(latest);
        clearInterval(timer);
        return;
      }

      const diff = Math.max(0, Math.round((latest.battleReleaseTime - Date.now()) / 1000));
      setLiveClashRemaining(diff);

      if (diff === 0) {
        setLiveClashRemaining(null);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedTerritory, territories]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    const query = val.toLowerCase().trim();
    const matched = territories.filter(t => {
      const cleanId = t.id.includes('_') ? t.id.split('_').pop() || '' : t.id;
      return (
        cleanId.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
      );
    });
    setSearchResults(matched.slice(0, 5));
  };

  const handleSelectSearchResult = (prov: Territory) => {
    handleSelectTerritory(prov);
    setSearchQuery('');
    setSearchResults([]);
    const mapElement = document.getElementById('tactical-world-map');
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // If we just loaded and have a default, set it
  React.useEffect(() => {
    if (!selectedTerritory && defaultOwnedTerritory) {
      setSelectedTerritory(defaultOwnedTerritory);
    }
  }, [defaultOwnedTerritory, selectedTerritory]);
  
  // Tactical action drawer state
  const [tacticalAction, setTacticalAction] = useState<'info' | 'deploy' | 'invade' | 'espionage' | 'diplomacy' | 'negotiate' | 'spawn' | 'airstrike'>('info');

  // Input states for forces relocation or attacks
  const [infantryInput, setInfantryInput] = useState<number>(0);
  const [specialForcesInput, setSpecialForcesInput] = useState<number>(0);
  const [tanksInput, setTanksInput] = useState<number>(0);
  const [artilleryInput, setArtilleryInput] = useState<number>(0);
  const [antiAirInput, setAntiAirInput] = useState<number>(0);
  const [jetsInput, setJetsInput] = useState<number>(0);
  const [missilesInput, setMissilesInput] = useState<number>(0);
  
  // Negotiation message state
  const [negotiateInput, setNegotiateInput] = useState<string>('');

  const selectedTerritoryCountry = React.useMemo(() => {
    if (!selectedTerritory) return null;
    return countries.find(c => c.id === selectedTerritory.ownerCountryId) || null;
  }, [selectedTerritory, countries]);

  if (!currentCountry) {
    return (
      <div className="p-8 text-center text-slate-400">
        الرجاء تسجيل الدخول وتدشين ملف دولتك أولاً للمشاركة بمسرح العمليات العسكرية!
      </div>
    );
  }

  const handleSelectTerritory = (t: Territory) => {
    // Sync state
    const synced = territories.find(item => item.id === t.id) || t;
    setSelectedTerritory(synced);
    if (synced.ownerCountryId && synced.ownerCountryId !== currentCountry.id) {
      setTacticalAction('invade'); // Immediately show Attack (Invasion) tab options!
    } else {
      setTacticalAction('info');
    }
    resetSliders();
  };

  const resetSliders = () => {
    setInfantryInput(0);
    setSpecialForcesInput(0);
    setTanksInput(0);
    setArtilleryInput(0);
    setAntiAirInput(0);
    setJetsInput(0);
    setMissilesInput(0);
  };

  const handleDeployGarrison = async () => {
    if (!selectedTerritory) return;
    const units: Partial<Garrison> = {
      infantry: infantryInput,
      specialForces: specialForcesInput,
      tanks: tanksInput,
      artillery: artilleryInput,
      antiAir: antiAirInput,
      jets: jetsInput,
      missiles: missilesInput
    };
    await moveGarrisonToTerritory(selectedTerritory.id, units);
    alert('تم حشد القوات المختارة وتأمين الحدود في المقاطعة المعنية!');
    // Refresh
    const t = territories.find(item => item.id === selectedTerritory.id);
    if (t) setSelectedTerritory(t);
    setTacticalAction('info');
    resetSliders();
  };

  const handleWithdrawGarrison = async () => {
    if (!selectedTerritory) return;
    const units: Partial<Garrison> = {
      infantry: infantryInput,
      specialForces: specialForcesInput,
      tanks: tanksInput,
      artillery: artilleryInput,
      antiAir: antiAirInput,
      jets: jetsInput,
      missiles: missilesInput
    };
    await withdrawGarrisonFromTerritory(selectedTerritory.id, units);
    alert('تم سحب كتائب الانتشار وإعادة توجيهها للاحتياط المركزي بالقاعدة!');
    const t = territories.find(item => item.id === selectedTerritory.id);
    if (t) setSelectedTerritory(t);
    setTacticalAction('info');
    resetSliders();
  };

  const handleSpawnMapUnit = async (type: 'soldier' | 'tank' | 'jet' | 'missile') => {
    if (!selectedTerritory || !currentCountry) return;
    if (type === 'soldier' && currentCountry.army.infantry < 1) return alert('لا تملك قوات مشاة كافية في الاحتياط!');
    if (type === 'tank' && currentCountry.army.tanks < 1) return alert('لا تملك دبابات كافية في الاحتياط!');
    if (type === 'jet' && currentCountry.army.jets < 1) return alert('لا تملك طائرات كافية في الاحتياط!');
    if (type === 'missile' && (currentCountry.army.missiles || 0) < 1) return alert('لا تملك صواريخ كافية في الاحتياط! يمكنك تصنيع الصواريخ الباليستية من لوحة الإمداد والتصنيع.');

    // Determine unit stats
    let hp = 100, attack = 15, range = 2, speed = 5;
    let armyKey: keyof Army = 'infantry';
    if (type === 'tank') {
      hp = 300; attack = 50; range = 3; speed = 3; armyKey = 'tanks';
    } else if (type === 'jet') {
      hp = 150; attack = 80; range = 6; speed = 8; armyKey = 'jets';
    } else if (type === 'missile') {
      hp = 80; attack = 190; range = 10; speed = 10; armyKey = 'missiles';
    }

    // Spawn near the exactly selected province (reversing percentage to geographical coords)
    const finalLng = (selectedTerritory.posX / 100) * 360 - 180;
    const finalLat = 90 - (selectedTerritory.posY / 100) * 180;

    const approximateLat = finalLat + (Math.random() * 0.4 - 0.2);
    const approximateLng = finalLng + (Math.random() * 0.4 - 0.2);

    const unit: MapUnit = {
      id: `unit_${Date.now()}`,
      matchId: selectedMatchId || '',
      ownerCountryId: currentCountry.id,
      ownerCountryName: currentCountry.name,
      color: currentCountry.color || '#f59e0b',
      type,
      hp,
      maxHp: hp,
      attack,
      speed,
      range,
      lat: approximateLat,
      lng: approximateLng,
      targetLat: null,
      targetLng: null,
      status: 'idle',
      lastUpdatedAt: Date.now()
    };

    try {
      await spawnUnit(unit);
      
      const newArmyInfo = { ...currentCountry.army };
      newArmyInfo[armyKey] -= 1;
      
      const { doc, updateDoc, db } = await import('../lib/firebase');
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        army: newArmyInfo
      });
      
      alert('تم تنزيل الوحدة القتالية المفتوحة بنجاح. راقب الخريطة لتحريكها بحرية!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleLaunchAirstrike = async () => {
    if (!selectedTerritory) return;
    const confirm = window.confirm(`هل أنت متأكد من تسيير غارات جوية مدمرة وقصف مقاطعة [${selectedTerritory.name}] بالصواريخ الارتجاجية؟`);
    if (!confirm) return;

    try {
      await executeAirStrike(selectedTerritory.id);
      alert("انتهت ضربة سلاح الجو! راجع نافذة الأخبار وصندوق الدردشة لرؤية حصاد القصف الجوي.");
      const updated = territories.find(item => item.id === selectedTerritory.id);
      if (updated) setSelectedTerritory(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLaunchInvasion = async () => {
    if (!selectedTerritory) return;
    const forces: Partial<Army> = {
      infantry: infantryInput,
      specialForces: specialForcesInput,
      tanks: tanksInput,
      artillery: artilleryInput,
      antiAir: antiAirInput,
      jets: jetsInput,
      reconPlanes: 0,
      warships: 0,
      submarines: 0,
      missiles: missilesInput
    };

    const confirm = window.confirm(`تأكيد: هل أنت جاهز لإعلان الغارة وشن هجوم ساحق للسيطرة على [${selectedTerritory.name}]؟`);
    if (!confirm) return;

    try {
      await attackTerritory(selectedTerritory.id, forces);
      
      const updated = territories.find(item => item.id === selectedTerritory.id);
      if (updated) {
        setSelectedTerritory(updated);
      } else {
        setSelectedTerritory(null);
      }
      setTacticalAction('info');
      resetSliders();
    } catch (e: any) {
      console.error(e);
      alert('خطأ: ' + e.message);
    }
  };

  const handleEspionage = async (mission: 'intel' | 'steal_oil' | 'steal_gold' | 'sabotage_defense') => {
    if (!selectedTerritory || !selectedTerritory.ownerCountryId) return;
    const confirm = window.confirm('هل تريد فعلاً إرسال الجواسيس لاختراق هذه الدولة؟ قد تفشل العملية ويتم اكتشاف خطتك!');
    if (!confirm) return;
    try {
      await executeEspionage(selectedTerritory.ownerCountryId, mission);
      alert('تم إرسال فريق الجواسيس. راقب تقارير الأخبار لاحقاً لمعرفة النتائج!');
      setTacticalAction('info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleReconPlane = async () => {
    if (!selectedTerritory || !selectedTerritory.ownerCountryId) return;
    const confirm = window.confirm('هل تريد إرسال طائرة استطلاع للكشف عن خريطة الهدف والتجسس الجوي؟ الطائرة مهددة بالإسقاط.');
    if (!confirm) return;
    try {
      await executeEspionage(selectedTerritory.ownerCountryId, 'recon', true);
      alert('تم إطلاق طائرة الاستطلاع. راقب تقارير الأخبار!');
      setTacticalAction('info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleBuildFortification = async (type: 'bunker' | 'radar') => {
    if (!selectedTerritory || !currentCountry) return;
    
    const currentLevel = type === 'bunker' 
      ? (selectedTerritory.bunkerLevel || 0) 
      : (selectedTerritory.radarLevel || 0);
      
    if (currentLevel >= 3) {
      alert('تم الوصول للحد الأقصى للتطوير (المستوى 3) لهذه المنشأة!');
      return;
    }
    
    const nextLevel = currentLevel + 1;
    
    // Calculate costs (Conflict of Nations Style)
    let ironCost = 0;
    let goldCost = 0;
    
    if (type === 'bunker') {
      if (nextLevel === 1) { ironCost = 200; goldCost = 150; }
      else if (nextLevel === 2) { ironCost = 400; goldCost = 300; }
      else if (nextLevel === 3) { ironCost = 800; goldCost = 600; }
    } else {
      if (nextLevel === 1) { ironCost = 100; goldCost = 150; }
      else if (nextLevel === 2) { ironCost = 200; goldCost = 300; }
      else if (nextLevel === 3) { ironCost = 400; goldCost = 600; }
    }
    
    if (currentCountry.iron < ironCost || currentCountry.gold < goldCost) {
      alert(`الموارد غير كافية! لتطوير المنشأة للمستوى ${nextLevel} تحتاج إلى: ${goldCost} 💰 ذهب و ${ironCost} ⛓️ حديد.`);
      return;
    }
    
    const confirm = window.confirm(`تأكيد التطوير: هل تريد ترقية ${type === 'bunker' ? 'المخابئ الحصينة' : 'منظومة الرادار الجوي'} للمستوى ${nextLevel} بتكلفة ${goldCost} ذهب و ${ironCost} حديد؟`);
    if (!confirm) return;
    
    try {
      // Deduct country resources
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        gold: currentCountry.gold - goldCost,
        iron: currentCountry.iron - ironCost
      });
      
      // Upgrade territory building
      const updateData: any = {};
      if (type === 'bunker') {
        updateData.bunkerLevel = nextLevel;
      } else {
        updateData.radarLevel = nextLevel;
      }
      
      await updateDoc(doc(db, 'territories', selectedTerritory.id), {
        ...updateData
      });
      
      alert(`🎉 تم ترقية ${type === 'bunker' ? 'المخابئ الحصينة' : 'منظومة الرادار الجوي'} في [${selectedTerritory.name}] بنجاح إلى المستوى ${nextLevel}!`);
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ أثناء الترقية: ' + e.message);
    }
  };

  const handleDiplomacy = async () => {
    if (!selectedTerritory || !selectedTerritory.ownerCountryId) return;
    const confirm = window.confirm(`هل تريد إرسال برقية معاهدة سلام علنية لدولة [${selectedTerritory.ownerCountryName}]؟`);
    if (!confirm) return;
    try {
      await sendChatMessage(`[برقية دبلوماسية]: نحن القيادة العليا نعرض معاهدة سلام وإيقاف إطلاق نار متبادل مع ${selectedTerritory.ownerCountryName}. هل توافقون؟`);
      alert('تم إرسال برقية السلام على قناة التواصل العالمية.');
      setTacticalAction('info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleNegotiate = async () => {
    if (!selectedTerritory || !selectedTerritory.ownerCountryId || !currentCountry || !negotiateInput.trim()) return;
    try {
      const { addDoc, collection, db } = await import('../lib/firebase');
      
      const txt = negotiateInput.trim();
      
      // Send player message
      await addDoc(collection(db, 'messages'), {
        senderId: currentCountry.id,
        senderCountryName: currentCountry.name,
        senderFlagEmoji: currentCountry.flagUrl || '🏳️',
        senderColor: currentCountry.color || '#f59e0b',
        text: txt,
        timestamp: Date.now(),
        allianceId: null,
        recipientId: selectedTerritory.ownerCountryId,
        recipientCountryName: selectedTerritory.ownerCountryName,
        matchId: selectedMatchId || ''
      });
      
      alert('تم إرسال رسالة التفاوض إلى حاكم الدولة بنجاح!');
      setNegotiateInput('');
      setTacticalAction('info');
      
      // If the target country is a BOT, request an AI reply
      const targetCountry = countries.find(c => c.id === selectedTerritory.ownerCountryId);
      if (targetCountry && targetCountry.isBot) {
        // Prepare context
        const context = {
           botGold: targetCountry.gold,
           botInfantry: targetCountry.army.infantry,
           playerArmy: currentCountry.army,
           playerGold: currentCountry.gold,
           territoryName: selectedTerritory.name
        };
        
        const res = await fetch('/api/bot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: txt,
            botName: targetCountry.name,
            playerName: currentCountry.name,
            context
          })
        });
        
        const data = await res.json();
        if (data.reply) {
          // Bot sends reply back to player
          await addDoc(collection(db, 'messages'), {
            senderId: targetCountry.id,
            senderCountryName: targetCountry.name,
            senderFlagEmoji: targetCountry.flagUrl || '🤖',
            senderColor: targetCountry.color || '#64748b',
            text: data.reply,
            timestamp: Date.now(),
            allianceId: null,
            recipientId: currentCountry.id,
            recipientCountryName: currentCountry.name,
            matchId: selectedMatchId || ''
          });
        }
      }
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء إرسال الرسالة.');
    }
  };

  const getResourceIcon = (type: string) => {
    switch(type) {
      case 'gold': return <Coins className="text-amber-400 w-4 h-4" />;
      case 'oil': return <Droplet className="text-blue-400 w-4 h-4" />;
      case 'iron': return <Compass className="text-slate-300 w-4 h-4" />;
      case 'food': return <Flame className="text-emerald-400 w-4 h-4" />;
      case 'electricity': return <Zap className="text-yellow-400 w-4 h-4" />;
      default: return null;
    }
  };

  const getResourceLabel = (type: string) => {
    switch(type) {
      case 'gold': return 'سبائك ذهب';
      case 'oil': return 'براميل نفط خام';
      case 'iron': return 'ألواح حديد معدني';
      case 'food': return 'مخازن الأغذية';
      case 'electricity': return 'طاقة ومولدات كهرباء';
      default: return type;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* 1. Tactical Interactive real-globe World Map with subdivided GeoJSON Provinces */}
      <div id="tactical-world-map" className="lg:col-span-8 bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#f1f5f9] flex items-center gap-2">
              <Compass className="text-amber-500 w-5 h-5 animate-spin-slow" />
              الخريطة الحربية الجغرافية التفاعلية
            </h2>
            <p className="text-xs text-slate-400">تحرك بكامل الحرية واستطلع شتى مقاطعات العالم المتكاملة لرسم الخطط!</p>
          </div>
          <div className="flex items-center gap-2.5 text-[10px] sm:text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#2563eb]"></span> نفوذك</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#16a34a]"></span> التحالف</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#dc2626]"></span> خصوم</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#4b5563]"></span> محايد</span>
          </div>
        </div>

        {/* Dynamic Search Box Area */}
        <div className="mb-4 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 flex flex-col sm:flex-row items-center gap-3 relative z-30">
          <div className="text-xs font-black text-amber-500 shrink-0 text-right w-full sm:w-auto">
            البحث عن جبهة / مقاطعة 🔍:
          </div>
          <div className="flex-1 w-full relative">
            <input
              type="text"
              placeholder="اكتب اسم المقاطعة أو المعرّف (مثل: T01، T12)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded px-3.5 py-1.5 text-xs text-slate-200 outline-none text-right"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-[#0f172a] border border-slate-800 rounded-md mt-1 z-35 max-h-48 overflow-y-auto shadow-2xl">
                {searchResults.map((prov) => (
                  <button
                    key={prov.id}
                    onClick={() => handleSelectSearchResult(prov)}
                    className="w-full text-right px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex justify-between items-center text-slate-300 border-b border-slate-900 last:border-0"
                  >
                    <span className="text-amber-500 font-mono font-bold text-[10px] bg-slate-950 px-1 rounded">
                      {prov.id.includes('_') ? prov.id.split('_').pop() : prov.id}
                    </span>
                    <span>{prov.name} {prov.flagEmoji}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Real Globe Mapping */}
        <PixiMapWrapper 
          onSelectProvince={(id) => {
            const expectedId = selectedMatchId ? `${selectedMatchId}_${id}` : id;
            const terr = territories.find(t => t.id === expectedId || t.id === id);
            if (terr) handleSelectSearchResult(terr);
          }} 
          selectedProvinceId={selectedTerritory?.id || null} 
        />

        <div className="bg-slate-900/50 p-2 text-center text-[11px] text-slate-400 rounded-lg mt-3 border border-slate-800/60">
          💡 حرك خريطة العالم بأريحية واستخدم زري التكبير/التصغير لرؤية تفاصيل المقاطعة. اضغط على أي مقاطعة لتنشيط تحركاتها العسكرية بالجانب الأيسر.
        </div>
      </div>

      {/* 2. Side Panel Dynamic Cabinet Control */}
      <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col justify-between">
        
        {selectedTerritory ? (
          <div>
            {/* Header info */}
            <div className="border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded text-xs bg-slate-800 text-slate-300 font-mono">
                  معرّف المقاطعة: {selectedTerritory.id}
                </span>
                <span className="text-sm">
                  {selectedTerritory.ownerCountryId ? '🎌 مستحوذ عليها' : '💀 قطاع متمرد'}
                </span>
              </div>
              <h3 className="text-xl font-black text-[#f1f5f9] mt-2 flex items-center gap-2">
                <MapPin className="text-rose-500 w-5 h-5 shrink-0" />
                {selectedTerritory.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                تضاريس المنطقة: 
                <span className="text-slate-200 font-semibold">
                  {selectedTerritory.type === 'desert' && 'صحراء قاحلة 🏜️'}
                  {selectedTerritory.type === 'mountain' && 'جبال عالية الارتفاع 🏔️'}
                  {selectedTerritory.type === 'coastal' && 'شاطئ/ميناء ساحلي 🌊'}
                  {selectedTerritory.type === 'plain' && 'سهول عشبية مفتوحة 🌲'}
                </span>
              </p>
            </div>

            {/* Geographical details & Specialty Output */}
            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getResourceIcon(selectedTerritory.resourceSpecialty)}
                <div>
                  <p className="text-xs text-slate-400">التخصص الاستراتيجي</p>
                  <p className="text-sm font-extrabold text-slate-100">{getResourceLabel(selectedTerritory.resourceSpecialty)}</p>
                </div>
              </div>
              <div className="text-left font-mono">
                <p className="text-[10px] text-slate-400">مضاعف الحصاد</p>
                <p className="text-sm font-black text-amber-400">x{selectedTerritory.resourceMultiplier || 1.0}</p>
              </div>
            </div>

            {/* Sovereignty Info Card */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3.5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">الدولة صاحبة النفوذ</p>
                {selectedTerritoryCountry?.isBot && (
                  <span className="bg-blue-900/50 text-blue-300 text-[10px] px-2 py-0.5 rounded-full border border-blue-800/60 font-bold flex items-center gap-1 select-none">
                    <span>تحكم آلي للـ BOT</span>
                    <span>🤖</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{selectedTerritory.ownerCountryName ? selectedTerritory.flagEmoji : '☠️'}</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    {selectedTerritory.ownerCountryName || 'متمردين خارجين عن الإجماع الدولي'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {selectedTerritory.ownerCountryId ? `تحت حماية لواء الدفاع الوطني` : 'منطقة برية متنازع عليها ومتاحة للغزو والاستعمار'}
                  </p>
                </div>
              </div>
            </div>

            {/* Garnison Stationed info */}
            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                حجم الدفاعات والفرقة المتواجدة:
              </h4>
              <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-3 rounded border border-slate-900">
                <div className="text-xs flex items-center justify-between p-1 bg-slate-900/60 rounded">
                  <span className="text-slate-400">مشاة نظامية</span>
                  <span className="font-mono text-slate-100 font-extrabold">{isGarrisonVisible ? (selectedTerritory.garrison.infantry || 0) : getStrengthEstimate(selectedTerritory.garrison.infantry || 0)}</span>
                </div>
                <div className="text-xs flex items-center justify-between p-1 bg-slate-900/60 rounded">
                  <span className="text-purple-400">قوات خاصة</span>
                  <span className="font-mono text-slate-100 font-extrabold">{isGarrisonVisible ? (selectedTerritory.garrison.specialForces || 0) : getStrengthEstimate(selectedTerritory.garrison.specialForces || 0)}</span>
                </div>
                <div className="text-xs flex items-center justify-between p-1 bg-slate-900/60 rounded">
                  <span className="text-cyan-400">دبابات</span>
                  <span className="font-mono text-slate-100 font-extrabold">{isGarrisonVisible ? (selectedTerritory.garrison.tanks || 0) : getStrengthEstimate(selectedTerritory.garrison.tanks || 0)}</span>
                </div>
                <div className="text-xs flex items-center justify-between p-1 bg-slate-900/60 rounded">
                  <span className="text-amber-400">مدفعية جيش</span>
                  <span className="font-mono text-slate-100 font-extrabold">{isGarrisonVisible ? (selectedTerritory.garrison.artillery || 0) : getStrengthEstimate(selectedTerritory.garrison.artillery || 0)}</span>
                </div>
                <div className="text-xs flex items-center justify-between p-1 col-span-2 bg-slate-900/60 rounded">
                  <span className="text-rose-400">غطاء جوي</span>
                  <span className="font-mono text-slate-100 font-extrabold">{isGarrisonVisible ? (selectedTerritory.garrison.jets || 0) : getStrengthEstimate(selectedTerritory.garrison.jets || 0)}</span>
                </div>
              </div>
              {!isGarrisonVisible && (
                <div className="text-[10px] text-red-400 bg-red-950/20 p-2 rounded border border-red-950/30 mt-2 leading-relaxed">
                  ⚠️ <strong>ضباب الحرب نشط:</strong> القوة العسكرية والدفاعية للخصم مخفية حالياً لحماية الأمن القومي للمحافظة. يمكنك الاستعانة بشعبة الاستخبارات التجسسية، أو بدء هجوم حربي مباشر لكشف حجم ثكنات العدو!
                </div>
              )}
            </div>

            {/* Province Infrastructure Stats for anyone to inspect (if visible) */}
            {isGarrisonVisible && (
              <div className="mb-4 bg-slate-950/30 p-3 rounded-lg border border-slate-900/60 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">الروح المعنوية للمحافظة:</span>
                  <span className={`font-mono font-bold ${
                    (selectedTerritory.morale || 100) < 45 ? 'text-rose-500 animate-pulse' : 'text-slate-300'
                  }`}>
                    {selectedTerritory.morale !== undefined ? selectedTerritory.morale : 100}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">مستوى المخابئ (التحصين):</span>
                  <span className="font-mono text-amber-400 font-bold flex items-center gap-1">
                    <span>{selectedTerritory.bunkerLevel || 0} / 3</span>
                    <span>🛡️</span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">مستوى الرادار المحمول:</span>
                  <span className="font-mono text-cyan-400 font-bold flex items-center gap-1">
                    <span>{selectedTerritory.radarLevel || 0} / 3</span>
                    <span>📡</span>
                  </span>
                </div>
              </div>
            )}

            {/* Tactical Decisions Area based on Ownership */}
            <div className="border-t border-slate-800/80 pt-4">
              {selectedTerritory.ownerCountryId === currentCountry.id ? (
                // 1. Relocation actions for OWNER country
                <div>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => { setTacticalAction('info'); }}
                      className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'info' ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/40 text-slate-400'}`}
                    >
                      معلومات عامة
                    </button>
                    <button
                      onClick={() => { setTacticalAction('deploy'); resetSliders(); }}
                      className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'deploy' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-slate-800/50 text-slate-300'}`}
                    >
                      نقل قوافل الإمداد
                    </button>
                    <button
                      onClick={() => { setTacticalAction('spawn'); }}
                      className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'spawn' ? 'bg-blue-500 text-slate-950 font-extrabold' : 'bg-slate-800/50 text-slate-300'}`}
                    >
                      تنزيل للميدان المفتوح
                    </button>
                  </div>

                  {(tacticalAction === 'info' || !tacticalAction) && (
                    <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800/60 mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          🛡️ البنية التحتية والتحصينات العسكرية:
                        </h4>
                        <p className="text-[10px] text-slate-400 mb-3">
                          قم ببناء المخابئ الحصينة لتعزيز دفاعات قواتك وخفض خسائرها، أو شبكات الرادار لكشف ضباب الحرب في القطاعات المجاورة.
                        </p>
                      </div>

                      {/* Morale Status Display */}
                      <div className="bg-slate-950/40 p-2.5 rounded border border-slate-900/80">
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-slate-400">الروح المعنوية الإقليمية</span>
                          <span className={`font-mono font-black ${
                            (selectedTerritory.morale || 100) < 40 ? 'text-rose-500' : 
                            (selectedTerritory.morale || 100) < 70 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {selectedTerritory.morale !== undefined ? selectedTerritory.morale : 100}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                          <div 
                            className={`h-full rounded transition-all duration-500 ${
                              (selectedTerritory.morale || 100) < 40 ? 'bg-rose-500 animate-pulse' : 
                              (selectedTerritory.morale || 100) < 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${selectedTerritory.morale !== undefined ? selectedTerritory.morale : 100}%` }}
                          />
                        </div>
                        {(selectedTerritory.morale !== undefined && selectedTerritory.morale < 30) && (
                          <p className="text-[9px] text-red-400 mt-1 animate-pulse leading-normal">
                            ⚠️ روح معنوية منخفضة جداً! خطر اندلاع عصيان مسلح متمرد مرتفع!
                          </p>
                        )}
                      </div>

                      {/* Bunker Level Upgrade Option */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded border border-slate-900/80 gap-1.5">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-200">المخابئ والخنادق الحصينة</span>
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-bold font-mono">
                              LVL {selectedTerritory.bunkerLevel || 0}/3
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                            {(selectedTerritory.bunkerLevel || 0) === 0 ? '+35% دفاع وقوة نيران في الدفاع' : 
                             (selectedTerritory.bunkerLevel || 0) === 1 ? '+70% دفاع و20% تقليص للخسائر' : 
                             (selectedTerritory.bunkerLevel || 0) === 2 ? '+105% دفاع و40% تقليص للخسائر' : 
                             'الحد الأقصى للتطوير (+105% دفاع و60% تقليص)'}
                          </p>
                        </div>
                        {(selectedTerritory.bunkerLevel || 0) < 3 ? (
                          <button
                            onClick={() => handleBuildFortification('bunker')}
                            className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded transition-all cursor-pointer shrink-0"
                          >
                            تطوير 🔨
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-bold shrink-0">مكتمل ✅</span>
                        )}
                      </div>

                      {/* Radar Level Upgrade Option */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded border border-slate-900/80 gap-1.5">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-200">منظومة الرادار الجوي</span>
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1 rounded font-bold font-mono">
                              LVL {selectedTerritory.radarLevel || 0}/3
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                            {(selectedTerritory.radarLevel || 0) === 0 ? 'محيط كشف متواضع (12 درجة)' : 
                             (selectedTerritory.radarLevel || 0) === 1 ? 'محيط كشف متوسط (25 درجة)' : 
                             (selectedTerritory.radarLevel || 0) === 2 ? 'محيط كشف خارق (45 درجة)' : 
                             'الحد الأقصى لكشف ضباب الحرب بالكامل'}
                          </p>
                        </div>
                        {(selectedTerritory.radarLevel || 0) < 3 ? (
                          <button
                            onClick={() => handleBuildFortification('radar')}
                            className="bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded transition-all cursor-pointer shrink-0"
                          >
                            تطوير 📡
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-bold shrink-0">مكتمل ✅</span>
                        )}
                      </div>
                    </div>
                  )}

                  {tacticalAction === 'spawn' && (
                    <div className="space-y-3 bg-blue-950/40 border border-blue-800/60 p-3.5 rounded-lg">
                      <p className="text-xs text-blue-300 font-bold mb-2">اختر الوحدة القتالية لدخول الميدان الحر:</p>
                      
                      <button onClick={() => handleSpawnMapUnit('soldier')} className="w-full text-xs py-2 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 rounded transition-colors text-right px-3 flex justify-between items-center">
                        <span>🪖 كتيبة مشاة (متوفر: {currentCountry.army.infantry})</span>
                        <span className="text-[10px] text-slate-400">100 HP</span>
                      </button>
                      <button onClick={() => handleSpawnMapUnit('tank')} className="w-full text-xs py-2 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 rounded transition-colors text-right px-3 flex justify-between items-center">
                        <span>🛡️ فرقة مدرعات (متوفر: {currentCountry.army.tanks})</span>
                        <span className="text-[10px] text-slate-400">300 HP</span>
                      </button>
                      <button onClick={() => handleSpawnMapUnit('jet')} className="w-full text-xs py-2 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 rounded transition-colors text-right px-3 flex justify-between items-center">
                        <span>✈️ سرب طيران (متوفر: {currentCountry.army.jets})</span>
                        <span className="text-[10px] text-slate-400">150 HP</span>
                      </button>
                      <button onClick={() => handleSpawnMapUnit('missile')} className="w-full text-xs py-2 bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 rounded transition-colors text-right px-3 flex justify-between items-center">
                        <span>🚀 صاروخ تكتيكي باليستي (متوفر: {currentCountry.army.missiles || 0})</span>
                        <span className="text-[10px] text-amber-500 font-bold">80 HP | دموي 🔥</span>
                      </button>
                    </div>
                  )}

                  {tacticalAction === 'deploy' && (
                    <div className="space-y-3 bg-slate-900/60 p-3 rounded-md border border-slate-800">
                      <p className="text-xs text-amber-400 font-bold">حرك القوات بين الخزينة المركزية والميدان:</p>
                      
                      {/* Infantry */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>مشاة نظامية (متوفر بالمركز: {currentCountry.army.infantry})</span>
                          <span className="font-bold text-amber-500">{infantryInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={Math.max(currentCountry.army.infantry, selectedTerritory.garrison.infantry)} 
                          value={infantryInput} onChange={(e) => setInfantryInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      {/* Tanks */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>دبابات ثقيلة (متوفر بالمركز: {currentCountry.army.tanks})</span>
                          <span className="font-bold text-amber-500">{tanksInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={Math.max(currentCountry.army.tanks, selectedTerritory.garrison.tanks)} 
                          value={tanksInput} onChange={(e) => setTanksInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      {/* Jets */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>طائرات هجومية نفاثة (متوفر بالمركز: {currentCountry.army.jets})</span>
                          <span className="font-bold text-amber-500">{jetsInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={Math.max(currentCountry.army.jets, selectedTerritory.garrison.jets)} 
                          value={jetsInput} onChange={(e) => setJetsInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      {/* AntiAir */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>منظومات دفاع جوي (متوفر بالمركز: {currentCountry.army.antiAir || 0})</span>
                          <span className="font-bold text-amber-500">{antiAirInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={Math.max(currentCountry.army.antiAir || 0, selectedTerritory.garrison.antiAir || 0)} 
                          value={antiAirInput} onChange={(e) => setAntiAirInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div className="text-[10px] text-slate-400 pb-2">
                        *ملاحظة: السلايدر ينطبق لإرسال الكتائب أو سحبها من المقاطعة.
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleDeployGarrison}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 py-1.5 rounded text-xs font-bold transition-all cursor-pointer"
                        >
                          إرسال للميدان ➕
                        </button>
                        <button
                          onClick={handleWithdrawGarrison}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-200 py-1.5 rounded text-xs transition-all cursor-pointer"
                        >
                          سحب العاصمة ➖
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // 2. Military attack options for ENEMIES OR NEUTRALS
                <div>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <button
                      onClick={() => setTacticalAction('info')}
                      className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'info' ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/40 text-slate-400'}`}
                    >
                      مواصفات الدفاع
                    </button>
                    <button
                      onClick={() => { setTacticalAction('invade'); resetSliders(); }}
                      className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'invade' ? 'bg-red-600 text-slate-100 font-extrabold shadow-lg animate-pulse' : 'bg-red-950/40 text-red-300 border border-red-900/40'}`}
                    >
                      إعلان غزو ⚔️
                    </button>
                    {selectedTerritory.ownerCountryId && (
                      <>
                        <button
                          onClick={() => { setTacticalAction('espionage'); resetSliders(); }}
                          className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'espionage' ? 'bg-purple-600 text-slate-100 font-extrabold shadow-lg animate-pulse' : 'bg-purple-950/40 text-purple-300 border border-purple-900/40'}`}
                        >
                          تجسس 🕵️
                        </button>
                        <button
                          onClick={() => { setTacticalAction('diplomacy'); resetSliders(); }}
                          className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'diplomacy' ? 'bg-sky-600 text-slate-100 font-extrabold shadow-lg animate-pulse' : 'bg-sky-950/40 text-sky-300 border border-sky-900/40'}`}
                        >
                          سلام 🕊️
                        </button>
                        <button
                          onClick={() => { setTacticalAction('airstrike'); resetSliders(); }}
                          className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'airstrike' ? 'bg-orange-600 text-slate-100 font-extrabold shadow-lg animate-pulse' : 'bg-orange-950/40 text-orange-300 border border-orange-900/40'}`}
                        >
                          قصف ✈️
                        </button>
                        <button
                          onClick={() => { setTacticalAction('negotiate'); resetSliders(); }}
                          className={`flex-1 min-w-[70px] text-[10px] sm:text-xs py-1.5 rounded font-bold cursor-pointer text-center ${tacticalAction === 'negotiate' ? 'bg-amber-600 text-slate-100 font-extrabold shadow-lg animate-pulse' : 'bg-amber-950/40 text-amber-300 border border-amber-900/40'}`}
                        >
                          تفاوض 🤝
                        </button>
                      </>
                    )}
                  </div>

                  {tacticalAction === 'espionage' && (
                    <div className="space-y-3 bg-purple-950/40 border border-purple-800/60 p-3.5 rounded-lg">
                      <p className="text-xs text-purple-300 font-bold mb-2">اختر العملية الاستخباراتية ضد ({selectedTerritory.ownerCountryName}):</p>
                      
                      <button onClick={handleReconPlane} className="w-full text-xs py-2 bg-indigo-950/40 text-indigo-300 border border-indigo-900/40 hover:bg-indigo-900/50 rounded transition-colors text-right px-3">
                        🛩️ استطلاع جوي بالطائرات (يكشف الوحدات والتفاصيل)
                      </button>
                      <button onClick={() => handleEspionage('intel')} className="w-full text-xs py-2 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 rounded transition-colors text-right px-3">
                        🕵️ عميل سري: جمع معلومات عن قواتهم
                      </button>
                      <button onClick={() => handleEspionage('steal_gold')} className="w-full text-xs py-2 bg-amber-950/40 text-amber-300 border border-amber-900/40 hover:bg-amber-900/50 rounded transition-colors text-right px-3">
                        💰 قرصنة إلكترونية وسرقة أموال
                      </button>
                      <button onClick={() => handleEspionage('steal_oil')} className="w-full text-xs py-2 bg-blue-950/40 text-blue-300 border border-blue-900/40 hover:bg-blue-900/50 rounded transition-colors text-right px-3">
                        🛢️ تخريب أنابيب وتهريب نفط
                      </button>
                      <button onClick={() => handleEspionage('sabotage_defense')} className="w-full text-xs py-2 bg-red-950/40 text-red-300 border border-red-900/40 hover:bg-red-900/50 rounded transition-colors text-right px-3">
                        💥 عمل إرهابي لتخريب دفاعات العاصمة
                      </button>
                      <div className="bg-slate-900 border border-slate-700/50 p-2.5 rounded text-[10px] text-slate-300 mb-2 leading-relaxed mt-2">
                        ⚠️ إرسال العملاء السريين يتطلب <span className="text-amber-400 font-bold">150 ذهب</span> وتمويل سري. الاستطلاع الجوي يتطلب <span className="text-blue-400 font-bold">1 طائرة استطلاع و 100 نفط</span>.
                      </div>
                    </div>
                  )}

                  {tacticalAction === 'diplomacy' && (
                    <div className="space-y-3 bg-sky-950/40 border border-sky-800/60 p-3.5 rounded-lg text-center">
                      <p className="text-xs text-sky-300 font-bold mb-2">هل ترغب في فتح قناة تواصل لإنهاء الحرب؟</p>
                      <p className="text-[10px] text-slate-400 mb-3">
                        سيتم إرسال برقية سلام علنية عبر موجات الراديو الدولية للدولة الهدف. القرار يعود لقائدهم.
                      </p>
                      <button onClick={() => handleDiplomacy()} className="w-full text-xs font-bold py-2 bg-sky-700 text-slate-100 hover:bg-sky-600 rounded shadow-md transition-colors">
                        إرسال مبعوث سلام ومقترح إيقاف إطلاق النار
                      </button>
                    </div>
                  )}

                  {tacticalAction === 'negotiate' && (
                    <div className="space-y-3 bg-amber-950/40 border border-amber-800/60 p-3.5 rounded-lg">
                      <p className="text-xs text-amber-300 font-bold mb-2">إرسال رسالة تفاوض خاصة إلى {selectedTerritory.ownerCountryName}:</p>
                      <textarea
                        value={negotiateInput}
                        onChange={(e) => setNegotiateInput(e.target.value)}
                        placeholder="اكتب رسالتك السرية هنا... (مثال: انسحب وسندفع لك الذهب)"
                        className="w-full h-20 bg-slate-800 text-slate-200 border border-slate-700 rounded p-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
                      />
                      <button 
                        onClick={handleNegotiate} 
                        disabled={!negotiateInput.trim()}
                        className="w-full text-xs font-bold py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-slate-100 rounded shadow-md transition-colors mt-2"
                      >
                        إرسال الرسالة السرية 📩
                      </button>
                    </div>
                  )}

                  {tacticalAction === 'airstrike' && (
                    <div className="space-y-3 bg-orange-950/40 border border-orange-800/60 p-3.5 rounded-lg text-center">
                      <p className="text-xs text-orange-300 font-bold mb-2">هل تريد توجيه ضربة جوية أو صاروخية؟</p>
                      <p className="text-[10px] text-slate-400 mb-3">
                        سيتم استهداف البنية التحتية والوحدات العسكرية، لكن طائراتك معرضة للإسقاط من قبل الدفاعات الجوية.
                      </p>
                      <button onClick={async () => {
                        try {
                          await executeAirStrike(selectedTerritory.id);
                          alert('تم شن الغارة الجوية. تم تحديث سجل العمليات.');
                          setTacticalAction('info');
                        } catch (e) { console.error(e); }
                      }} className="w-full text-xs font-bold py-2 bg-orange-700 text-slate-100 hover:bg-orange-600 rounded shadow-md transition-colors">
                        إطلاق الغارة الجوية 🚀
                      </button>
                    </div>
                  )}

                  {tacticalAction === 'invade' && (
                    <div className="space-y-3 bg-red-950/40 border border-red-800/60 p-3.5 rounded-lg">
                      <p className="text-xs text-red-300 font-bold">حدد حجم قوة الكتائب المراد شنها لضرب الهدف:</p>
                      
                      {/* Infantry */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>مشاة نظامية (الحد الأقصى للتجنيد: {currentCountry.army.infantry})</span>
                          <span className="font-bold text-red-400">{infantryInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={currentCountry.army.infantry} 
                          value={infantryInput} onChange={(e) => setInfantryInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                      {/* Special Forces */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>قوات خاصة من النخبة (الحد الأقصى: {currentCountry.army.specialForces})</span>
                          <span className="font-bold text-red-400">{specialForcesInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={currentCountry.army.specialForces} 
                          value={specialForcesInput} onChange={(e) => setSpecialForcesInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                      {/* Tanks */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>دبابات حربية (الحد الأقصى: {currentCountry.army.tanks})</span>
                          <span className="font-bold text-red-400">{tanksInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={currentCountry.army.tanks} 
                          value={tanksInput} onChange={(e) => setTanksInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                      {/* Jets */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>سرب مقاتلات نفاثة (الحد الأقصى: {currentCountry.army.jets})</span>
                          <span className="font-bold text-red-400">{jetsInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={currentCountry.army.jets} 
                          value={jetsInput} onChange={(e) => setJetsInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                      {/* AntiAir */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>منظومات دفاع جوي (الحد الأقصى: {currentCountry.army.antiAir || 0})</span>
                          <span className="font-bold text-red-400">{antiAirInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={currentCountry.army.antiAir || 0} 
                          value={antiAirInput} onChange={(e) => setAntiAirInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                      {/* Missiles */}
                      <div className="text-xs">
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>صواريخ باليستية (الحد الأقصى: {currentCountry.army.missiles || 0})</span>
                          <span className="font-bold text-red-400">{missilesInput}</span>
                        </div>
                        <input 
                          type="range" min="0" max={currentCountry.army.missiles || 0} 
                          value={missilesInput} onChange={(e) => setMissilesInput(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                        <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 my-2 text-xs text-center space-y-1">
                          <div className="text-slate-400 font-bold mb-1">تكلفة سير القوات:</div>
                          <div className="flex justify-center gap-4">
                            <span className={currentCountry.gold < (infantryInput + specialForcesInput + tanksInput + artilleryInput + jetsInput + antiAirInput + missilesInput) ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'}>
                              {infantryInput + specialForcesInput + tanksInput + artilleryInput + jetsInput + antiAirInput + missilesInput} ذهب
                            </span>
                            <span className={currentCountry.oil < (tanksInput * 2 + jetsInput * 5 + missilesInput * 10) ? 'text-red-500 font-bold' : 'text-slate-300 font-bold'}>
                              {(tanksInput * 2) + (jetsInput * 5) + (missilesInput * 10)} نفط
                            </span>
                          </div>
                        </div>

                      <button
                        onClick={handleLaunchInvasion}
                        className="w-full bg-red-650 hover:bg-red-700 active:scale-95 text-slate-100 py-2.5 rounded text-xs font-black tracking-widest transition-all cursor-pointer border border-red-500/30 flex items-center justify-center gap-2"
                      >
                        <Sword className="w-4 h-4" />
                        إرسال القوات وتوجيه الضربة ضربة قاضية!
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between h-full space-y-6">
            <div className="flex flex-col justify-center items-center text-center py-6 text-slate-400 border-b border-slate-800 pb-6 select-none">
              <Compass className="w-12 h-12 text-slate-600 mb-3 animate-bounce" />
              <h3 className="text-base font-bold text-slate-300 mb-1">غرفة تقدير الموقف والعمليات</h3>
              <p className="text-xs max-w-[280px] leading-relaxed">حدد أي مقاطعة على الخريطة لعرض تفاصيل السيادة، الحامية، والموارد، أو التعامل معها عسكرياً ودبلوماسياً.</p>
            </div>

            {/* AI Bots Control and List */}
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <span>قوات الذكاء الاصطناعي الفعالة (🤖 BOTS)</span>
                  </h4>
                  <span className="bg-blue-900/40 text-blue-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-800/40">
                    العدد: {countries.filter(c => c.isBot).length}
                  </span>
                </div>

                <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-900 space-y-2 max-h-[250px] overflow-y-auto">
                  {countries.filter(c => c.isBot).length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      لا توجد دول بوتات نشطة حالياً. يمكنك تجنيد حلفاء آليين بالأسفل!
                    </div>
                  ) : (
                    countries.filter(c => c.isBot).map((bc) => {
                      const landCount = territories.filter(t => t.ownerCountryId === bc.id).length;
                      return (
                        <div 
                          key={bc.id} 
                          onClick={() => {
                            const firstTerr = territories.find(t => t.ownerCountryId === bc.id);
                            if (firstTerr) {
                              handleSelectTerritory(firstTerr);
                            } else {
                              alert(`هذه الدولة [${bc.name}] لا تمتلك أراضي حالياً، يمكنك غزو أراضي محايدة لصالحها.`);
                            }
                          }}
                          className="bg-slate-900/80 hover:bg-slate-850 px-2.5 py-2 rounded border border-slate-800/65 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-xl filter drop-shadow select-none">{bc.flagUrl || '🤖'}</span>
                            <div>
                              <p className="font-bold text-slate-200 flex items-center gap-1">
                                {bc.name}
                              </p>
                              <p className="text-[10px] text-slate-400">العاصمة: {bc.capital}</p>
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded text-[10px] text-cyan-400 font-bold border border-slate-800">
                              {landCount} مقاطعة
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Add Bot Action Button */}
              <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed text-right">
                  💡 هل تود زيادة حدة المنافسة وتوسيع نطاق الجبهة؟ يمكنك استدعاء دول تحكم آلي إضافية لتستحوذ على مناطق شاغرة وتتحرك كلاعبين افتراضيين عسكريين.
                </p>
                <button
                  onClick={addBotCountry}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-2 rounded text-xs font-black shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-blue-500/30"
                >
                  <span className="text-sm">🤖</span>
                  تمكين وتفعيل دولة بوت عسكري جديد
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
