import { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { collection, getDocs, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Country, MapUnit } from '../types';
import { spawnUnit, updateUnitTarget } from '../services/unitService';

// Bot Engine Logic
// Runs for active players to simulate bot countries if nobody else takes them
export const useBotEngine = () => {
  const { selectedMatchId, countries, territories } = useGame();
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!selectedMatchId) return;

    let isEngaged = false;
    const runBotLogic = async () => {
      if (isEngaged) return;
      isEngaged = true;
      // 1. Identify which countries are bots (no userId attached or marked as bot)
      const botCountries = countries.filter(c => c.isBot || !c.userId || c.userId.startsWith('bot_'));
      const humanCountries = countries.filter(c => c.userId && !c.userId.startsWith('bot_'));

      if (botCountries.length === 0) return;

      const unitsRef = collection(db, 'units');
      const unitsSnapshot = await getDocs(query(unitsRef, where('matchId', '==', selectedMatchId)));
      const allUnits = unitsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as MapUnit));

      // 2. Iterate through each bot country
      for (const bot of botCountries) {
        // Collect bot resources
        let goldVal = bot.gold;
        let infantryVal = bot.army.infantry;

        // Ensure Bot has minimum resources (cheat)
        if (infantryVal < 5) {
          infantryVal += 10;
          await updateDoc(doc(db, 'countries', bot.id), {
            'army.infantry': infantryVal,
            gold: goldVal + 1000
          });
        }

        const myUnits = allUnits.filter(u => u.ownerCountryId === bot.id);
        
        // Spawn units if we have fewer than 3 units on map
        if (myUnits.length < 3 && infantryVal > 0) {
          // Find bot's own territories to spawn its units inside its own country
          const botTerrs = (territories || []).filter(t => t.ownerCountryId === bot.id);
          let spawnLat = 24.0 + (Math.random() * 5 - 2.5);
          let spawnLng = 45.0 + (Math.random() * 5 - 2.5);

          if (botTerrs.length > 0) {
            const randomTerr = botTerrs[Math.floor(Math.random() * botTerrs.length)];
            spawnLng = (randomTerr.posX / 100) * 360 - 180;
            spawnLat = 90 - (randomTerr.posY / 100) * 180;
            spawnLat += (Math.random() * 1.0 - 0.5);
            spawnLng += (Math.random() * 1.0 - 0.5);
          }
          
          await spawnUnit({
            id: `bot_unit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            matchId: selectedMatchId,
            ownerCountryId: bot.id,
            ownerCountryName: bot.name,
            color: bot.color || '#64748b',
            type: 'soldier',
            hp: 100,
            maxHp: 100,
            attack: 15,
            speed: 4,
            range: 2,
            lat: spawnLat,
            lng: spawnLng,
            targetLat: null,
            targetLng: null,
            status: 'idle',
            lastUpdatedAt: Date.now()
          });
          continue; // spawned this turn, skip movement
        }

        // Move idle units towards human countries
        for (const unit of myUnits) {
          if (unit.status === 'idle') {
            // Find target lat/lng: human centroid or just random
            if (humanCountries.length > 0) {
              const targetCountry = humanCountries[Math.floor(Math.random() * humanCountries.length)];
              // We don't have accurate centroid in Country obj, let's just make them move towards central hot zone or random near 24, 45
              const targetLat = 24.0 + (Math.random() * 10 - 5);
              const targetLng = 45.0 + (Math.random() * 10 - 5);
              
              await updateUnitTarget(unit.id, targetLat, targetLng);
            }
          }
        }

        // Smart Bot Logic: aggressively declare wars against human or other target territories
        if (Math.random() < 0.40) { // High aggression interval
          const otherTerritories = territories.filter(t => t.ownerCountryId !== bot.id && t.battleStatus === 'idle');
          if (otherTerritories.length > 0 && bot.army.infantry >= 30) {
            // Prefer human territories
            const humanTerrs = otherTerritories.filter(t => humanCountries.some(hc => hc.id === t.ownerCountryId));
            const targetPool = humanTerrs.length > 0 && Math.random() < 0.7 ? humanTerrs : otherTerritories;
            const targetTerr = targetPool[Math.floor(Math.random() * targetPool.length)];

            const forceInfantry = Math.max(10, Math.floor(bot.army.infantry * 0.6));
            const forceTanks = Math.floor((bot.army.tanks || 0) * 0.6);
            const forceJets = Math.floor((bot.army.jets || 0) * 0.5);

            // Deduct from bot
            await updateDoc(doc(db, 'countries', bot.id), {
              'army.infantry': Math.max(0, bot.army.infantry - forceInfantry),
              'army.tanks': Math.max(0, (bot.army.tanks || 0) - forceTanks),
              'army.jets': Math.max(0, (bot.army.jets || 0) - forceJets)
            });

            // Start battle directly!
            await updateDoc(doc(db, 'territories', targetTerr.id), {
              battleStatus: 'clashing',
              battleAttackerId: bot.id,
              battleAttackerName: bot.name,
              battleReleaseTime: Date.now() + 15000,
              battleForces: {
                infantry: forceInfantry,
                tanks: forceTanks,
                jets: forceJets
              }
            });

            // Create Visual map invasion march
            const botCapital = territories.find(t => t.ownerCountryId === bot.id && t.isCapital);
            const thisBotTerrs = territories.filter(t => t.ownerCountryId === bot.id);
            if (botCapital || thisBotTerrs.length > 0) {
              const startTerr = botCapital || thisBotTerrs[0];
              window.dispatchEvent(new CustomEvent('map-invasion-march', {
                detail: {
                  startLat: startTerr.posY,
                  startLng: startTerr.posX,
                  endLat: targetTerr.posY,
                  endLng: targetTerr.posX,
                  color: bot.color || '#ef4444',
                  count: 40
                }
              }));
            }
          }
        }
      }
      isEngaged = false;
    };

    // Stagger to prevent instant collision if multiple clients are there
    const delay = Math.random() * 5000;
    setTimeout(() => {
        botIntervalRef.current = setInterval(runBotLogic, 20000); // Check every 20 secs
    }, delay);

    return () => {
      if (botIntervalRef.current) clearInterval(botIntervalRef.current);
    };
  }, [selectedMatchId, countries]);
};
