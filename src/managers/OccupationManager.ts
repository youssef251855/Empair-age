import { db, doc, updateDoc, serverTimestamp, getDoc } from '../lib/firebase';
import { Territory, MapUnit } from '../types';

export class OccupationManager {
  private static instance: OccupationManager;

  private constructor() {}

  public static getInstance(): OccupationManager {
    if (!OccupationManager.instance) {
      OccupationManager.instance = new OccupationManager();
    }
    return OccupationManager.instance;
  }

  // Called when a unit arrives at a hostile territory
  public async startOccupation(territory: Territory, unit: MapUnit) {
    if (territory.ownerCountryId === unit.ownerCountryId) return; // Already owns it

    const defense = territory.defenseValue || 0;
    
    // If army strength < defense, occupation fails
    if (unit.attack < defense) {
      console.log(`Occupation failed. Unit attack (${unit.attack}) < Defense (${defense})`);
      // Decrease defense slightly after failed attack
      await updateDoc(doc(db, 'territories', territory.id), {
        defenseValue: Math.max(0, defense - (unit.attack * 0.5))
      });
      return;
    }

    // Start occupation
    if (territory.occupyingCountryId !== unit.ownerCountryId) {
      await updateDoc(doc(db, 'territories', territory.id), {
        occupyingCountryId: unit.ownerCountryId,
        occupationProgress: 0
      });
    }
  }

  // Called to cancel occupation (e.g., unit left or destroyed)
  public async stopOccupation(territory: Territory) {
    if (territory.occupationProgress !== undefined || territory.occupyingCountryId !== null) {
      await updateDoc(doc(db, 'territories', territory.id), {
        occupyingCountryId: null,
        occupationProgress: 0
      });
    }
  }

  // Called to cancel if hostile army enters (actually, handled by BattleManager/Unit collisions)

  // Called periodically to increase occupation progress
  public async progressOccupation(territory: Territory, newOwnerColor: string, newOwnerName: string) {
    if (!territory.occupyingCountryId || territory.occupationProgress === undefined) return;

    let newProgress = territory.occupationProgress + 20; // 5 ticks to occupy (adjustable)

    if (newProgress >= 100) {
      // Occupation complete!
      await updateDoc(doc(db, 'territories', territory.id), {
        ownerCountryId: territory.occupyingCountryId,
        ownerCountryName: newOwnerName,
        color: newOwnerColor,
        occupyingCountryId: null,
        occupationProgress: 0,
        defenseValue: Math.max(0, (territory.defenseValue || 100) * 0.5), // Defense reduced after capture
        battleStatus: 'idle',
        battleAttackerId: null
      });
    } else {
      await updateDoc(doc(db, 'territories', territory.id), {
        occupationProgress: newProgress
      });
    }
  }
}
