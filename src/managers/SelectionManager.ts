import { Territory, MapUnit } from '../types';

export class SelectionManager {
  private static instance: SelectionManager;
  private selectedTerritory: Territory | null = null;
  private selectedUnit: MapUnit | null = null;

  private constructor() {}

  public static getInstance(): SelectionManager {
    if (!SelectionManager.instance) {
      SelectionManager.instance = new SelectionManager();
    }
    return SelectionManager.instance;
  }

  public selectTerritory(t: Territory | null) {
    this.selectedTerritory = t;
  }

  public getSelectedTerritory() {
    return this.selectedTerritory;
  }

  public selectUnit(u: MapUnit | null) {
    this.selectedUnit = u;
  }

  public getSelectedUnit() {
    return this.selectedUnit;
  }
}
