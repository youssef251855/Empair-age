import { collection, doc, setDoc, updateDoc, onSnapshot, query, where, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { MapUnit } from '../types';

export const spawnUnit = async (unit: MapUnit) => {
  try {
    const docRef = doc(db, 'units', unit.id);
    await setDoc(docRef, unit);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `units`);
  }
};

export const updateUnitTarget = async (unitId: string, lat: number, lng: number) => {
  try {
    const docRef = doc(db, 'units', unitId);
    await updateDoc(docRef, {
      lat: lat,
      lng: lng,
      targetLat: lat,
      targetLng: lng,
      status: 'moved',
      lastUpdatedAt: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `units/${unitId}`);
  }
};

export const updateUnitHealth = async (unitId: string, hp: number) => {
  try {
    const docRef = doc(db, 'units', unitId);
    if (hp <= 0) {
      await deleteDoc(docRef);
    } else {
      await updateDoc(docRef, { hp });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `units/${unitId}`);
  }
};

export const updateUnitStatus = async (unitId: string, status: string) => {
  try {
    const docRef = doc(db, 'units', unitId);
    await updateDoc(docRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `units/${unitId}`);
  }
};

export const listenToUnits = (matchId: string, callback: (units: MapUnit[]) => void) => {
  const unitsRef = collection(db, 'units');
  const q = query(unitsRef, where('matchId', '==', matchId));

  return onSnapshot(
    q,
    (snapshot) => {
      const live: MapUnit[] = [];
      snapshot.forEach((d) => {
        live.push({ id: d.id, ...d.data() } as MapUnit);
      });
      callback(live);
    },
    (err) => {
      console.error('listenToUnits error:', err);
    }
  );
};
