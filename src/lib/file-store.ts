// The uploaded ballot file is kept in IndexedDB (too big for localStorage)
// so the user's picks can be marked onto the original later.

const DB = "ballot-helper";
const STORE = "files";
const KEY = "original";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveOriginal = (file: File) => run("readwrite", (s) => s.put(file, KEY)).catch(() => undefined);
export const loadOriginal = () => run<File | undefined>("readonly", (s) => s.get(KEY)).catch(() => undefined);
export const clearOriginal = () => run("readwrite", (s) => s.delete(KEY)).catch(() => undefined);
