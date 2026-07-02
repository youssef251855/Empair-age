import { db, doc, updateDoc, collection, getDocs, query, where, deleteDoc } from '../lib/firebase';
import { MapUnit, Territory, Country } from '../types';
import { OccupationManager } from './OccupationManager';

export class ArmyManager {
  private static instance: ArmyManager;
  private intervalId: NodeJS.Timeout | null = null;
  private units: MapUnit[] = [];
  private territories: Territory[] = [];
  private currentCountryId: string | null = null;

  private constructor() {}

  public static getInstance(): ArmyManager {
    if (!ArmyManager.instance) {
      ArmyManager.instance = new ArmyManager();
    }
    return ArmyManager.instance;
  }

  public init(currentCountryId: string) {
    this.currentCountryId = currentCountryId;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.tick(), 1000); // 1-second ticks
  }

  public updateState(units: MapUnit[], territories: Territory[]) {
    this.units = units;
    this.territories = territories;
  }

  public stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async tick() {
    if (!this.currentCountryId) return;

    // Only process units owned by the current player to distribute server-like workload
    const myUnits = this.units.filter(u => u.ownerCountryId === this.currentCountryId && u.status === 'moving' && u.targetLat !== null && u.targetLng !== null);

    const now = Date.now();

    for (const unit of myUnits) {
      if (unit.targetLat === null || unit.targetLng === null) continue;

      const dLat = unit.targetLat - unit.lat;
      const dLng = unit.targetLng - unit.lng;
      const distance = Math.sqrt(dLat * dLat + dLng * dLng);

      // Speed in degrees per second (sync this with client visuals!)
      const speedDegPerSec = unit.speed * 0.15; 
      
      let nextLat = unit.lat;
      let nextLng = unit.lng;
      let arrived = false;

      if (distance > speedDegPerSec) {
        nextLat += (dLat / distance) * speedDegPerSec;
        nextLng += (dLng / distance) * speedDegPerSec;
      } else {
        nextLat = unit.targetLat;
        nextLng = unit.targetLng;
        arrived = true;
      }

      const updates: any = { lat: nextLat, lng: nextLng };
      if (arrived) {
        updates.status = 'idle';
        updates.targetLat = null;
        updates.targetLng = null;
      }

      await updateDoc(doc(db, 'units', unit.id), updates);

      if (arrived) {
        this.checkArrival(unit, nextLat, nextLng);
      }
    }

    // Process occupations for territories this user is occupying
    const myOccupations = this.territories.filter(t => t.occupyingCountryId === this.currentCountryId);
    for (const terr of myOccupations) {
      // Find the country object for color and name
      // This is slightly tricky, we need the country name/color. 
      // It will be passed into progressOccupation by fetching or we can get it from unit.
      const occupyingUnit = this.units.find(u => u.ownerCountryId === this.currentCountryId && u.lat === terr.posY && u.lng === terr.posX);
      // Wait, terr.posY/posX are percentages?
      
      // We will handle progress in OccupationManager
      const myCountryName = "My Country"; // Need to pass this down
      const myColor = "#ffffff";
      
      // Let's rely on GameContext for this data
    }
  }

  private async checkArrival(unit: MapUnit, lat: number, lng: number) {
    // Check if unit arrived at a territory
    // Need to un-project lat/lng if territories use percentages? 
    // Wait, Map.tsx has `findProvinceAtCoords`. We need a math function here.
  }
}
