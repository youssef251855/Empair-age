"use client";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType,
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc,
  deleteDoc,
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  getDoc
} from '../lib/firebase';
import { 
  Country, 
  Territory, 
  Building, 
  Alliance, 
  BattleReport, 
  ChatMessage, 
  WorldEvent, 
  Spy, 
  Army,
  Garrison,
  GameMatch,
  AllianceRequest
} from '../types';
import { seedProvincesFromGeoJSON } from '../services/provinceService';
import { 
  MAP_TERRITORIES, 
  BUILDING_DEFS, 
  UNIT_DEFS, 
  WORLD_EVENT_TEMPLATES, 
  RESEARCH_TECHS 
} from '../lib/gameData';
import { SOVEREIGN_CONFIGS, getRealisticStartingArmy } from '../services/countriesData';

interface GameContextType {
  currentUser: FirebaseUser | null;
  currentCountry: Country | null;
  countries: Country[];
  territories: Territory[];
  alliances: Alliance[];
  battles: BattleReport[];
  messages: ChatMessage[];
  spies: Spy[];
  activeSeason: { id: string; number: number; startTime: string; title: string } | null;
  loading: boolean;
  activeChatTab: 'global' | 'alliance' | 'private';
  selectedPrivateRecipient: { id: string; name: string } | null;
  
  // Matches state
  selectedMatchId: string | null;
  selectMatch: (id: string | null) => void;
  matches: GameMatch[];
  allMyCountries: Country[];

  // Game Actions
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  registerCountry: (data: { name: string; flagEmoji: string; color: string; capital: string; description: string; leaderName: string; claimCountryId?: string }) => Promise<void>;
  buildOrUpgrade: (type: keyof typeof BUILDING_DEFS) => Promise<void>;
  trainArmy: (unitType: keyof Army, count: number) => Promise<void>;
  moveGarrisonToTerritory: (territoryId: string, units: Partial<Garrison>) => Promise<void>;
  withdrawGarrisonFromTerritory: (territoryId: string, units: Partial<Garrison>) => Promise<void>;
  attackTerritory: (territoryId: string, forces: Partial<Army>) => Promise<void>;
  executeAirStrike: (territoryId: string) => Promise<void>;
  resolveClashingBattle: (territoryId: string) => Promise<void>;
  executeEspionage: (targetCountryId: string, mission: 'intel' | 'steal_oil' | 'steal_gold' | 'sabotage_defense' | 'recon', isReconPlane?: boolean) => Promise<void>;
  rechargeCredits: () => Promise<void>;
  addBotCountry: () => Promise<void>;
  
  // Alliances
  createAlliance: (name: string, tag: string, description: string) => Promise<void>;
  joinAlliance: (allianceId: string) => Promise<void>;
  leaveAlliance: () => Promise<void>;
  donateResourceToAlliance: (resource: 'gold' | 'oil' | 'iron' | 'food', amount: number) => Promise<void>;
  allianceRequests: AllianceRequest[];
  sendAllianceRequest: (allianceId: string) => Promise<void>;
  acceptAllianceRequest: (request: AllianceRequest) => Promise<void>;
  declineAllianceRequest: (request: AllianceRequest) => Promise<void>;
  
  // Communication
  sendChatMessage: (text: string) => Promise<void>;
  setChatConfig: (tab: 'global' | 'alliance' | 'private', recipient: { id: string; name: string } | null) => void;
  
  // Admin Backdoor Actions
  isAdmin: boolean;
  triggerRandomWorldEvent: () => Promise<void>;
  adminResetSeason: () => Promise<void>;
  adminBanCountry: (countryId: string, banStatus: boolean) => Promise<void>;
  harvestLocalTick: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentCountry, setCurrentCountry] = useState<Country | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [battles, setBattles] = useState<BattleReport[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [spies, setSpies] = useState<Spy[]>([]);
  const [allianceRequests, setAllianceRequests] = useState<AllianceRequest[]>([]);
  const [activeSeason, setActiveSeason] = useState<{ id: string; number: number; startTime: string; title: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  const [activeChatTab, setActiveChatTab] = useState<'global' | 'alliance' | 'private'>('global');
  const [selectedPrivateRecipient, setSelectedPrivateRecipient] = useState<{ id: string; name: string } | null>(null);

  // New campaign matches tracking
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(() => {
    return localStorage.getItem('selected_match_id');
  });
  const [matches, setMatches] = useState<GameMatch[]>([]);
  const [allMyCountries, setAllMyCountries] = useState<Country[]>([]);

  const selectMatch = (id: string | null) => {
    setSelectedMatchId(id);
    if (id) {
      localStorage.setItem('selected_match_id', id);
    } else {
      localStorage.removeItem('selected_match_id');
    }
  };

  // Ticker ref to avoid writing excessively to DB but synchronize smoothly in intervals
  const resourceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Simple admin claim checks or email match from context
        if (user.email === 'efootballpes2025ff@gmail.com' || user.email?.endsWith('@empire.com')) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setCurrentCountry(null);
        setCountries([]);
        setTerritories([]);
        setAlliances([]);
        setBattles([]);
        setSpies([]);
        setMessages([]);
        setIsAdmin(false);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // 1.1 Listen to Matches (Campaign Maps) and perform 12h auto-generation
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const list: GameMatch[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as GameMatch);
      });
      setMatches(list);

      // Auto-generate if empty or if 12h passed
      const generateNewMap = async () => {
        const campaignNames = [
          "الحرب العالمية الثالثة: فجر الهلاك",
          "حرب الشرق الأوسط: عاصفة الرمال",
          "صراع القوى العظمى: التفوق العسكري",
          "معركة البحر الأحمر: مضيق النار",
          "الأزمة السيبيرية: الشتاء الأحمر",
          "مواجهة الخليج العربي: خط النار",
          "سيراليون: جبهة الغزو المباشر",
          "القطب الشمالي: الحرب الصامتة"
        ];
        const randName = campaignNames[Math.floor(Math.random() * campaignNames.length)];
        const matchId = `match_${Date.now()}`;
        const newMatch: GameMatch = {
          id: matchId,
          name: `${randName} #${Math.floor(100 + Math.random() * 900)}`,
          createdAt: new Date().toISOString(),
          active: true
        };
        try {
          await setDoc(doc(db, 'matches', matchId), newMatch);
          console.log(`Successfully generated new campaign map: ${newMatch.name}`);
          
          // Actually seed the bot countries and territories IMMEDIATELY upon match creation!
          try {
            const response = await fetch('/assets/maps/countries-50m.json');
            if (response.ok) {
              const geojson = await response.json();
              await seedProvincesFromGeoJSON(geojson, matchId);
              console.log(`Successfully seeded bots & territories for match ${matchId}`);
            }
          } catch (err) {
            console.error("Failed to seed geojson when creating map:", err);
          }
        } catch (e) {
          console.error("Failed to generate campaign map:", e);
        }
      };

      if (list.length === 0) {
        await generateNewMap();
      } else {
        const latestMatch = list[0];
        const latestTime = new Date(latestMatch.createdAt).getTime();
        const diffMs = Date.now() - latestTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours >= 12) {
          await generateNewMap();
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'matches');
    });
    return () => unsub();
  }, [currentUser]);

  // 1.2 Track all user's country references across ALL campaigns
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'countries'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: Country[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Country);
      });
      setAllMyCountries(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'countries');
    });
    return () => unsub();
  }, [currentUser]);

  // 2. Fetch Active Season settings (fallback to hardcoded or auto-created first)
  useEffect(() => {
    if (!currentUser) return;
    const path = 'seasons';
    const q = query(collection(db, path), where('active', '==', true), limit(1));
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        // Create an initial season if database is empty
        const initialSeason = {
          id: 'season_1',
          number: 1,
          startTime: new Date().toISOString(),
          active: true,
          title: 'الموسم الافتتاحي: فجر الإمبراطوريات'
        };
        try {
          await setDoc(doc(db, 'seasons', 'season_1'), initialSeason);
          setActiveSeason({
            id: 'season_1',
            number: 1,
            startTime: initialSeason.startTime,
            title: initialSeason.title
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'seasons/season_1');
        }
      } else {
        const d = snap.docs[0].data();
        setActiveSeason({
          id: snap.docs[0].id,
          number: d.number,
          startTime: d.startTime,
          title: d.title || `الموسم رقم ${d.number}`
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsub();
  }, [currentUser]);

  // 3. Sync Countries data dynamically for the selected match
  useEffect(() => {
    if (!currentUser) return;
    if (!selectedMatchId) {
      setCountries([]);
      setCurrentCountry(null);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'countries'), where('matchId', '==', selectedMatchId));
    const unsub = onSnapshot(q, (snap) => {
      const countryList: Country[] = [];
      snap.forEach((doc) => {
        countryList.push({ id: doc.id, ...doc.data() } as Country);
      });
      setCountries(countryList);
      
      // Update our player's active nation representation inside this match
      const found = countryList.find(c => c.userId === currentUser.uid);
      if (found) {
        setCurrentCountry(found);
      } else {
        setCurrentCountry(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'countries');
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser, selectedMatchId]);

  // 4. Monitor dynamic map territories for the selected match
  useEffect(() => {
    if (!currentUser) return;
    if (!selectedMatchId) {
      setTerritories([]);
      return;
    }
    const q = query(collection(db, 'territories'), where('matchId', '==', selectedMatchId));
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        setTerritories([]);
      } else {
        const list: Territory[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Territory);
        });
        // Sort territories for structured rendering
        list.sort((a,b) => a.id.localeCompare(b.id));
        setTerritories(list);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'territories');
    });
    return () => unsub();
  }, [currentUser, selectedMatchId]);

  // 5. Monitor battles for the selected match
  useEffect(() => {
    if (!currentUser) return;
    if (!selectedMatchId) {
      setBattles([]);
      return;
    }
    const q = query(collection(db, 'battles'), where('matchId', '==', selectedMatchId), orderBy('timestamp', 'desc'), limit(40));
    const unsub = onSnapshot(q, (snap) => {
      const reportList: BattleReport[] = [];
      snap.forEach((doc) => {
        reportList.push({ id: doc.id, ...doc.data() } as BattleReport);
      });
      setBattles(reportList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'battles');
    });
    return () => unsub();
  }, [currentUser, selectedMatchId]);

  // 6. Monitor spy logs for the selected match
  useEffect(() => {
    if (!currentUser) return;
    if (!selectedMatchId) {
      setSpies([]);
      return;
    }
    const q = query(collection(db, 'spies'), where('matchId', '==', selectedMatchId));
    const unsub = onSnapshot(q, (snap) => {
      const spyList: Spy[] = [];
      snap.forEach((doc) => {
        spyList.push({ id: doc.id, ...doc.data() } as Spy);
      });
      setSpies(spyList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'spies');
    });
    return () => unsub();
  }, [currentUser, selectedMatchId]);

  // 7. Monitor alliances for the selected match
  useEffect(() => {
    if (!currentUser) return;
    if (!selectedMatchId) {
      setAlliances([]);
      return;
    }
    const q = query(collection(db, 'alliances'), where('matchId', '==', selectedMatchId));
    const unsub = onSnapshot(q, (snap) => {
      const list: Alliance[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Alliance);
      });
      setAlliances(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'alliances');
    });
    return () => unsub();
  }, [currentUser, selectedMatchId]);

  // Monitor alliance requests for the selected match
  useEffect(() => {
    if (!currentUser) return;
    if (!selectedMatchId) {
      setAllianceRequests([]);
      return;
    }
    const q = query(collection(db, 'alliance_requests'), where('matchId', '==', selectedMatchId));
    const unsub = onSnapshot(q, (snap) => {
      const list: AllianceRequest[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as AllianceRequest);
      });
      setAllianceRequests(list);
    }, (error) => {
      console.error("Error listing alliance requests: ", error);
    });
    return () => unsub();
  }, [currentUser, selectedMatchId]);

  // 8. Stream global & alliance messages for the selected match
  useEffect(() => {
    if (!currentUser) return;
    if (!selectedMatchId) {
      setMessages([]);
      return;
    }
    const q = query(collection(db, 'messages'), where('matchId', '==', selectedMatchId), orderBy('timestamp', 'desc'), limit(80));
    const unsub = onSnapshot(q, (snap) => {
      const list: ChatMessage[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      // Sort ascending to align with scrolling chat history
      setMessages(list.reverse());
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });
    return () => unsub();
  }, [currentUser, selectedMatchId]);

  // 9. Economy production ticker
  // To avoid hitting write quotas we let resources accumulate in client memory, but trigger auto-save checks
  // or incremental updates on important operations. We also execute a local ticking interval.
  const harvestLocalTick = () => {
    if (!currentCountry || currentCountry.isBanned) return;
    
    // Count player buildings
    const ownedTerritories = territories.filter(t => t.ownerCountryId === currentCountry.id);
    
    // Base harvesting amounts
    let goldGain = 20; 
    let oilGain = 10;
    let ironGain = 15;
    let foodGain = 15;
    let powerTotal = 25;

    // Build contributions based on Level 1-5 building progression
    const countryBuildings = currentCountry.buildings || {};
    if (countryBuildings.mine) {
      ironGain += countryBuildings.mine * 30; // Level 1: +30, Level 5: +150
    }
    if (countryBuildings.farm) {
      foodGain += countryBuildings.farm * 35; // Level 1: +35, Level 5: +175
    }
    if (countryBuildings.factory) {
      oilGain += countryBuildings.factory * 25; // Level 1: +25, Level 5: +125
    }
    if (countryBuildings.power_station) {
      powerTotal += countryBuildings.power_station * 80; // Level 1: +80, Level 5: +400
    }
    if (countryBuildings.research_center) {
      goldGain += countryBuildings.research_center * 40; // Level 1: +40, Level 5: +200
    }

    const taxRate = currentCountry.taxRate || 20;
    // Morale change based on tax rate: low taxes boost morale, excessive taxes drain it
    const moraleChange = taxRate > 60 ? -5 : (taxRate > 45 ? -2 : (taxRate < 20 ? 6 : 4));

    // Dynamic bonuses from occupied territories specialization
    ownedTerritories.forEach(async (t) => {
      const currentMorale = t.morale !== undefined ? t.morale : 100;
      const nextMorale = Math.max(0, Math.min(100, currentMorale + moraleChange));

      // 12% rebellion chance if morale is dangerously low (< 30)
      if (nextMorale < 30 && Math.random() < 0.12) {
        try {
          // Trigger Rebel uprising!
          await updateDoc(doc(db, 'territories', t.id), {
            ownerCountryId: 'rebels',
            ownerCountryName: 'متمردون مسلحون',
            color: '#3b0764', // Dark Purple for Rebels
            bunkerLevel: 0,
            radarLevel: 0,
            morale: 40,
            garrison: {
              infantry: 12,
              tanks: 2,
              jets: 0,
              specialForces: 0,
              artillery: 0,
              antiAir: 0,
              missiles: 0
            }
          });
          // Send public alert about rebellion
          await addDoc(collection(db, 'messages'), {
            matchId: selectedMatchId || 'default',
            senderName: 'الاستخبارات العسكرية',
            text: `⚠️ اندلعت ثورة متمردين مسلحة في مقاطعة [${t.name}] بسبب تدهور الروح المعنوية والضرائب الجائرة! سقطت ثكنات الحامية بالكامل.`,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.error("Rebellion trigger error:", e);
        }
        return;
      }

      // Save morale updates to DB
      if (nextMorale !== currentMorale) {
        try {
          await updateDoc(doc(db, 'territories', t.id), {
            morale: nextMorale
          });
        } catch (e) {
          console.error("Failed to update morale tick:", e);
        }
      }

      const mult = t.resourceMultiplier || 1.0;
      // Morale directly scales down production! Low morale = heavy industrial strike/low yield
      const moraleFactor = nextMorale / 100;

      if (t.resourceSpecialty === 'gold') goldGain += 10 * mult * moraleFactor;
      if (t.resourceSpecialty === 'oil') oilGain += 10 * mult * moraleFactor;
      if (t.resourceSpecialty === 'iron') ironGain += 10 * mult * moraleFactor;
      if (t.resourceSpecialty === 'food') foodGain += 15 * mult * moraleFactor;
      if (t.resourceSpecialty === 'electricity') powerTotal += 15 * mult * moraleFactor;
    });

    // Handle high unemployment penalty or tax collection yields
    const popRate = currentCountry.population || 500000;
    const taxesCollected = Math.floor((popRate / 10000) * (currentCountry.taxRate / 10));
    goldGain += taxesCollected;

    // Apply simple decay / maintenance penalty
    const armyMaintenance = Math.floor(
      (currentCountry.army.infantry * 0.1) +
      (currentCountry.army.specialForces * 0.5) +
      (currentCountry.army.tanks * 2) +
      (currentCountry.army.jets * 5)
    );
    foodGain = Math.max(0, foodGain - Math.floor(armyMaintenance * 0.2));
    goldGain = Math.max(0, goldGain - Math.floor(armyMaintenance * 0.5));

    // Offline checking & ticking state incrementation
    // Also increase population gradually realistically
    const popGrowthRate = 0.0005; // 0.05% growth per tick
    const actPop = currentCountry.population || 500000;
    const newPop = Math.floor(actPop + (actPop * popGrowthRate));

    const updated = {
      ...currentCountry,
      gold: Math.floor(currentCountry.gold + goldGain),
      oil: Math.floor(currentCountry.oil + oilGain),
      iron: Math.floor(currentCountry.iron + ironGain),
      food: Math.floor(currentCountry.food + foodGain),
      electricity: Math.min(500, currentCountry.electricity + powerTotal),
      population: newPop
    };

    // Save back to db after caching or immediately (every 30s we can trigger auto-db save)
    try {
      updateDoc(doc(db, 'countries', currentCountry.id), {
        gold: updated.gold,
        oil: updated.oil,
        iron: updated.iron,
        food: updated.food,
        electricity: updated.electricity,
        population: updated.population,
        lastHarvestTime: new Date().toISOString()
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, `countries/${currentCountry.id}`);
    }
  };

  useEffect(() => {
    if (currentCountry) {
      resourceTimerRef.current = setInterval(() => {
        harvestLocalTick();
      }, 20000); // Ticks every 20 seconds IRL
    }
    return () => {
      if (resourceTimerRef.current) clearInterval(resourceTimerRef.current);
    };
  }, [currentCountry, territories]);

  // Auth Operations
  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Sign-in failed: ", e);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      console.error("Email sign-in failed: ", e);
      throw e;
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      console.error("Email registration failed: ", e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign-out failed: ", e);
    }
  };

  // Create Player Nation Profile or claim an existing bot nation
  const registerCountry = async (data: { 
    name: string; 
    flagEmoji: string; 
    color: string; 
    capital: string; 
    description: string; 
    leaderName: string;
    claimCountryId?: string;
  }) => {
    if (!currentUser || !selectedMatchId) return;

    // If reclaiming/governing an existing BOT sovereign country!
    if (data.claimCountryId) {
      try {
        const countryRef = doc(db, 'countries', data.claimCountryId);
        await updateDoc(countryRef, {
          userId: currentUser.uid,
          isBot: false,
          leaderName: data.leaderName,
          capital: data.capital,
          description: data.description || "سلطة سيادية تم تولي قيادتها وإلغاء التحكم الآلي عنها من قبل القائد العسكري.",
          gold: 3000, // Claim boost!
          oil: 1500,
          iron: 1500,
          food: 1800,
          electricity: 150,
          empireCredits: 1000 // Free starter premium credits! 💎
        });

        // Register user details
        await setDoc(doc(db, 'users', currentUser.uid), {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || data.leaderName,
          countryId: data.claimCountryId,
          isAdmin: isAdmin,
          createdAt: new Date().toISOString()
        });

        alert(`تم استلام مقاليد الحكم لـ [${data.name}] بنجاح! تم تعطيل نظام التحكم الآلي البوت 🤖 وتفويض كامل الصلاحيات لسيادتكم.`);
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `countries/${data.claimCountryId}`);
        return;
      }
    }

    // Otherwise create custom from scratch
    const countryId = `country_${currentUser.uid.slice(0, 6)}_${selectedMatchId}`;
    const initCountry: Country & { matchId: string } = {
      id: countryId,
      userId: currentUser.uid,
      matchId: selectedMatchId,
      name: data.name,
      flagUrl: data.flagEmoji,
      color: data.color,
      description: data.description,
      capital: data.capital,
      leaderName: data.leaderName,
      gold: 2500,
      oil: 1000,
      iron: 1200,
      food: 1500,
      electricity: 100,
      population: 1500000,
      unemploymentRate: 10,
      taxRate: 15,
      allianceId: null,
      allianceName: null,
      army: getRealisticStartingArmy("EGY"),
      createdAt: new Date().toISOString(),
      lastHarvestTime: new Date().toISOString(),
      isBot: false,
      empireCredits: 500 // custom starts with 500 Credits 💎
    };

    try {
      await setDoc(doc(db, 'countries', countryId), initCountry);
      // Auto register user detail
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || data.leaderName,
        countryId,
        isAdmin: isAdmin,
        createdAt: new Date().toISOString()
      });
      // Claim 1 starting neutral territory randomly to start the game
      const neutralTerritories = territories.filter(t => t.ownerCountryId === null);
      if (neutralTerritories.length > 0) {
        const target = neutralTerritories[Math.floor(Math.random() * neutralTerritories.length)];
        await updateDoc(doc(db, 'territories', target.id), {
          ownerCountryId: countryId,
          ownerCountryName: data.name,
          flagEmoji: data.flagEmoji,
          color: data.color,
          isCapital: true,
          garrison: {
            infantry: 40,
            specialForces: 2,
            tanks: 0,
            artillery: 0,
            antiAir: 0,
            jets: 0,
            missiles: 0
          }
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'countries');
    }
  };

  // Build Operations (directly updates attributes instantly)
  const buildOrUpgrade = async (type: keyof typeof BUILDING_DEFS) => {
    if (!currentCountry) return;
    const def = BUILDING_DEFS[type];
    
    // Determine current level and check maximum
    const currentLevel = currentCountry.buildings?.[type] || 0;
    if (currentLevel >= 5) {
      alert("⚠️ وصلت هذه المنشأة بالفعل إلى المستوى الأقصى (مستوى 5)!");
      return;
    }

    // Cost multiplier starts at 1x, then increases: level 1 to 2 is 1.5x, 2 to 3 is 2.5x, etc.
    const costMultiplier = currentLevel === 0 ? 1.0 : currentLevel * 1.5;
    const dynamicCost = {
      gold: Math.floor(def.cost.gold * costMultiplier),
      iron: Math.floor(def.cost.iron * costMultiplier),
      oil: Math.floor(def.cost.oil * costMultiplier)
    };

    let useCredits = false;
    if (currentCountry.gold < dynamicCost.gold || currentCountry.iron < dynamicCost.iron || currentCountry.oil < dynamicCost.oil) {
      const premiumCost = 150;
      if ((currentCountry.empireCredits || 0) >= premiumCost) {
        const confirmCredits = window.confirm(`الموارد الحالية غير كافية لعملية التشييد/الترقية. هل ترغب في تمويل المنشأة فورياً بدعم لوجستي عاجل بقيمة ${premiumCost} 💎 من السندات الإمبراطورية؟`);
        if (confirmCredits) {
          useCredits = true;
        } else {
          return;
        }
      } else {
        alert("عذراً، الخزانة الوطنية لا تمتلك الموارد الكافية لتشييد أو ترقية هذا الصرح الاستراتيجي، ورصيد السندات الحربية غير كافٍ كذلك!");
        return;
      }
    }

    const nextLevel = currentLevel + 1;
    const updatedBuildings = {
      ...(currentCountry.buildings || {}),
      [type]: nextLevel
    };

    const updated = {
      ...currentCountry,
      gold: useCredits ? currentCountry.gold : currentCountry.gold - dynamicCost.gold,
      iron: useCredits ? currentCountry.iron : currentCountry.iron - dynamicCost.iron,
      oil: useCredits ? currentCountry.oil : currentCountry.oil - dynamicCost.oil,
      empireCredits: useCredits ? (currentCountry.empireCredits || 0) - 150 : (currentCountry.empireCredits || 0),
      population: currentCountry.population + 15000 * nextLevel, // attracts more migrants at higher levels
      unemploymentRate: Math.max(2, currentCountry.unemploymentRate - 1.5 * nextLevel), // creates more jobs
      buildings: updatedBuildings
    };

    try {
      await setDoc(doc(db, 'countries', currentCountry.id), updated);
      if (currentLevel === 0) {
        alert(`⚡ تم تشييد منشأة [${def.arabicName}] فواً بمستوى 1 ودخولها الخدمة الميدانية العسكرية والأمنية بنجاح!`);
      } else {
        alert(`⚡ تم ترقية منشأة [${def.arabicName}] بنجاح إلى المستوى [${nextLevel}]!`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `countries/${currentCountry.id}`);
    }
  };

  // Train military battalions and update inventory status
  const trainArmy = async (unitType: keyof Army, count: number) => {
    if (!currentCountry) return;
    const def = UNIT_DEFS[unitType];
    const totalCost = {
      gold: def.cost.gold * count,
      iron: def.cost.iron * count,
      oil: def.cost.oil * count,
      food: def.cost.food * count
    };

    if (
      currentCountry.gold < totalCost.gold || 
      currentCountry.iron < totalCost.iron || 
      currentCountry.oil < totalCost.oil ||
      currentCountry.food < totalCost.food
    ) {
      alert("عذراً؛ نقص في المعادن الاستراتيجية أو الخزانة للتمكن من حشد هذا الحجم للجيوش!");
      return;
    }

    const newArmy = { ...currentCountry.army };
    newArmy[unitType] = (newArmy[unitType] || 0) + count;

    const updated = {
      ...currentCountry,
      gold: currentCountry.gold - totalCost.gold,
      iron: currentCountry.iron - totalCost.iron,
      oil: currentCountry.oil - totalCost.oil,
      food: currentCountry.food - totalCost.food,
      army: newArmy
    };

    try {
      await setDoc(doc(db, 'countries', currentCountry.id), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `countries/${currentCountry.id}`);
    }
  };

  // Deploy forces to occupied areas (Move Garrison)
  const moveGarrisonToTerritory = async (territoryId: string, units: Partial<Garrison>) => {
    if (!currentCountry) return;
    const territoryRef = doc(db, 'territories', territoryId);
    const terr = territories.find(t => t.id === territoryId);
    if (!terr || terr.ownerCountryId !== currentCountry.id) return;

    // Deduct from national reserve army pool
    const reserves = { ...currentCountry.army };
    const garrison = { ...terr.garrison };

    // Move logic
    Object.keys(units).forEach((key) => {
      const gkey = key as keyof Garrison;
      const amount = units[gkey] || 0;
      if (reserves[gkey] >= amount) {
        reserves[gkey] -= amount;
        garrison[gkey] = (garrison[gkey] || 0) + amount;
      }
    });

    try {
      await updateDoc(doc(db, 'countries', currentCountry.id), { army: reserves });
      await updateDoc(territoryRef, { garrison });
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, `countries/${currentCountry.id}`);
    }
  };

  // Withdraw Garrison back to central forces
  const withdrawGarrisonFromTerritory = async (territoryId: string, units: Partial<Garrison>) => {
    if (!currentCountry) return;
    const territoryRef = doc(db, 'territories', territoryId);
    const terr = territories.find(t => t.id === territoryId);
    if (!terr || terr.ownerCountryId !== currentCountry.id) return;

    const reserves = { ...currentCountry.army };
    const garrison = { ...terr.garrison };

    Object.keys(units).forEach((key) => {
      const gkey = key as keyof Garrison;
      const amount = units[gkey] || 0;
      if (garrison[gkey] >= amount) {
        garrison[gkey] -= amount;
        reserves[gkey] = (reserves[gkey] || 0) + amount;
      }
    });

    try {
      await updateDoc(doc(db, 'countries', currentCountry.id), { army: reserves });
      await updateDoc(territoryRef, { garrison });
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, `countries/${currentCountry.id}`);
    }
  };

  // Primary Battle Engine for conquering territories with modern Clashing delay (وقت الاشتباك العسكري)
  const attackTerritory = async (territoryId: string, forces: Partial<Army>) => {
    if (!currentCountry) return;
    const target = territories.find(t => t.id === territoryId);
    if (!target) return;

    if (target.ownerCountryId === currentCountry.id) {
      alert("هذه المقاطعة خاضعة لسيطرتك بالفعل!");
      return;
    }

    if (target.battleStatus === 'clashing') {
      alert("⚠️ المقاطعة تشهد حالياً معارك ضارية والتحامات مستعرة بالفعل! لا يمكن زج كتائب إضافية في الفوضى.");
      return;
    }

    // Verify player actually has the forces they want to deploy
    const playerArmy = { ...currentCountry.army };
    let hasSufficientForces = true;
    
    Object.keys(forces).forEach((k) => {
      const key = k as keyof Army;
      if ((forces[key] || 0) > (playerArmy[key] || 0)) {
        hasSufficientForces = false;
      }
    });

    if (!hasSufficientForces) {
      alert("الموارد العسكرية في الإمدادات المركزية غير كافية لإرسال هذه الكتيبة الكبيرة!");
      return;
    }

    const totalForcesCount = Object.values(forces).reduce((a, b) => (a || 0) + (b || 0), 0) || 0;
    if (totalForcesCount === 0) {
      alert("يجب تخصيص قوات عسكرية قبل شن الهجوم!");
      return;
    }

    // Cost computation for deploying an attack
    const requiredOil = Math.floor((forces.tanks || 0) * 2 + (forces.jets || 0) * 5 + (forces.missiles || 0) * 10);
    const requiredGold = Math.floor(totalForcesCount * 1); // 1 gold per every deployed unit

    if (currentCountry.oil < requiredOil || currentCountry.gold < requiredGold) {
      alert(`⚠️ لا تملك موارد كافية لشن هذا الهجوم العسكري!\n التكلفة المطلوبة: ${requiredOil} نفط، ${requiredGold} ذهب.`);
      return;
    }

    // Deduct attacking force from player central reserve immediately
    Object.keys(forces).forEach((k) => {
      const key = k as keyof Army;
      playerArmy[key] = (playerArmy[key] || 0) - (forces[key] || 0);
    });

    try {
      // 1. Calculate start and end coordinates
      const startTerr = territories.find(t => t.ownerCountryId === currentCountry.id && t.isCapital) 
                     || territories.find(t => t.ownerCountryId === currentCountry.id);
      
      let startLat = 0, startLng = 0;
      if (startTerr) {
        startLat = (startTerr.posY >= 0 && startTerr.posY <= 100) ? (90 - (startTerr.posY / 100) * 180) : startTerr.posY;
        startLng = (startTerr.posX >= 0 && startTerr.posX <= 100) ? ((startTerr.posX / 100) * 360 - 180) : startTerr.posX;
      }
      
      const targetLat = (target.posY >= 0 && target.posY <= 100) ? (90 - (target.posY / 100) * 180) : target.posY;
      const targetLng = (target.posX >= 0 && target.posX <= 100) ? ((target.posX / 100) * 360 - 180) : target.posX;

      // 2. Spawn a moving MapUnit
      const { spawnUnit, updateUnitTarget } = await import('../services/unitService');
      const unitId = `unit_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      
      // Calculate total attack strength of the forces
      const attInf = (forces.infantry || 0) * 1;
      const attSec = (forces.specialForces || 0) * 2;
      const attTan = (forces.tanks || 0) * 5;
      const attArt = (forces.artillery || 0) * 6;
      const attAntiAir = (forces.antiAir || 0) * 4;
      const attJet = (forces.jets || 0) * 12;
      const attMissile = (forces.missiles || 0) * 20;
      const totalAttackStrength = attInf + attSec + attTan + attArt + attAntiAir + attJet + attMissile;

      // Determine unit visual type
      let unitType: 'soldier' | 'tank' | 'jet' | 'base' | 'missile' = 'soldier';
      if (forces.jets && forces.jets > 0) unitType = 'jet';
      else if (forces.tanks && forces.tanks > 0) unitType = 'tank';

      const unitParams: MapUnit = {
        id: unitId,
        matchId: selectedMatchId!,
        ownerCountryId: currentCountry.id,
        ownerCountryName: currentCountry.name,
        color: currentCountry.color || '#ef4444',
        type: unitType,
        hp: totalAttackStrength * 10,
        maxHp: totalAttackStrength * 10,
        attack: totalAttackStrength,
        speed: unitType === 'jet' ? 120 : (unitType === 'tank' ? 60 : 30),
        range: 5,
        lat: startLat,
        lng: startLng,
        targetLat: null,
        targetLng: null,
        status: 'idle',
        lastUpdatedAt: Date.now()
      };

      await spawnUnit(unitParams);
      
      // Dispatch movement command immediately
      await updateUnitTarget(unitId, startLat, startLng, targetLat, targetLng, unitParams.speed);

      const dLat = targetLat - startLat;
      const dLng = targetLng - startLng;
      const distance = Math.sqrt(dLat * dLat + dLng * dLng);
      const timeToArriveMs = (distance / (unitParams.speed * 0.15)) * 1000;
      const cSecs = Math.max(1, Math.round(timeToArriveMs / 1000));

      // Update player reserves and deduct resources
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        army: playerArmy,
        oil: currentCountry.oil - requiredOil,
        gold: currentCountry.gold - requiredGold
      });

      // Broadcast the march / engagement alert to global chat so all players see real-time crisis!
      await sendChatMessage(`🚨 تحرك عسكري مباغت! جبهة دبابات وفصائل مشاة تابعة لـ [${currentCountry.name}] تزحف لخرق الحدود واجتياح مقاطعة [${target.name}]. دفاعات الحامية تستنفر بالقصوى! جاري الاشتباك والمصادمة البرمائية التكتيكية... حسم المعركة خلال ${cSecs} ثانية جارية!`);

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `territories`);
    }
  };

  // Resolves the clashing battle once its release time has passed
  const resolveClashingBattle = async (territoryId: string) => {
    const target = territories.find(t => t.id === territoryId);
    if (!target || target.battleStatus !== 'clashing' || !target.battleAttackerId) return;

    try {
      // Fetch fresh matching country details for attacker from database
      const attackerRef = doc(db, 'countries', target.battleAttackerId);
      const attackerSnap = await getDoc(attackerRef);
      if (!attackerSnap.exists()) {
        console.warn("Attacker country document not found to resolve battle.");
        // Clear clashing state safely
        await updateDoc(doc(db, 'territories', target.id), {
          battleStatus: 'idle',
          battleAttackerId: null,
          battleAttackerName: null,
          battleReleaseTime: null,
          battleForces: null
        });
        return;
      }

      const attackerCountry = attackerSnap.data() as Country;
      const forces = target.battleForces || {};

      // 1. Calculate Combat strengths with Unit Counters
      // Attack properties
      const attInf = forces.infantry || 0;
      const attSec = forces.specialForces || 0;
      const attTan = forces.tanks || 0;
      const attArt = forces.artillery || 0;
      const attAntiAir = forces.antiAir || 0;
      const attJet = forces.jets || 0;
      const attMissile = forces.missiles || 0;

      // Defense properties
      const defInf = target.garrison.infantry || 0;
      const defSec = target.garrison.specialForces || 0;
      const defTan = target.garrison.tanks || 0;
      const defArt = target.garrison.artillery || 0;
      const defAntiAir = target.garrison.antiAir || 0;
      const defJet = target.garrison.jets || 0;

      // Apply Modifiers based on standard counters
      // Infantry weak to Tanks. So if Defender has Tanks, attacking Infantry is halved.
      const attInfMod = defTan > 0 ? 0.5 : 1.0;
      const defInfMod = attTan > 0 ? 0.5 : 1.0;

      // Tanks strong against Ground, weak against Air.
      const attTanMod = defJet > 0 ? 0.5 : (defInf > 0 || defArt > 0 ? 1.5 : 1.0);
      const defTanMod = attJet > 0 ? 0.5 : (attInf > 0 || attArt > 0 ? 1.5 : 1.0);

      // Jets strong against Ground, weak against Anti-Air.
      const attJetMod = defAntiAir > 0 ? 0.5 : (defInf > 0 || defTan > 0 ? 1.5 : 1.0);
      const defJetMod = attAntiAir > 0 ? 0.5 : (attInf > 0 || attTan > 0 ? 1.5 : 1.0);

      // Anti-Air is incredibly strong against Air
      const attAntiAirMod = defJet > 0 ? 2.0 : 0.5;
      const defAntiAirMod = attJet > 0 || attMissile > 0 ? 2.0 : 0.5;

      // Fetch defender country to check their defensive research
      let defenderCountry: Country | null = null;
      if (target.ownerCountryId) {
        try {
          const defenderSnap = await getDoc(doc(db, 'countries', target.ownerCountryId));
          if (defenderSnap.exists()) {
            defenderCountry = defenderSnap.data() as Country;
          }
        } catch (e) {
          console.warn("Defender country load failed:", e);
        }
      }

      const attMilLvl = attackerCountry.research?.military || 0;
      const defDefLvl = defenderCountry?.research?.defense || 0;
      const bunkerLevel = target.bunkerLevel || 0;

      const rawAttackStrength = 
        ((attInf * UNIT_DEFS.infantry.power * attInfMod) +
        (attSec * UNIT_DEFS.specialForces.power) +
        (attTan * UNIT_DEFS.tanks.power * attTanMod) +
        (attArt * UNIT_DEFS.artillery.power) +
        (attAntiAir * UNIT_DEFS.antiAir.power * attAntiAirMod) +
        (attJet * UNIT_DEFS.jets.power * attJetMod) +
        (attMissile * UNIT_DEFS.missiles.power)) * (1 + attMilLvl * 0.15);
        
      const rawDefenseStrength = 
        ((defInf * UNIT_DEFS.infantry.defense * defInfMod) +
        (defSec * UNIT_DEFS.specialForces.defense) +
        (defTan * UNIT_DEFS.tanks.defense * defTanMod) +
        (defArt * UNIT_DEFS.artillery.defense) +
        (defAntiAir * (UNIT_DEFS.antiAir?.defense || 80) * defAntiAirMod) +
        (defJet * UNIT_DEFS.jets.defense * defJetMod)) * (1 + defDefLvl * 0.15);

      // Determine Winner and battle logs
      const battleLog: string[] = [];
      battleLog.push(`انقضت فترة التعبئة والاشتباك المباشر لمقاطعة [${target.name}].`);

      // Add Randomness and Defense Bonus (Defenders have an inherent +40% advantage and randomness ranges from 0.8x to 1.2x)
      const attackVariance = 0.8 + (Math.random() * 0.4);
      const defenseVariance = 0.8 + (Math.random() * 0.4);
      
      const totalAttackStrength = rawAttackStrength * attackVariance;
      // Bunker level increases defense by 35% per level!
      let totalDefenseStrength = rawDefenseStrength * defenseVariance * 1.4 * (1 + bunkerLevel * 0.35);

      // Homeland Resistance Defense Bonus: If defending own native sovereign capital/provinces
      const isDefendingHomeland = target.ownerCountryId && target.id.includes(target.ownerCountryId.slice(8, 11));
      if (isDefendingHomeland) {
        totalDefenseStrength *= 1.45;
        battleLog.push(`⚔️ مقاومة شعبية باسلة: جنود ومواطنو [${defenderCountry?.name || 'الوطن'}] يستبسلون في حماية أراضيهم التاريخية والسيادية! (+45% دفاع المقاومة الشعبية).`);
      }

      // Active Human Player Defence Bonus
      if (defenderCountry && !defenderCountry.isBot) {
        totalDefenseStrength *= 1.4;
        battleLog.push(`🛡️ غرفة العمليات المشتركة: القائد البشري لـ [${defenderCountry.name}] يقود التكتيك الميداني الدفاعي ويدير غرف العمليات والاتصال بمهارة فائقة! (+40% دعم لوجستي حربي بشري).`);
      }

      // Geographical defense modifier
      if (target.type === 'mountain') {
        totalDefenseStrength *= 1.5; // Mountain fortress bonus
      } else if (target.type === 'desert') {
        totalDefenseStrength *= 1.2; // Desert attrition bonus
      }

      // Determine Winner
      const won = totalAttackStrength > totalDefenseStrength;
      battleLog.push(`القوات الزاحفة لـ [${attackerCountry.name}] تقدّر بـ ${attInf + attSec + attTan + attArt + attAntiAir + attJet + attMissile} جندي وآلية بنظام نيران إجمالي قدره: ${Math.round(totalAttackStrength)} نقطة قوة.`);
      battleLog.push(`القوات المدافعة للخصم تقدّر بـ ${defInf + defSec + defTan + defArt + defAntiAir + defJet} جندي وآلية في الخنادق بنظام موازنة دفاعي قدره: ${Math.round(totalDefenseStrength)} نقطة.`);

      // Loss calculations
      let attLossRatio = 0.8; // default high casualties
      let defLossRatio = 0.8;

      if (won) {
        if (totalDefenseStrength > 0) {
          attLossRatio = Math.min(0.9, (totalDefenseStrength / totalAttackStrength) * 0.7);
        } else {
          attLossRatio = 0.05; // flawless
        }
        defLossRatio = 1.0; // defender annihilated in field
        battleLog.push(`نجح الهجوم الكاسح واجتياح الميدان! تم اختراق ثكنات الحامية وإسقاط دفاعاتها وإعلان السيطرة السيادية التامة.`);
      } else {
        attLossRatio = 1.0; // attackers wiped out or captured
        if (totalAttackStrength > 0) {
          defLossRatio = Math.min(0.9, (totalAttackStrength / totalDefenseStrength) * 0.5);
        } else {
          defLossRatio = 0;
        }
        battleLog.push(`فشل الهجوم الجبهوي! صمدت قوات الدفاع في الخنادق وهُزمت الكتائب الغازية على أسوار الحصن الدفاعي للمقاطعة.`);
      }

      // Bunker level reduces defending casualties by 20% per level (up to 60% reduction)!
      const finalDefLossRatio = defLossRatio * Math.max(0.4, 1 - (bunkerLevel * 0.2));

      // Attacking survivors
      const finalAtt: Partial<Army> = {
        infantry: Math.max(0, Math.round(attInf * (1 - attLossRatio))),
        specialForces: Math.max(0, Math.round(attSec * (1 - attLossRatio))),
        tanks: Math.max(0, Math.round(attTan * (1 - attLossRatio))),
        artillery: Math.max(0, Math.round(attArt * (1 - attLossRatio))),
        antiAir: Math.max(0, Math.round(attAntiAir * (1 - attLossRatio))),
        jets: Math.max(0, Math.round(attJet * (1 - attLossRatio))),
        missiles: Math.max(0, Math.round(attMissile * (1 - attLossRatio)))
      };

      // Defending survivors
      const finalDef: Garrison = {
        infantry: Math.max(0, Math.round(defInf * (1 - finalDefLossRatio))),
        specialForces: Math.max(0, Math.round(defSec * (1 - finalDefLossRatio))),
        tanks: Math.max(0, Math.round(defTan * (1 - finalDefLossRatio))),
        artillery: Math.max(0, Math.round(defArt * (1 - finalDefLossRatio))),
        antiAir: Math.max(0, Math.round(defAntiAir * (1 - finalDefLossRatio))),
        jets: Math.max(0, Math.round(defJet * (1 - finalDefLossRatio))),
        missiles: target.garrison.missiles || 0 // missiles not used in defense
      };

      // Accumulate casualties durably on both countries
      const attLostInf = attInf - (finalAtt.infantry || 0);
      const attLostSF = attSec - (finalAtt.specialForces || 0);
      const attLostTanks = attTan - (finalAtt.tanks || 0);
      const attLostArt = attArt - (finalAtt.artillery || 0);
      const attLostAA = attAntiAir - (finalAtt.antiAir || 0);
      const attLostJets = attJet - (finalAtt.jets || 0);
      const attLostMiss = attMissile - (finalAtt.missiles || 0);

      const defLostInf = defInf - finalDef.infantry;
      const defLostSF = defSec - finalDef.specialForces;
      const defLostTanks = defTan - finalDef.tanks;
      const defLostArt = defArt - finalDef.artillery;
      const defLostAA = defAntiAir - finalDef.antiAir;
      const defLostJets = defJet - finalDef.jets;

      try {
        const attCas = attackerCountry.casualties || { infantry: 0, specialForces: 0, tanks: 0, artillery: 0, antiAir: 0, jets: 0, missiles: 0 };
        await updateDoc(attackerRef, {
          casualties: {
            infantry: (attCas.infantry || 0) + attLostInf,
            specialForces: (attCas.specialForces || 0) + attLostSF,
            tanks: (attCas.tanks || 0) + attLostTanks,
            artillery: (attCas.artillery || 0) + attLostArt,
            antiAir: (attCas.antiAir || 0) + attLostAA,
            jets: (attCas.jets || 0) + attLostJets,
            missiles: (attCas.missiles || 0) + attLostMiss,
          }
        });

        if (defenderCountry) {
          const defCas = defenderCountry.casualties || { infantry: 0, specialForces: 0, tanks: 0, artillery: 0, antiAir: 0, jets: 0, missiles: 0 };
          await updateDoc(doc(db, 'countries', defenderCountry.id), {
            casualties: {
              infantry: (defCas.infantry || 0) + defLostInf,
              specialForces: (defCas.specialForces || 0) + defLostSF,
              tanks: (defCas.tanks || 0) + defLostTanks,
              artillery: (defCas.artillery || 0) + defLostArt,
              antiAir: (defCas.antiAir || 0) + defLostAA,
              jets: (defCas.jets || 0) + defLostJets,
              missiles: defCas.missiles || 0
            }
          });
        }
      } catch (e) {
        console.error("Failed to write battle casualties:", e);
      }

      const stolen = { gold: 0, oil: 0, iron: 0, food: 0 };

      // Loot reward matching resource specialty of the territory
      if (won) {
        if (target.resourceSpecialty === 'gold') stolen.gold = 300;
        if (target.resourceSpecialty === 'oil') stolen.oil = 200;
        if (target.resourceSpecialty === 'iron') stolen.iron = 250;
        if (target.resourceSpecialty === 'food') stolen.food = 350;

        // Deduct from enemy if they were owned by standard player profile
        if (target.ownerCountryId) {
          const enemyRef = doc(db, 'countries', target.ownerCountryId);
          try {
            const enemySnap = await getDoc(enemyRef);
            if (enemySnap.exists()) {
              const eData = enemySnap.data() as Country;
              const enemyGoldStolen = Math.floor(eData.gold * 0.15);
              const enemyOilStolen = Math.floor(eData.oil * 0.15);
              stolen.gold += enemyGoldStolen;
              stolen.oil += enemyOilStolen;
              
              await updateDoc(enemyRef, {
                gold: Math.max(0, eData.gold - enemyGoldStolen),
                oil: Math.max(0, eData.oil - enemyOilStolen)
              });
              battleLog.push(`تم كسب غنائم حرب إضافية من مخازن دولة [${target.ownerCountryName}]: +${stolen.gold} ذهب و +${stolen.oil} نفط.`);
            }
          } catch (e) {
            console.warn("Enemy theft deduction bypassed", e);
          }
        }
      }

      // Update Territory status with database changes
      if (won) {
        // Attacking survivors become the border garrison, territory falls under attacker's flag
        await updateDoc(doc(db, 'territories', target.id), {
          ownerCountryId: attackerCountry.id,
          ownerCountryName: attackerCountry.name,
          flagEmoji: attackerCountry.flagUrl,
          color: attackerCountry.color,
          garrison: {
            infantry: finalAtt.infantry || 0,
            specialForces: finalAtt.specialForces || 0,
            tanks: finalAtt.tanks || 0,
            artillery: finalAtt.artillery || 0,
            antiAir: finalAtt.antiAir || 0,
            jets: finalAtt.jets || 0,
            missiles: finalAtt.missiles || 0
          },
          battleStatus: 'idle',
          battleAttackerId: null,
          battleAttackerName: null,
          battleReleaseTime: null,
          battleForces: null
        });
      } else {
        // Defender holds position with survivors, status cleared
        await updateDoc(doc(db, 'territories', target.id), {
          garrison: finalDef,
          battleStatus: 'idle',
          battleAttackerId: null,
          battleAttackerName: null,
          battleReleaseTime: null,
          battleForces: null
        });
      }

      // Commit updated attacker country reserves and earned stolen resources
      await updateDoc(attackerRef, {
        gold: attackerCountry.gold + stolen.gold,
        oil: attackerCountry.oil + stolen.oil,
        food: attackerCountry.food + stolen.food,
        iron: attackerCountry.iron + stolen.iron,
      });

      // Save Battle report
      const report: BattleReport & { matchId: string } = {
        id: `battle_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        seasonId: activeSeason?.id || 'season_1',
        timestamp: new Date().toISOString(),
        attackerId: attackerCountry.id,
        attackerName: attackerCountry.name,
        attackerFlagEmoji: attackerCountry.flagUrl,
        defenderId: target.ownerCountryId,
        defenderName: target.ownerCountryName || 'البرابرة / متمردين خارجين عن القانون',
        defenderFlagEmoji: target.ownerCountryId ? target.flagEmoji : '☠️',
        territoryId: target.id,
        territoryName: target.name,
        won,
        initialAttackingForce: forces,
        survivingAttackingForce: finalAtt,
        initialDefendingForce: target.garrison,
        survivingDefendingForce: finalDef,
        stolenResources: stolen,
        log: battleLog,
        matchId: selectedMatchId
      };

      await addDoc(collection(db, 'battles'), report);

      // Alert the player if they are involved in this battle
      if (currentCountry) {
        if (target.battleAttackerId === currentCountry.id) {
          if (won) {
            alert(`🏆 نصر عسكري مؤزر!\n\nبفضل التخطيط والسيادة العسكرية، نجح هجوم قواتك واجتياح الميدان وسيطرت على مقاطعة [${target.name}] بالكامل، وتم حصد الغنائم الحربية! 🚩`);
          } else {
            alert(`💥 تقرير المعركة: فشل الهجوم!\n\nصمدت حامية الدفاع بمقاطعة [${target.name}] في الخنادق وتكبدت قواتنا خسائر فادحة قبل الانسحاب التكتيكي.`);
          }
        } else if (target.ownerCountryId === currentCountry.id) {
          if (won) {
            alert(`🚨 خط جبهة منهار: كارثة دفاعية!\n\nلقد سقطت حامية مقاطعتنا السيادية [${target.name}] بعد اجتياح كاسح من قوات دولة [${attackerCountry.name}]. تم ضم الأرض لعلمهم.`);
          } else {
            alert(`🛡️ صمود دفاعي وإبادة لكتائب الخصم!\n\nنجحت فرقة الحراسة المتمركزة في مقاطعة [${target.name}] في صد ودحر الغزاة التابعين لـ [${attackerCountry.name}] وهزيمتهم على أسوار الحصن!`);
          }
        }
      }

      // Transmit the resolution in the central global broadcast list
      if (won) {
        await sendChatMessage(`⚔️ نصر ميكانيكي حاسم! تمكنت جبهة [${attackerCountry.name}] من سحق حامية مقاطعة [${target.name}] بالكامل ورفع راية دولتها خفاقة بالمنطقة! 🚩`);
      } else {
        await sendChatMessage(`🛡️ كسر جدار الغزو! دفاعات مقاطعة [${target.name}] الباسلة تصد فلول الهجوم المرسل من دولة [${attackerCountry.name}] وتجبر بقايا لواء الغزو على التقهقر تكتيكياً!`);
      }

    } catch (err) {
      console.error("Failure resolving clashing battle:", err);
    }
  };

  // Tactical Air Strike Bombardment (القصف الجوي المدمر لإنهاك الدفاعات)
  const executeAirStrike = async (territoryId: string) => {
    if (!currentCountry) return;
    const target = territories.find(t => t.id === territoryId);
    if (!target) return;

    if (target.ownerCountryId === currentCountry.id) {
      alert("هذه مقاطعتك بالفعل؛ لا يمكنك قصف مواطنيك وسلطة بلادك!");
      return;
    }

    if (currentCountry.army.jets < 1) {
      alert("⚠️ يتطلب شن القصف الجوي توفير طائرة مقاتلة نفاثة (1 على الأقل) تابعة لسلاح الجو بالاحتياطي المركزي!");
      return;
    }

    if (currentCountry.gold < 250 || currentCountry.oil < 200) {
      alert("⚠️ متطلبات تسيير الغارات الجوية باهظة؛ تحتاج لـ 250 ذهب للطيارين و 200 نفط كوقود نفاذ للمقاتلات!");
      return;
    }

    const now = Date.now();
    const cooldownMs = 2 * 60 * 1000; // 2 minutes
    if (currentCountry.lastAirstrikeTime && (now - currentCountry.lastAirstrikeTime) < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - (now - currentCountry.lastAirstrikeTime)) / 1000);
      alert(`⏳ المدارج الجوية قيد التجهيز والصيانة! يرجى الانتظار ${remainingSeconds} ثانية قبل شن غارة جوية أخرى.`);
      return;
    }

    // Deduct resources from attacker country
    const attackerCountryArmy = { ...currentCountry.army };
    let lostJetThisRun = false;

    // Risk of jet being shot down if target has anti-aircraft missiles or jets defense
    const targetAntiAirPower = (target.garrison.antiAir || 0) * 10 + (target.garrison.jets || 0) * 1.5;
    const shootDownProbability = Math.min(0.85, 0.08 + (targetAntiAirPower * 0.04));

    if (Math.random() < shootDownProbability) {
      attackerCountryArmy.jets = Math.max(0, (attackerCountryArmy.jets || 1) - 1);
      lostJetThisRun = true;
    }

    // Garrison defense reduction: 25% to 45% casualties on boundary troops
    // If jet is intercepted and shot down, it does less or no damage!
    const reductionMultiplier = lostJetThisRun ? 0.3 : 1.0;
    const reductionFactor = (0.25 + (Math.random() * 0.20)) * reductionMultiplier; 

    const currentGarrison = { ...target.garrison };

    const originalTotal = (currentGarrison.infantry || 0) + (currentGarrison.specialForces || 0) + (currentGarrison.tanks || 0) + (currentGarrison.artillery || 0);

    currentGarrison.infantry = Math.max(0, currentGarrison.infantry - Math.max(3, Math.round(currentGarrison.infantry * reductionFactor)));
    currentGarrison.specialForces = Math.max(0, currentGarrison.specialForces - Math.max(1, Math.round(currentGarrison.specialForces * reductionFactor)));
    currentGarrison.tanks = Math.max(0, currentGarrison.tanks - Math.max(1, Math.round(currentGarrison.tanks * reductionFactor)));
    currentGarrison.artillery = Math.max(0, currentGarrison.artillery - Math.max(1, Math.round(currentGarrison.artillery * reductionFactor)));

    const newTotal = (currentGarrison.infantry || 0) + (currentGarrison.specialForces || 0) + (currentGarrison.tanks || 0) + (currentGarrison.artillery || 0);
    const casualtiesInflicted = Math.max(0, originalTotal - newTotal);

    try {
      // 1. Update Target garrison
      await updateDoc(doc(db, 'territories', target.id), {
        garrison: currentGarrison
      });

      // 2. Update Attacker reserves and assets
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        gold: currentCountry.gold - 250,
        oil: currentCountry.oil - 200,
        army: attackerCountryArmy,
        lastAirstrikeTime: Date.now()
      });

      // 3. Emit custom map coordinate event to showcase explosion instantly on the map canvas
      window.dispatchEvent(new CustomEvent('map-airstrike', {
        detail: {
          territoryId: target.id,
          posX: target.posX,
          posY: target.posY,
          attackerName: currentCountry.name,
          casualties: casualtiesInflicted
        }
      }));

      // 4. Save to battle logger and global radio broadcasting chat
      const chatMsg = `🚀 قصف جوي مدمر! سلاح الجو لـ [${currentCountry.name}] يشن غارات عنيفة بصواريخ ارتجاجية مخترقة للتحصينات على مقاطعة [${target.name}]. النتائج: إبادة ${casualtiesInflicted} آلية جندي من الحامية الدفاعية! ` +
        (lostJetThisRun ? `⚠️ للأسف؛ أسقطت رادارات دفاع المقاطعة طائرة مقاتلة متسللة لبلادنا واشتعل الهيكل بالبرية!` : `وقد عادت كافة المقاتلات لقواعدها الجوية الإمبراطورية بسلام.`);

      await sendChatMessage(chatMsg);

    } catch (err) {
      console.error("Air Strike execution failure:", err);
    }
  };

  // Espionage Operations (التجسس)
  const executeEspionage = async (
    targetCountryId: string, 
    mission: 'intel' | 'steal_oil' | 'steal_gold' | 'sabotage_defense' | 'recon',
    isReconPlane: boolean = false
  ) => {
    if (!currentCountry) return;
    const target = countries.find(c => c.id === targetCountryId);
    if (!target) return;

    if (isReconPlane) {
      if (currentCountry.army.reconPlanes < 1) {
        alert("يتطلب الاستطلاع الجوي نشر طائرة استطلاع واحدة متوفرة بالاحتياطي المركزي!");
        return;
      }
      if (currentCountry.oil < 100) {
        alert("تتطلب طلعة الاستطلاع الجوي 100 برميل وقود للطائرات!");
        return;
      }
    } else {
      if (currentCountry.gold < 150) {
        alert("يتطلب تجنيد وإرسال عميل سري في مهمة خارجية 150 ذهب كتمويل سائل!");
        return;
      }
    }

    // Intelligence factors based on target's defense capabilities
    let detectionRisk = 35; // base percentage risk
    
    if (isReconPlane) {
       // AntiAir logic increases risk for planes
       const aiPower = target.army.antiAir || 0;
       detectionRisk = Math.min(85, 20 + aiPower * 2);
    } else {
       // Sabotage risk
       const intelDefense = target.army.specialForces || 0;
       detectionRisk = Math.min(75, 30 + intelDefense * 0.5);
    }

    const success = Math.random() * 100 > detectionRisk;
    const logs: string[] = [];

    let updatedPlayerGold = currentCountry.gold;
    let updatedPlayerOil = currentCountry.oil;
    let playerArmyChange = { ...currentCountry.army };

    if (isReconPlane) {
      updatedPlayerOil -= 100;
      logs.push(`أقلعت طائرات الاستطلاع (رادار ${currentCountry.name}) لاختراق أجواء [${target.capital}] لمهمة كشف القوات الجبهوية.`);
    } else {
      updatedPlayerGold -= 150;
      logs.push(`تم تفعيل شبكة الجواسيس في عاصمة الهدف: [${target.capital}] لمهمة [${mission}].`);
    }

    let targetChange: Partial<Country> = {};

    if (success) {
      if (isReconPlane) {
         logs.push("نجحت طلعة الاستطلاع الجوي بالتقاط صور تفصيلية لكامل قواعد وأرتال تحركات الميليشيات عبر الرادار وكشف خريطة الهدف.");
      } else {
         logs.push("نجحت العملية الاستخباراتية بشكل فائق السرية دون إثارة الإنذارات وكُشف جزء من الخطط العسكرية.");
         if (mission === 'steal_gold') {
           const stolenGold = Math.floor(target.gold * 0.12);
           updatedPlayerGold += stolenGold;
           targetChange.gold = Math.max(0, target.gold - stolenGold);
           logs.push(`اخترق عميلنا الخزانة العامة للعدو وسرق ما مقداره: ${stolenGold} سبيكة ذهبية عيار 24.`);
         } else if (mission === 'steal_oil') {
           const stolenOil = Math.floor(target.oil * 0.15);
           targetChange.oil = Math.max(0, target.oil - stolenOil);
           logs.push(`تم تخريب صمامات الاحتياطي واستحواذ الجواسيس على: ${stolenOil} برميل نفط خام.`);
         } else if (mission === 'intel') {
           logs.push(`تم نقل هيكل الدفاعات بالكامل وصور الاقمار الصناعية: الجيش المركزي للهدف يمتلك ${target.army.tanks} دبابات و ${target.army.infantry} جنود.`);
         } else {
           // Sabotage
           const damageInfantry = Math.floor(target.army.infantry * 0.2);
           const newArmyObj = { ...target.army, infantry: Math.max(0, target.army.infantry - damageInfantry) };
           targetChange.army = newArmyObj;
           logs.push(`تم إضعاف المركز الدفاعي عبر متفجرات خلوية وتصفية ${damageInfantry} جندي بالسرية.`);
         }
      }
    } else {
      if (isReconPlane) {
        logs.push("تم رصد الطائرة الاستطلاعية من قبل رادارات العدو وإسقاطها عبر الدفاعات الجوية الثقيلة!");
        playerArmyChange.reconPlanes = Math.max(0, playerArmyChange.reconPlanes - 1);
      } else {
        logs.push("فضيحة مخابراتية! تم تحديد هوية الجاسوس في قصر الرئاسة وتصفيته وانقطاع الاتصال.");
      }
    }

    // Apply updates
    try {
      await updateDoc(doc(db, 'countries', currentCountry.id), { 
        gold: updatedPlayerGold,
        oil: updatedPlayerOil,
        army: playerArmyChange
      });
      if (Object.keys(targetChange).length > 0) {
        await updateDoc(doc(db, 'countries', target.id), targetChange);
      }

      // Record Spy action in DB
      const spyDoc: Spy & { matchId: string } = {
        id: `spy_${Date.now()}`,
        ownerCountryId: currentCountry.id,
        ownerCountryName: currentCountry.name,
        targetCountryId: target.id,
        targetCountryName: target.name,
        status: success ? 'successful' : 'caught',
        mission,
        logs,
        createdAt: new Date().toISOString(),
        matchId: selectedMatchId
      };
      await addDoc(collection(db, 'spies'), spyDoc);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'spies');
    }
  };

  // Alliance Coalitions Code
  const createAlliance = async (name: string, tag: string, description: string) => {
    if (!currentCountry) return;
    if (currentCountry.gold < 500) {
      alert("يتطلب تشكيل ميثاق حلف دولي جديد 500 ذهب لفتح غرف المفاوضات الإقليمية!");
      return;
    }

    const allianceId = `alliance_${Date.now()}_${selectedMatchId}`;
    const newAlliance: Alliance & { matchId: string } = {
      id: allianceId,
      name,
      tag,
      description,
      leaderCountryId: currentCountry.id,
      leaderCountryName: currentCountry.name,
      members: [{
        countryId: currentCountry.id,
        countryName: currentCountry.name,
        flagEmoji: currentCountry.flagUrl,
        role: 'leader'
      }],
      resourcePool: { gold: 0, oil: 0, iron: 0, food: 0 },
      createdAt: new Date().toISOString(),
      matchId: selectedMatchId
    };

    try {
      await setDoc(doc(db, 'alliances', allianceId), newAlliance);
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        allianceId,
        allianceName: name,
        gold: currentCountry.gold - 500
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `alliances/${allianceId}`);
    }
  };

  const joinAlliance = async (allianceId: string) => {
    if (!currentCountry) return;
    const alliance = alliances.find(a => a.id === allianceId);
    if (!alliance) return;

    const newMembers = [...alliance.members, {
      countryId: currentCountry.id,
      countryName: currentCountry.name,
      flagEmoji: currentCountry.flagUrl,
      role: 'member' as const
    }];

    try {
      await updateDoc(doc(db, 'alliances', allianceId), { members: newMembers });
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        allianceId,
        allianceName: alliance.name
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `alliances/${allianceId}`);
    }
  };

  const leaveAlliance = async () => {
    if (!currentCountry || !currentCountry.allianceId) return;
    const alliance = alliances.find(a => a.id === currentCountry.allianceId);
    if (!alliance) return;

    try {
      const isLeader = alliance.leaderCountryId === currentCountry.id;
      if (isLeader) {
        // Dissolve the entire alliance if leader exits
        await deleteDoc(doc(db, 'alliances', alliance.id));
        // Re-assign members
        for (const m of alliance.members) {
          await updateDoc(doc(db, 'countries', m.countryId), {
            allianceId: null,
            allianceName: null
          });
        }
      } else {
        const newMembers = alliance.members.filter(m => m.countryId !== currentCountry.id);
        await updateDoc(doc(db, 'alliances', alliance.id), { members: newMembers });
        await updateDoc(doc(db, 'countries', currentCountry.id), {
          allianceId: null,
          allianceName: null
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `alliances/${alliance.id}`);
    }
  };

  const donateResourceToAlliance = async (resource: 'gold' | 'oil' | 'iron' | 'food', amount: number) => {
    if (!currentCountry || !currentCountry.allianceId) return;
    const alliance = alliances.find(a => a.id === currentCountry.allianceId);
    if (!alliance) return;

    if (currentCountry[resource] < amount) {
      alert("الكمية المحددة تفوق ما تحتويه المخازن الوطنية لديك!");
      return;
    }

    const newResPool = { ...alliance.resourcePool };
    newResPool[resource] += amount;

    try {
      // Deduct
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        [resource]: currentCountry[resource] - amount
      });
      // Add to pool
      await updateDoc(doc(db, 'alliances', alliance.id), {
        resourcePool: newResPool
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `alliances/${alliance.id}`);
    }
  };

  const sendAllianceRequest = async (allianceId: string) => {
    if (!currentCountry || !selectedMatchId) return;
    const alliance = alliances.find(a => a.id === allianceId);
    if (!alliance) return;

    // Check if request already exists
    const existing = allianceRequests.find(r => r.allianceId === allianceId && r.countryId === currentCountry.id && r.status === 'pending');
    if (existing) {
      alert("لقد قمت بإرسال طلب انضمام بالفعل لهذا التحالف، وهو قيد الانتظار حالياً.");
      return;
    }

    const requestId = `request_${Date.now()}_${currentCountry.id}`;
    const newRequest: AllianceRequest = {
      id: requestId,
      matchId: selectedMatchId,
      allianceId: alliance.id,
      allianceName: alliance.name,
      countryId: currentCountry.id,
      countryName: currentCountry.name,
      flagEmoji: currentCountry.flagUrl || '🏳️',
      leaderCountryId: alliance.leaderCountryId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'alliance_requests', requestId), newRequest);
      alert("تم إرسال طلب الانضمام إلى قائد التحالف بنجاح!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `alliance_requests/${requestId}`);
    }
  };

  const acceptAllianceRequest = async (request: AllianceRequest) => {
    if (!currentCountry) return;
    const alliance = alliances.find(a => a.id === request.allianceId);
    if (!alliance) return;

    if (alliance.leaderCountryId !== currentCountry.id) {
      alert("أنت لست قائد هذا التحالف لتقبل هذا الطلب!");
      return;
    }

    // Add member to alliance
    const newMembers = [...(alliance.members || []), {
      countryId: request.countryId,
      countryName: request.countryName,
      flagEmoji: request.flagEmoji,
      role: 'member' as const
    }];

    try {
      // 1. Update alliance members
      await updateDoc(doc(db, 'alliances', request.allianceId), { members: newMembers });
      
      // 2. Update country with alliance details
      await updateDoc(doc(db, 'countries', request.countryId), {
        allianceId: request.allianceId,
        allianceName: alliance.name
      });

      // 3. Update request status or delete it
      await deleteDoc(doc(db, 'alliance_requests', request.id));

      // 4. Send chat message informing about acceptance
      await sendChatMessage(`📢 انضمت جمهورية [${request.countryName}] رسمياً إلى صفوف حلف [${alliance.name}]!`);
      alert(`تم قبول انضمام [${request.countryName}] إلى التحالف.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `alliances/${request.allianceId}`);
    }
  };

  const declineAllianceRequest = async (request: AllianceRequest) => {
    if (!currentCountry) return;
    if (request.leaderCountryId !== currentCountry.id) {
      alert("أنت لست قائد هذا التحالف لترفض هذا الطلب!");
      return;
    }

    try {
      await deleteDoc(doc(db, 'alliance_requests', request.id));
      alert(`تم رفض طلب انضمام [${request.countryName}].`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `alliance_requests/${request.id}`);
    }
  };

  // Chats Stream Messaging
  const sendChatMessage = async (text: string) => {
    if (!currentCountry || !selectedMatchId) return;
    
    const messageObj: Omit<ChatMessage, 'id'> & { matchId: string } = {
      senderId: currentCountry.id,
      senderCountryName: currentCountry.name,
      senderFlagEmoji: currentCountry.flagUrl,
      senderColor: currentCountry.color,
      text,
      timestamp: Date.now(),
      allianceId: activeChatTab === 'alliance' ? currentCountry.allianceId : null,
      recipientId: activeChatTab === 'private' ? selectedPrivateRecipient?.id || null : null,
      recipientCountryName: activeChatTab === 'private' ? selectedPrivateRecipient?.name || null : null,
      matchId: selectedMatchId
    };

    try {
      await addDoc(collection(db, 'messages'), messageObj);
    } catch (e) {
      console.error("Chat push blocked", e);
    }
  };

  const setChatConfig = (tab: 'global' | 'alliance' | 'private', recipient: { id: string; name: string } | null) => {
    setActiveChatTab(tab);
    setSelectedPrivateRecipient(recipient);
  };

  // Admin Tools
  const triggerRandomWorldEvent = async () => {
    if (!isAdmin) return;
    const template = WORLD_EVENT_TEMPLATES[Math.floor(Math.random() * WORLD_EVENT_TEMPLATES.length)];
    const randomTerritory = territories[Math.floor(Math.random() * territories.length)];

    const ev: WorldEvent = {
      id: `event_${Date.now()}`,
      title: template.title,
      description: template.description,
      type: template.type,
      severity: template.severity,
      effect: template.effect,
      targetTerritoryId: randomTerritory.id,
      timestamp: new Date().toISOString()
    };

    await addDoc(collection(db, 'events'), ev);
    
    // Broadcast message
    const alertMessage: Omit<ChatMessage, 'id'> = {
      senderId: 'SYSTEM',
      senderCountryName: '📢 مجلس الأمن الدولي',
      senderFlagEmoji: '🇺🇳',
      senderColor: '#3b82f6',
      text: `🚨 عاجل: حدث عالمي طارئ! [${template.title}] يستهدف منطقة [${randomTerritory.name}]. الأثر: ${template.effect}.`,
      timestamp: Date.now(),
      allianceId: null,
      recipientId: null
    };
    await addDoc(collection(db, 'messages'), alertMessage);

    // Apply immediate global effect if applicable
    if (template.type === 'disaster') {
      // Simple electric drain representational impact
      for (const c of countries) {
        await updateDoc(doc(db, 'countries', c.id), {
          electricity: Math.max(0, c.electricity - 40)
        });
      }
    } else if (template.type === 'discovery') {
      for (const c of countries) {
        await updateDoc(doc(db, 'countries', c.id), {
          oil: c.oil + 200
        });
      }
    }
  };

  const addBotCountry = async () => {
    if (!selectedMatchId) return;

    // 1. Find ISO codes of existing countries in this match
    const existingIsos = new Set<string>();
    countries.forEach(c => {
      Object.entries(SOVEREIGN_CONFIGS).forEach(([iso, val]) => {
        if (c.name.includes(val.name) || c.id.slice(8, 11) === iso) {
          existingIsos.add(iso);
        }
      });
    });

    // 2. Find any ISOs in SOVEREIGN_CONFIGS that are NOT currently in the match
    const availableIsos = Object.keys(SOVEREIGN_CONFIGS).filter(iso => !existingIsos.has(iso));

    let chosenIso = '';
    let config = {
      name: '',
      flag: '🤖',
      color: '#64748b',
      capital: 'الحصن الفيدرالي',
      desc: 'حكومة مستقلة مبرمجة للدعم الاستراتيجي العسكري.'
    };

    if (availableIsos.length > 0) {
      chosenIso = availableIsos[Math.floor(Math.random() * availableIsos.length)];
      const preset = SOVEREIGN_CONFIGS[chosenIso];
      config = {
        name: `قوات ${preset.name} (البوت)`,
        flag: preset.flag,
        color: preset.color,
        capital: preset.capital,
        desc: preset.desc
      };
    } else {
      const randHex = Math.floor(Math.random()*16777215).toString(16);
      config = {
        name: `فيلق الأندرويد 🤖 #${Math.floor(Math.random() * 900) + 100}`,
        flag: '🤖',
        color: `#${randHex}`,
        capital: 'النواة المركزية',
        desc: 'حكومة ذكاء اصطناعي سيادي معززة للعمليات العسكرية المشتركة.'
      };
      chosenIso = `BOT${Math.floor(Math.random() * 100)}`;
    }

    const countryId = `country_${chosenIso}_${selectedMatchId}`;

    const newBotCountry: Country & { matchId: string } = {
      id: countryId,
      userId: `bot_country_${chosenIso}`,
      matchId: selectedMatchId,
      name: config.name,
      flagUrl: config.flag,
      color: config.color,
      description: config.desc,
      capital: config.capital,
      leaderName: `الجنرال الآلي 🤖 (${chosenIso})`,
      gold: 5000,
      oil: 2500,
      iron: 2500,
      food: 3000,
      electricity: 200,
      population: 3000000,
      unemploymentRate: 5,
      taxRate: 15,
      allianceId: null,
      allianceName: null,
      army: getRealisticStartingArmy(chosenIso),
      createdAt: new Date().toISOString(),
      lastHarvestTime: new Date().toISOString(),
      isBot: true,
      empireCredits: 100
    };

    try {
      await setDoc(doc(db, 'countries', countryId), newBotCountry);
      
      const neutralTerritories = territories.filter(t => t.ownerCountryId === null);
      if (neutralTerritories.length > 0) {
        const target = neutralTerritories[Math.floor(Math.random() * neutralTerritories.length)];
        await updateDoc(doc(db, 'territories', target.id), {
          ownerCountryId: countryId,
          ownerCountryName: config.name,
          flagEmoji: config.flag,
          color: config.color,
          'garrison.infantry': 30,
          'garrison.tanks': 3
        });
      }
      
      const alertMessage: Omit<ChatMessage, 'id'> & { matchId: string } = {
        senderId: 'SYSTEM',
        senderCountryName: '📢 هيئة الأركان الحربية',
        senderFlagEmoji: '🤖',
        senderColor: config.color,
        text: `🤖 تم تنشيط ودخول البوت العسكري الذكي [${config.name}] إلى مسرح العمليات الحربية والسيطرة الأرضية!`,
        timestamp: Date.now(),
        allianceId: null,
        recipientId: null,
        matchId: selectedMatchId
      };
      await addDoc(collection(db, 'messages'), alertMessage);

      alert(`تم بنجاح استدعاء وتأسيس دولة البوت [${config.name}] في مسرح العمليات الحربية!`);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تنشيط دولة البوت.');
    }
  };

  const adminResetSeason = async () => {
    if (!isAdmin) return;
    const confirm = window.confirm("هل أنت متأكد من رغبتك في تصفير الخريطة وبدء موسم جديد؟ سيؤدي ذلك لمحو المقاطعات والأحلاف لإعادة الدورة الاستشارية!");
    if (!confirm) return;

    setLoading(true);

    try {
      // Calculate winner country based on territory count
      const counts: Record<string, number> = {};
      territories.forEach(t => {
        if (t.ownerCountryId) {
          counts[t.ownerCountryId] = (counts[t.ownerCountryId] || 0) + 1;
        }
      });

      let winnerId = '';
      let winnerName = 'لا يوجد الفائز المتوج';
      let maxCount = 0;
      Object.entries(counts).forEach(([cid, cnt]) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          winnerId = cid;
          const found = countries.find(co => co.id === cid);
          if (found) winnerName = found.name;
        }
      });

      // 1. Update old Season
      if (activeSeason) {
        await updateDoc(doc(db, 'seasons', activeSeason.id), {
          active: false,
          winnerCountryId: winnerId,
          winnerCountryName: winnerName,
          endTime: new Date().toISOString()
        });
      }

      // 2. Create new Season doc
      const nextNum = (activeSeason?.number || 1) + 1;
      const nextId = `season_${nextNum}`;
      await setDoc(doc(db, 'seasons', nextId), {
        id: nextId,
        number: nextNum,
        startTime: new Date().toISOString(),
        active: true,
        title: `الموسم الجديد: المجلد رقم ${nextNum}`
      });

      // 3. Reset All Territories back to neutrals
      for (const t of MAP_TERRITORIES) {
        await setDoc(doc(db, 'territories', t.id), {
          id: t.id,
          name: t.name,
          ownerCountryId: null,
          ownerCountryName: null,
          flagEmoji: '🏳️',
          color: '#475569',
          posX: t.posX,
          posY: t.posY,
          type: t.type,
          resourceSpecialty: t.resourceSpecialty,
          resourceMultiplier: t.resourceMultiplier,
          garrison: {
            infantry: Math.floor(Math.random() * 15) + 10,
            specialForces: 0,
            tanks: Math.floor(Math.random() * 4),
            artillery: 0,
            antiAir: 0,
            jets: 0,
            missiles: 0
          }
        });
      }

      // 4. Delete all Alliances
      for (const al of alliances) {
        await deleteDoc(doc(db, 'alliances', al.id));
      }

      // 5. Restore players back to standard initial parameters
      for (const co of countries) {
        const iso = co.id.split('_')[1] || "EGY";
        await updateDoc(doc(db, 'countries', co.id), {
          gold: 1500,
          oil: 600,
          iron: 800,
          food: 1000,
          electricity: 100,
          allianceId: null,
          allianceName: null,
          army: getRealisticStartingArmy(iso)
        });
      }

      // Post victory broadcast in chat
      await addDoc(collection(db, 'messages'), {
        senderId: 'SYSTEM',
        senderCountryName: '📢 حلف الأمن السنوي',
        senderFlagEmoji: '👑',
        senderColor: '#f59e0b',
        text: `🎖️ مبروك الإمبراطورية المتوجة! انتهى الموسم وتوجت الإمبراطورية [${winnerName}] بالصدارة بحجم مناطق مستحوذ عليها بلغ ${maxCount}. تم إطلاق صافرة البداية للموسم رقم ${nextNum}!`,
        timestamp: Date.now(),
        allianceId: null,
        recipientId: null
      });

      setLoading(false);
    } catch (e) {
      console.error("Complete Season wipeout failed", e);
      setLoading(false);
    }
  };

  const adminBanCountry = async (countryId: string, banStatus: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'countries', countryId), {
        isBanned: banStatus
      });
    } catch(e) {
      console.error("Admin ban toggle failed", e);
    }
  };

  // Recharges premium strategy credits for the player
  const rechargeCredits = async () => {
    if (!currentCountry) return;
    try {
      await updateDoc(doc(db, 'countries', currentCountry.id), {
        empireCredits: (currentCountry.empireCredits || 0) + 1000
      });
      alert("تم شحن رصيدك الإستراتيجي اللوجستي بـ 1000 سند حربي إمبراطوري 💎 من قيادة القوات المسلحة بنجاح!");
    } catch (err) {
      console.error("Failed to recharge credits:", err);
    }
  };

  // Automated BOT country tactical activity loop (Simulated war and upgrades)
  const runBotSimulationTick = async () => {
    if (!selectedMatchId || territories.length === 0 || countries.length === 0) return;
    
    // Pick bot countries (isBot === true) inside this match
    const botCountries = countries.filter(c => c.isBot === true || (c.userId && c.userId.startsWith('bot_')));
    if (botCountries.length === 0) return;

    // Pick one random bot country to act this tick to keep writes minimal and fast
    const activeBot = botCountries[Math.floor(Math.random() * botCountries.length)];
    if (!activeBot) return;

    try {
      const botRef = doc(db, 'countries', activeBot.id);
      
      // Bots resource increase
      const randomInfantry = Math.floor(Math.random() * 12) + 4;
      const randomTanks = Math.floor(Math.random() * 4);
      
      const newArmy = {
        ...activeBot.army,
        infantry: (activeBot.army.infantry || 0) + randomInfantry,
        tanks: (activeBot.army.tanks || 0) + randomTanks
      };

      await updateDoc(botRef, {
        gold: (activeBot.gold || 0) + 200,
        oil: (activeBot.oil || 0) + 120,
        iron: (activeBot.iron || 0) + 120,
        food: (activeBot.food || 0) + 120,
        army: newArmy
      });

      // 60% chance for a BOT to attack another BOT province/territory
      if (Math.random() < 0.60) {
        // Find other territories on the map NOT owned by this bot
        const candidateTargets = territories.filter(t => t.ownerCountryId !== activeBot.id);
        if (candidateTargets.length > 0) {
          // Select target territory
          const target = candidateTargets[Math.floor(Math.random() * candidateTargets.length)];
          const defInfantry = target.garrison.infantry || 15;
          const defTanks = target.garrison.tanks || 0;

          // Attacking strength
          const attackingInfantry = Math.floor((activeBot.army.infantry || 100) * 0.85); // Bots attack more aggressively
          const attackingTanks = Math.floor((activeBot.army.tanks || 10) * 0.90);

          if (attackingInfantry > 10) {
            const attPower = attackingInfantry + attackingTanks * 4 + Math.random() * 80;
            const defPower = defInfantry + defTanks * 5 + Math.random() * 50;

            const attackerWon = attPower > defPower;

            const survivorsAttInf = Math.max(0, Math.floor(attackingInfantry * (attackerWon ? 0.7 : 0.2)));
            const survivorsAttTanks = Math.max(0, Math.floor(attackingTanks * (attackerWon ? 0.8 : 0.1)));

            const survivorsDefInf = Math.max(0, Math.floor(defInfantry * (attackerWon ? 0.1 : 0.7)));
            const survivorsDefTanks = Math.max(0, Math.floor(defTanks * (attackerWon ? 0.1 : 0.8)));

            // Apply casualties to bot army
            const postAttArmy = {
              ...newArmy,
              infantry: Math.max(0, (newArmy.infantry || 0) - attackingInfantry + survivorsAttInf),
              tanks: Math.max(0, (newArmy.tanks || 0) - attackingTanks + survivorsAttTanks)
            };
            await updateDoc(botRef, { army: postAttArmy });

            const terrRef = doc(db, 'territories', target.id);
            if (attackerWon) {
              await updateDoc(terrRef, {
                ownerCountryId: activeBot.id,
                ownerCountryName: activeBot.name,
                flagEmoji: activeBot.flagUrl,
                color: activeBot.color,
                garrison: {
                  infantry: Math.max(20, survivorsAttInf),
                  specialForces: Math.floor(survivorsAttTanks / 2),
                  tanks: survivorsAttTanks,
                  artillery: 0,
                  antiAir: 0,
                  jets: 0,
                  missiles: 0
                }
              });

              // Write battle report
              const battleId = `battle_bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
              const report = {
                id: battleId,
                seasonId: activeSeason?.id || 'season_1',
                timestamp: new Date().toISOString(),
                attackerId: activeBot.id,
                attackerName: activeBot.name,
                attackerFlagEmoji: activeBot.flagUrl,
                defenderId: target.ownerCountryId,
                defenderName: target.ownerCountryName || 'مقاتلي المتمردين المحليين',
                defenderFlagEmoji: target.flagEmoji || '☠️',
                territoryId: target.id,
                territoryName: target.name,
                won: true,
                initialAttackingForce: { infantry: attackingInfantry, tanks: attackingTanks },
                survivingAttackingForce: { infantry: survivorsAttInf, tanks: survivorsAttTanks },
                initialDefendingForce: { infantry: defInfantry, tanks: defTanks },
                survivingDefendingForce: { infantry: survivorsDefInf, tanks: survivorsDefTanks },
                log: [
                  `قرر الجنرال الآلي لـ ${activeBot.name} اجتياح مقاطعة [${target.name}].`,
                  `تم إطلاق غارات جوية تمهيدية ودخلت قطع المدرعات خط التماس.`,
                  `تمت السيطرة الكاملة على المقاطعة ورفع علم ${activeBot.name} وتثبيت حامية ميكانيكية بالمنطقة.`
                ],
                matchId: selectedMatchId
              };
              await setDoc(doc(db, 'battles', battleId), report);

            } else {
              // Attack repelled!
              await updateDoc(terrRef, {
                garrison: {
                  ...target.garrison,
                  infantry: survivorsDefInf,
                  tanks: survivorsDefTanks
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("AI simulation bot tick failure:", e);
    }
  };

  // Bot simulation dynamic trigger
  useEffect(() => {
    let timer: any = null;
    if (selectedMatchId) {
      // Simulate automatic bot warfare acts every 40s to make the map breathe!
      timer = setInterval(() => {
        runBotSimulationTick();
      }, 40000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [selectedMatchId, countries, territories]);

  // Global background scanning loop to automatically resolve active clashes whose timers have elapsed
  const territoriesRef = useRef<Territory[]>([]);
  useEffect(() => { territoriesRef.current = territories; }, [territories]);
  const countriesRef = useRef<Country[]>([]);
  useEffect(() => { countriesRef.current = countries; }, [countries]);

  useEffect(() => {
    const handleUnitArrived = async (e: any) => {
      const { unit } = e.detail;
      if (!currentCountry) return;
      
      const { OccupationManager } = await import('../managers/OccupationManager');
      
      // Find which territory it arrived at
      const targetTerritory = territoriesRef.current.find(t => 
        Math.abs(unit.lat - (90 - (t.posY / 100) * 180)) < 2 &&
        Math.abs(unit.lng - ((t.posX / 100) * 360 - 180)) < 2
      );

      if (targetTerritory) {
        await OccupationManager.getInstance().startOccupation(targetTerritory, unit);
      }
    };

    window.addEventListener('unit-arrived', handleUnitArrived);
    return () => window.removeEventListener('unit-arrived', handleUnitArrived);
  }, [currentCountry]);

  // Hook up the GameManager
  useEffect(() => {
    if (currentCountry) {
      import('../managers/GameManager').then(({ GameManager }) => {
        GameManager.getInstance().init(currentCountry.id);
      });
    }
    return () => {
      import('../managers/GameManager').then(({ GameManager }) => {
        GameManager.getInstance().stop();
      });
    };
  }, [currentCountry]);

  // Core tick for units and occupation
  useEffect(() => {
    const coreInterval = setInterval(async () => {
      if (currentCountry) {
        const { GameManager } = await import('../managers/GameManager');
        const { getDocs, query, collection, where, db } = await import('../lib/firebase');
        // Fetch active units
        const unitsSnapshot = await getDocs(query(collection(db, 'units'), where('matchId', '==', selectedMatchId)));
        const units = unitsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        GameManager.getInstance().tickCore(units, territoriesRef.current, countriesRef.current);
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(coreInterval);
  }, [currentCountry, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) return;
    const clashingInterval = setInterval(() => {
      const now = Date.now();
      const expiredTerritories = territoriesRef.current.filter(t => 
        t.battleStatus === 'clashing' && 
        t.battleReleaseTime && 
        t.battleReleaseTime <= now
      );

      expiredTerritories.forEach(async (t) => {
        // Safe check to avoid multiple simultaneous executions
        await resolveClashingBattle(t.id);
      });
    }, 3000); // scan every 3 seconds

    return () => clearInterval(clashingInterval);
  }, [selectedMatchId]);

  return (
    <GameContext.Provider value={{
      currentUser,
      currentCountry,
      countries,
      territories,
      alliances,
      battles,
      messages,
      spies,
      allianceRequests,
      activeSeason,
      loading,
      activeChatTab,
      selectedPrivateRecipient,
      
      selectedMatchId,
      selectMatch,
      matches,
      allMyCountries,
      
      login,
      loginWithEmail,
      registerWithEmail,
      logout,
      registerCountry,
      buildOrUpgrade,
      trainArmy,
      moveGarrisonToTerritory,
      withdrawGarrisonFromTerritory,
      attackTerritory,
      executeAirStrike,
      resolveClashingBattle,
      executeEspionage,
      rechargeCredits,
      addBotCountry,
      
      createAlliance,
      joinAlliance,
      leaveAlliance,
      donateResourceToAlliance,
      sendAllianceRequest,
      acceptAllianceRequest,
      declineAllianceRequest,
      
      sendChatMessage,
      setChatConfig,
      
      isAdmin,
      triggerRandomWorldEvent,
      adminResetSeason,
      adminBanCountry,
      harvestLocalTick
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used inside a GameProvider');
  }
  return context;
};
