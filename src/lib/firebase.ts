import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  push, 
  remove, 
  get as rtdbGet, 
  onValue, 
  off 
} from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAVqk3nwK-_y-mOIdIrutJvukYREfylnMw",
  authDomain: "empire-age.firebaseapp.com",
  databaseURL: "https://empire-age-default-rtdb.firebaseio.com",
  projectId: "empire-age",
  storageBucket: "empire-age.firebasestorage.app",
  messagingSenderId: "1050860143748",
  appId: "1:1050860143748:web:eb24c9d0c69a8448b3aed1",
  measurementId: "G-M8PELWSPS8"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Auth is standard
export const auth = getAuth(app);

// Connectivity Test using RTDB
async function testConnection() {
  try {
    const database = getDatabase(app);
    const connectedRef = ref(database, '.info/connected');
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        console.log("Realtime Database connected successfully.");
      } else {
        console.log("Realtime Database offline.");
      }
    });
  } catch (error) {
    console.error('Realtime Database connection test failed:', error);
  }
}
testConnection();

// Standard Error Handler conforming to FirestoreErrorInfo (mapped to RTDB)
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Database (RTDB) Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to sanitize data (remove undefined, convert Date)
function sanitizeData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj === 'object') {
    if (obj && (obj._methodName === 'serverTimestamp' || (obj.constructor && obj.constructor.name === 'FieldValue'))) {
      return new Date().toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeData);
    }
    const copy: any = {};
    Object.entries(obj).forEach(([key, val]) => {
      if (val !== undefined) {
        copy[key] = sanitizeData(val);
      }
    });
    return copy;
  }
  return obj;
}

// Flatten object to paths for RTDB update (keeps nested merge behavior)
function flattenObject(obj: any, prefix = ''): any {
  let res: any = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { [prefix]: obj };
  }
  Object.entries(obj).forEach(([key, val]) => {
    const propName = prefix ? `${prefix}/${key}` : key;
    const rtdbKey = propName.replace(/\./g, '/');
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      const flatVal = flattenObject(val, rtdbKey);
      res = { ...res, ...flatVal };
    } else {
      res[rtdbKey] = val;
    }
  });
  return res;
}

// ------------------ FIRESTORE-LIKE TRANSLATION LAYER FOR RTDB ------------------

// Dummy DB object compatible with Firestore imports
export const db = { isRTDB: true };

export class RTDBDocRef {
  constructor(public path: string) {}
  get id() {
    const parts = this.path.split('/');
    return parts[parts.length - 1];
  }
}

export class RTDBCollectionRef {
  constructor(public path: string) {}
  get id() {
    const parts = this.path.split('/');
    return parts[parts.length - 1];
  }
}

export class RTDBQuery {
  constructor(
    public path: string,
    public filters: { field: string; op: string; value: any }[] = [],
    public orderBys: { field: string; direction: string }[] = [],
    public limitCount: number | null = null
  ) {}
}

export class RTDBDocumentSnapshot {
  constructor(public id: string, private _data: any, private _exists: boolean = true) {}
  
  data() {
    return this._data;
  }

  exists() {
    return this._exists;
  }

  get(fieldPath: string) {
    return this._data ? this._data[fieldPath] : undefined;
  }
}

export class RTDBQuerySnapshot {
  constructor(public docs: RTDBDocumentSnapshot[]) {}

  get size() {
    return this.docs.length;
  }

  get empty() {
    return this.docs.length === 0;
  }

  forEach(callback: (doc: RTDBDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

// Doc and Collection builders
export function doc(parent: any, ...paths: string[]) {
  let basePath = '';
  if (parent instanceof RTDBCollectionRef || parent instanceof RTDBDocRef) {
    basePath = parent.path;
  }
  const cleanPaths = paths.filter(Boolean);
  const finalPath = basePath ? [basePath, ...cleanPaths].join('/') : cleanPaths.join('/');
  return new RTDBDocRef(finalPath);
}

export function collection(parent: any, ...paths: string[]) {
  let basePath = '';
  if (parent instanceof RTDBCollectionRef || parent instanceof RTDBDocRef) {
    basePath = parent.path;
  }
  const cleanPaths = paths.filter(Boolean);
  const finalPath = basePath ? [basePath, ...cleanPaths].join('/') : cleanPaths.join('/');
  return new RTDBCollectionRef(finalPath);
}

// CRUD operations
export async function setDoc(docRef: RTDBDocRef, data: any, options?: { merge?: boolean }) {
  const database = getDatabase(app);
  const dbRef = ref(database, docRef.path);
  const cleanData = sanitizeData(data);
  if (options?.merge) {
    await update(dbRef, cleanData);
  } else {
    await set(dbRef, cleanData);
  }
}

export async function updateDoc(docRef: RTDBDocRef, data: any) {
  const database = getDatabase(app);
  const dbRef = ref(database, docRef.path);
  const cleanData = sanitizeData(data);
  const flattened = flattenObject(cleanData);
  await update(dbRef, flattened);
}

export async function addDoc(collectionRef: RTDBCollectionRef, data: any) {
  const database = getDatabase(app);
  const dbRef = ref(database, collectionRef.path);
  const cleanData = sanitizeData(data);
  const newRef = push(dbRef);
  const id = newRef.key || Math.random().toString(36).substring(7);
  const docWithId = { ...cleanData, id };
  await set(newRef, docWithId);
  return new RTDBDocRef(`${collectionRef.path}/${id}`);
}

export async function deleteDoc(docRef: RTDBDocRef) {
  const database = getDatabase(app);
  const dbRef = ref(database, docRef.path);
  await remove(dbRef);
}

export async function getDoc(docRef: RTDBDocRef) {
  const database = getDatabase(app);
  const dbRef = ref(database, docRef.path);
  const snapshot = await rtdbGet(dbRef);
  const val = snapshot.val();
  return new RTDBDocumentSnapshot(docRef.id, val, val !== null);
}

// Query constraints
export function query(parent: RTDBCollectionRef | RTDBQuery, ...constraints: any[]) {
  const path = parent.path;
  const q = new RTDBQuery(path);
  if (parent instanceof RTDBQuery) {
    q.filters = [...parent.filters];
    q.orderBys = [...parent.orderBys];
    q.limitCount = parent.limitCount;
  }
  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      q.filters.push(constraint);
    } else if (constraint.type === 'orderBy') {
      q.orderBys.push(constraint);
    } else if (constraint.type === 'limit') {
      q.limitCount = constraint.value;
    }
  }
  return q;
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(value: number) {
  return { type: 'limit', value };
}

// Query Execution
export async function getDocs(refOrQuery: RTDBCollectionRef | RTDBQuery) {
  const database = getDatabase(app);
  const dbRef = ref(database, refOrQuery.path);
  const snapshot = await rtdbGet(dbRef);
  const val = snapshot.val();

  let items: { id: string; data: any }[] = [];
  if (val) {
    Object.entries(val).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object') {
        items.push({ id: key, data: value });
      }
    });
  }

  let filtered = items;
  if (refOrQuery instanceof RTDBQuery) {
    for (const filter of refOrQuery.filters) {
      const { field, op, value } = filter;
      filtered = filtered.filter(item => {
        const itemVal = item.data?.[field];
        if (op === '==') return itemVal === value;
        if (op === '!=') return itemVal !== value;
        if (op === '>') return itemVal > value;
        if (op === '<') return itemVal < value;
        if (op === '>=') return itemVal >= value;
        if (op === '<=') return itemVal <= value;
        if (op === 'array-contains') return Array.isArray(itemVal) && itemVal.includes(value);
        return true;
      });
    }

    for (const ord of refOrQuery.orderBys) {
      const { field, direction } = ord;
      filtered.sort((a, b) => {
        const valA = a.data?.[field];
        const valB = b.data?.[field];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        const diff = valA < valB ? -1 : 1;
        return direction === 'desc' ? -diff : diff;
      });
    }

    if (refOrQuery.limitCount !== null) {
      filtered = filtered.slice(0, refOrQuery.limitCount);
    }
  }

  const docSnaps = filtered.map(item => new RTDBDocumentSnapshot(item.id, item.data, true));
  return new RTDBQuerySnapshot(docSnaps);
}

// Real-time Listeners
export function onSnapshot(
  refOrQuery: RTDBDocRef | RTDBCollectionRef | RTDBQuery,
  next: (snapshot: any) => void,
  error?: (error: any) => void
) {
  const database = getDatabase(app);
  const dbRef = ref(database, refOrQuery.path);

  const callback = (snapshot: any) => {
    const val = snapshot.val();
    if (refOrQuery instanceof RTDBDocRef) {
      const exists = val !== null;
      const docSnap = new RTDBDocumentSnapshot(refOrQuery.id, val, exists);
      next(docSnap);
    } else {
      let items: { id: string; data: any }[] = [];
      if (val) {
        Object.entries(val).forEach(([key, value]: [string, any]) => {
          if (value && typeof value === 'object') {
            items.push({ id: key, data: value });
          }
        });
      }

      let filtered = items;
      if (refOrQuery instanceof RTDBQuery) {
        for (const filter of refOrQuery.filters) {
          const { field, op, value } = filter;
          filtered = filtered.filter(item => {
            const itemVal = item.data?.[field];
            if (op === '==') return itemVal === value;
            if (op === '!=') return itemVal !== value;
            if (op === '>') return itemVal > value;
            if (op === '<') return itemVal < value;
            if (op === '>=') return itemVal >= value;
            if (op === '<=') return itemVal <= value;
            if (op === 'array-contains') return Array.isArray(itemVal) && itemVal.includes(value);
            return true;
          });
        }

        for (const ord of refOrQuery.orderBys) {
          const { field, direction } = ord;
          filtered.sort((a, b) => {
            const valA = a.data?.[field];
            const valB = b.data?.[field];
            if (valA === valB) return 0;
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            const diff = valA < valB ? -1 : 1;
            return direction === 'desc' ? -diff : diff;
          });
        }

        if (refOrQuery.limitCount !== null) {
          filtered = filtered.slice(0, refOrQuery.limitCount);
        }
      }

      const docSnaps = filtered.map(item => new RTDBDocumentSnapshot(item.id, item.data, true));
      const querySnap = new RTDBQuerySnapshot(docSnaps);
      next(querySnap);
    }
  };

  onValue(dbRef, callback, (err) => {
    if (error) error(err);
    else console.error('Database (RTDB) Listener error:', err);
  });

  return () => {
    off(dbRef, 'value', callback);
  };
}

// Batch writes simulation using RTDB multi-path update
export class RTDBWriteBatch {
  private _writes: { path: string; data: any }[] = [];

  set(docRef: RTDBDocRef, data: any) {
    this._writes.push({ path: docRef.path, data });
  }

  update(docRef: RTDBDocRef, data: any) {
    this._writes.push({ path: docRef.path, data });
  }

  async commit() {
    if (this._writes.length === 0) return;
    const database = getDatabase(app);
    const updates: any = {};
    for (const write of this._writes) {
      const sanitized = sanitizeData(write.data);
      updates[write.path] = sanitized;
    }
    await update(ref(database), updates);
    this._writes = [];
  }
}

export function writeBatch(databaseRef: any) {
  return new RTDBWriteBatch();
}

export function serverTimestamp() {
  return new Date().toISOString();
}
