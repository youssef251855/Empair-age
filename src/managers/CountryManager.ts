import { db, doc, updateDoc } from '../lib/firebase';
import { Country } from '../types';

export class CountryManager {
  private static instance: CountryManager;

  private constructor() {}

  public static getInstance(): CountryManager {
    if (!CountryManager.instance) {
      CountryManager.instance = new CountryManager();
    }
    return CountryManager.instance;
  }

  public async updateResources(countryId: string, updates: Partial<Country>) {
    await updateDoc(doc(db, 'countries', countryId), updates);
  }
}
