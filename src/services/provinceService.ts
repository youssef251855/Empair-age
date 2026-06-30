import { collection, doc, setDoc, updateDoc, onSnapshot, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Territory, Garrison, Country, ResourceType } from '../types';
import { SOVEREIGN_CONFIGS } from './countriesData';

// Types representing Leaflet-based Province Extensions
export interface ProvinceState extends Territory {
  population: number;
  gold: number;   // production rate or resource reserves
  oil: number;
  food: number;
  iron: number;
}

/**
 * Initializes and seeds the databases with the GeoJSON-divided list of Provinces
 * if they don't already exist. Maps them cleanly to /territories.
 */
export async function seedProvincesFromGeoJSON(geojsonData: any, matchId: string): Promise<void> {
  try {
    const territoriesCol = collection(db, 'territories');
    // Check if provinces already exist for this specific match
    const q = query(territoriesCol, where('matchId', '==', matchId));
    const existingSnap = await getDocs(q);
    
    // If we already have seeded territories/provinces, keep them
    if (existingSnap.size > 0) {
      console.log(`Provinces are already seeded with GeoJSON details for match: ${matchId}`);
      return;
    }

    console.log(`Seeding countries and provinces from GeoJSON into Firestore for match: ${matchId}...`);
    const allProvinces: any[] = [];
    const resourceTypes: ResourceType[] = ['gold', 'oil', 'iron', 'food', 'electricity'];
    const territoryTypes = ['plain', 'mountain', 'coastal', 'desert'] as const;

    // First collect all unique countries present
    const uniqueCountryIsos = new Set<string>();

    geojsonData.features.forEach((feat: any) => {
      const countryIso = feat.properties.countryIso || 'XYZ';
      uniqueCountryIsos.add(countryIso);
      
      const provinceId = feat.properties.id;
      // Calculate a rough bounding center for placement of armies
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      try {
        if (feat.geometry.type === 'Polygon' || feat.geometry.type === 'MultiPolygon') {
          const coordsList = feat.geometry.type === 'Polygon' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
          for (const poly of coordsList) {
            for (const ring of poly) {
              for (const [x, y] of ring) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
        }
      } catch (e) {
        // Fallback or ignore
      }
      
      let centerLng = (minX === Infinity) ? 0 : (minX + maxX) / 2;
      let centerLat = (minY === Infinity) ? 0 : (minY + maxY) / 2;

      // Make sure we carry forward the province center logic required by rendering
      feat.properties.centerLng = centerLng;
      feat.properties.centerLat = centerLat;

      allProvinces.push(feat);
    });

    // Firestore batch limits: Max 500 writes in a single commit, so we partition carefully
    let activeBatch = writeBatch(db);
    let operationCount = 0;

    const queueWrite = async (docRef: any, docData: any) => {
      activeBatch.set(docRef, docData);
      operationCount++;
      if (operationCount >= 400) {
        await activeBatch.commit();
        activeBatch = writeBatch(db);
        operationCount = 0;
      }
    };

    // 1. Seed Country Profiles with BOT status for each unique country
    for (const iso of Array.from(uniqueCountryIsos)) {
      const config = SOVEREIGN_CONFIGS[iso] || {
        name: `جمهورية ${iso}`,
        flag: '🎌',
        color: '#4b5563',
        capital: 'عاصمة الحصن',
        desc: 'دولة ناشطة بالامبراطورية السياسية.'
      };

      const countryDocId = `country_${iso}_${matchId}`;
      const botCountry = {
        id: countryDocId,
        userId: `bot_country_${iso}`,
        matchId: matchId,
        name: config.name,
        flagUrl: config.flag,
        color: config.color,
        description: config.desc,
        capital: config.capital,
        leaderName: `الجنرال الآلي 🤖 (BOT_${iso})`,
        gold: 2000,
        oil: 1000,
        iron: 1200,
        food: 1200,
        electricity: 100,
        population: 4500000,
        unemploymentRate: 5,
        taxRate: 15,
        allianceId: null,
        allianceName: null,
        army: {
          infantry: 150,
          specialForces: 15,
          tanks: 8,
          artillery: 12,
          antiAir: 5,
          jets: 3,
          reconPlanes: 2,
          warships: 1,
          submarines: 1,
          missiles: 1
        },
        createdAt: new Date().toISOString(),
        lastHarvestTime: new Date().toISOString(),
        isBot: true,
        empireCredits: 100 // Premium currency 💎
      };

      const countryRef = doc(db, 'countries', countryDocId);
      await queueWrite(countryRef, botCountry);
    }

    const countryCapitalsSet = new Set<string>();

    // 2. Seed Provinces under their respective Country owner
    for (const prov of allProvinces) {
      const p = prov.properties;
      const docId = `${matchId}_${p.id}`; // Ensure absolute isolation per match
      const iso = p.countryIso || 'XYZ';

      const config = SOVEREIGN_CONFIGS[iso] || {
        name: `جمهورية ${iso}`,
        flag: '🎌',
        color: '#4b5563',
        capital: 'عاصمة الحصن',
        desc: 'دولة ناشطة بالامبراطورية السياسية.'
      };

      const countryDocId = `country_${iso}_${matchId}`;

      const isCapital = !countryCapitalsSet.has(countryDocId);
      if (isCapital) {
        countryCapitalsSet.add(countryDocId);
      }

      // Assign resources
      const rIdx = Math.floor(Math.random() * resourceTypes.length);
      const resSpecialty = resourceTypes[rIdx];

      const tIdx = Math.floor(Math.random() * territoryTypes.length);
      const tType = territoryTypes[tIdx];

      let posX = Math.round(((p.centerLng + 180) / 360) * 100);
      let posY = Math.round(((90 - p.centerLat) / 180) * 100);

      posX = Math.max(5, Math.min(95, posX));
      posY = Math.max(5, Math.min(95, posY));

      const newProvince: ProvinceState & { matchId: string } = {
        id: docId,
        name: p.name,
        ownerCountryId: countryDocId, // Assigned fully to the seeded Country Profile
        ownerCountryName: config.name,
        flagEmoji: config.flag,
        color: config.color, // Matching country color
        posX,
        posY,
        type: tType,
        resourceSpecialty: resSpecialty,
        resourceMultiplier: parseFloat((1.0 + Math.random() * 1.0).toFixed(1)),
        isCapital: isCapital,
        garrison: {
          infantry: Math.floor(25 + Math.random() * 25),
          specialForces: Math.floor(1 + Math.random() * 5),
          tanks: Math.floor(2 + Math.random() * 4),
          artillery: Math.floor(2 + Math.random() * 6),
          antiAir: Math.floor(Math.random() * 3),
          jets: 0,
          missiles: 0
        },
        population: Math.floor(500000 + Math.random() * 2000000),
        gold: Math.floor(50 + Math.random() * 200),
        oil: Math.floor(20 + Math.random() * 150),
        food: Math.floor(80 + Math.random() * 300),
        iron: Math.floor(30 + Math.random() * 180),
        matchId: matchId
      };

      const docRef = doc(db, 'territories', docId);
      await queueWrite(docRef, newProvince);
    }

    // Commit any remaining database operations
    if (operationCount > 0) {
      await activeBatch.commit();
    }

    console.log(`Successfully seeded ALL countries and ${allProvinces.length} sovereign provinces across the world for match ${matchId}!`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'territories');
  }
}

/**
 * Capture a province in Firestore, update state, resources, and log battle.
 */
export async function captureProvinceState(
  provinceId: string,
  occupyingCountry: Country,
  conqueredGarrison: Garrison
): Promise<void> {
  try {
    const provRef = doc(db, 'territories', provinceId);
    
    await updateDoc(provRef, {
      ownerCountryId: occupyingCountry.id,
      ownerCountryName: occupyingCountry.name,
      flagEmoji: occupyingCountry.flagUrl || '🎌',
      color: occupyingCountry.color || '#3b82f6',
      garrison: conqueredGarrison
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `territories/${provinceId}`);
  }
}

/**
 * Listens to dynamic real-time updates for all provinces in Firestore.
 */
export function listenToProvinces(matchId: string, callback: (provinces: ProvinceState[]) => void) {
  const territoriesCol = collection(db, 'territories');
  const q = query(territoriesCol, where('matchId', '==', matchId));
  return onSnapshot(q, (snap) => {
    const provinces: ProvinceState[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      provinces.push({
        id: doc.id,
        ...data
      } as ProvinceState);
    });
    callback(provinces);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'territories');
  });
}
