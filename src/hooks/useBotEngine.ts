import { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { collection, getDocs, query, where, db } from '../lib/firebase';
import { MapUnit } from '../types';

export const useBotEngine = () => {
  const { selectedMatchId, countries, territories } = useGame();
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!selectedMatchId) return;

    let isEngaged = false;
    const runBotLogic = async () => {
      if (isEngaged) return;
      isEngaged = true;

      try {
        const { AIManager } = await import('../managers/AIManager');
        
        // Fetch all units
        const unitsRef = collection(db, 'units');
        const q = query(unitsRef, where('matchId', '==', selectedMatchId));
        const snapshot = await getDocs(q);
        const allUnits = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MapUnit));

        await AIManager.getInstance().tickBots(selectedMatchId, countries, territories, allUnits);
      } catch (err) {
        console.error("Bot Engine Error: ", err);
      } finally {
        isEngaged = false;
      }
    };

    if (botIntervalRef.current) clearInterval(botIntervalRef.current);
    botIntervalRef.current = setInterval(runBotLogic, 20000); // Check every 20 secs

    return () => {
      if (botIntervalRef.current) clearInterval(botIntervalRef.current);
    };
  }, [selectedMatchId, countries, territories]);
};
