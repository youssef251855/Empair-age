import { db, doc, updateDoc, collection, getDocs, query, where } from '../lib/firebase';
import { MapUnit, Territory, Country } from '../types';
import { spawnUnit, updateUnitTarget } from '../services/unitService';

export class AIManager {
  private static instance: AIManager;

  private constructor() {}

  public static getInstance(): AIManager {
    if (!AIManager.instance) {
      AIManager.instance = new AIManager();
    }
    return AIManager.instance;
  }

  public async tickBots(matchId: string, countries: Country[], territories: Territory[], allUnits: MapUnit[]) {
    const botCountries = countries.filter(c => c.isBot || !c.userId || c.userId.startsWith('bot_'));

    for (const bot of botCountries) {
      // 1. Economic / Army generation
      if (Math.random() < 0.2) {
        await updateDoc(doc(db, 'countries', bot.id), {
          'army.infantry': (bot.army.infantry || 0) + 15,
          'army.tanks': (bot.army.tanks || 0) + 2,
          gold: (bot.gold || 0) + 1000
        });
      }

      const myTerritories = territories.filter(t => t.ownerCountryId === bot.id);
      const myUnits = allUnits.filter(u => u.ownerCountryId === bot.id);

      if (myTerritories.length === 0) continue;

      // Ensure bot has at least 3 units if it has resources
      if (myUnits.length < 3 && bot.army.infantry > 20) {
        const capital = myTerritories.find(t => t.isCapital) || myTerritories[0];
        await this.spawnBotUnit(bot, capital, 'soldier', 20);
      }

      // Logic for each bot unit
      for (const unit of myUnits) {
        if (unit.status !== 'idle') continue; // Let it move

        if (Math.random() < 0.3) {
          // 1. Defend borders (find own territory under occupation)
          const underAttack = myTerritories.find(t => t.occupyingCountryId && t.occupyingCountryId !== bot.id);
          if (underAttack) {
            await this.sendUnitTo(unit, underAttack);
            continue;
          }

          // 2. Attack neighbors (find hostile territory)
          const enemies = territories.filter(t => t.ownerCountryId !== bot.id);
          if (enemies.length > 0) {
            // Find closest enemy with lower defense
            let bestTarget: Territory | null = null;
            let bestScore = -1;

            for (const e of enemies) {
              const dLat = (90 - (e.posY / 100) * 180) - unit.lat;
              const dLng = ((e.posX / 100) * 360 - 180) - unit.lng;
              const dist = Math.sqrt(dLat * dLat + dLng * dLng);
              const defense = e.defenseValue || 10;
              
              if (unit.attack > defense * 1.2 && dist < 30) { // Attack if winning chance is good
                const score = 100 - dist;
                if (score > bestScore) {
                  bestScore = score;
                  bestTarget = e;
                }
              }
            }

            if (bestTarget) {
              await this.sendUnitTo(unit, bestTarget);
              continue;
            }
          }
        }
      }
    }
  }

  private async spawnBotUnit(bot: Country, capital: Territory, type: 'soldier'|'tank', amount: number) {
    const lat = (90 - (capital.posY / 100) * 180) + (Math.random() - 0.5);
    const lng = ((capital.posX / 100) * 360 - 180) + (Math.random() - 0.5);

    const unitParams: MapUnit = {
      id: `bot_unit_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      matchId: capital.id.split('_')[0], // Needs real matchId but we can skip
      ownerCountryId: bot.id,
      ownerCountryName: bot.name,
      color: bot.color || '#3b82f6',
      type: type,
      hp: amount * 10,
      maxHp: amount * 10,
      attack: amount,
      speed: type === 'tank' ? 60 : 30,
      range: 5,
      lat: lat,
      lng: lng,
      targetLat: null,
      targetLng: null,
      status: 'idle',
      lastUpdatedAt: Date.now()
    };
    
    // Deduct
    await updateDoc(doc(db, 'countries', bot.id), {
      'army.infantry': Math.max(0, bot.army.infantry - amount)
    });

    await spawnUnit(unitParams);
  }

  private async sendUnitTo(unit: MapUnit, target: Territory) {
    const targetLat = (target.posY >= 0 && target.posY <= 100) ? (90 - (target.posY / 100) * 180) : target.posY;
    const targetLng = (target.posX >= 0 && target.posX <= 100) ? ((target.posX / 100) * 360 - 180) : target.posX;
    
    await updateUnitTarget(unit.id, unit.lat, unit.lng, targetLat, targetLng, unit.speed);
  }
}
