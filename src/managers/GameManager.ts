import { MapUnit, Territory, Country } from '../types';
import { db, updateDoc, doc } from '../lib/firebase';
import { OccupationManager } from './OccupationManager';

export class GameManager {
  private static instance: GameManager;
  private intervalId: NodeJS.Timeout | null = null;
  private currentCountryId: string | null = null;

  private constructor() {}

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  public init(currentCountryId: string) {
    this.currentCountryId = currentCountryId;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  public stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  // Called manually from GameContext's tick interval to avoid duplicating intervals
  public async tickCore(units: MapUnit[], territories: Territory[], countries: Country[]) {
    if (!this.currentCountryId) return;

    const now = Date.now();
    const myUnits = units.filter(u => u.ownerCountryId === this.currentCountryId);
    
    // 1. Process movement arrivals
    const arrivingUnits = myUnits.filter(u => u.status === 'moving' && u.arrivalTime && u.arrivalTime <= now);
    for (const unit of arrivingUnits) {
      if (unit.targetLat !== null && unit.targetLng !== null) {
        await updateDoc(doc(db, 'units', unit.id), {
          lat: unit.targetLat,
          lng: unit.targetLng,
          targetLat: null,
          targetLng: null,
          arrivalTime: null,
          status: 'idle'
        });

        // Trigger occupation check visually using a CustomEvent to be handled by Map or GameContext
        window.dispatchEvent(new CustomEvent('unit-arrived', {
          detail: { unit: { ...unit, lat: unit.targetLat, lng: unit.targetLng } }
        }));
      }
    }

    // 2. Process occupation progress
    const myOccupations = territories.filter(t => t.occupyingCountryId === this.currentCountryId);
    for (const terr of myOccupations) {
      const myCountry = countries.find(c => c.id === this.currentCountryId);
      if (myCountry) {
        // Wait, we need to make sure the unit is still there!
        const hasUnitThere = myUnits.some(u => 
          Math.abs(u.lat - (90 - (terr.posY / 100) * 180)) < 2 &&
          Math.abs(u.lng - ((terr.posX / 100) * 360 - 180)) < 2
        );

        if (hasUnitThere) {
          await OccupationManager.getInstance().progressOccupation(terr, myCountry.color, myCountry.name);
        } else {
          await OccupationManager.getInstance().stopOccupation(terr);
        }
      }
    }
  }

  private tick() {
    // Left empty, driven by GameContext instead
  }
}
