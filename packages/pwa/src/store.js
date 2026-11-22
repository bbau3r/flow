// Scripts autosave here, so work survives a closed tab or a dropped connection
// whether or not it has been saved to a file yet.
//
// A doc is { id, name, value, savedValue, provider, source, ref, updatedAt, highlights }.
// `savedValue` is what was last written to the provider (null if never), `source` is what the
// doc last knew of its provider ({ kind, label }), `ref` is whatever the provider needs to find
// the file again, and `highlights` are the Read tab's, kept on this device. A doc with no
// provider is only here: its source is Temp.

const DB_NAME = 'flow';
const STORE = 'docs';
// Things for this device that local storage can't hold, such as the save folder's handle.
const KEPT = 'kept';

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(KEPT)) db.createObjectStore(KEPT);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run(mode, action, store = STORE) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const getDoc = (id) => run('readonly', (s) => s.get(id));
export const putDoc = (doc) => run('readwrite', (s) => s.put(doc));
export const deleteDoc = (id) => run('readwrite', (s) => s.delete(id));

/** Something kept for this device under `key`, which can be anything IndexedDB holds. */
export const getKept = (key) => run('readonly', (s) => s.get(key), KEPT);
export const putKept = (key, value) => run('readwrite', (s) => s.put(value, key), KEPT);
export const deleteKept = (key) => run('readwrite', (s) => s.delete(key), KEPT);

export async function listDocs() {
  const docs = await run('readonly', (s) => s.getAll());
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createDoc({ name, value, provider = null, source = null, ref = null, saved = false }) {
  const doc = {
    id: crypto.randomUUID(),
    name,
    value,
    savedValue: saved ? value : null,
    provider,
    source,
    ref,
    updatedAt: Date.now(),
  };
  await putDoc(doc);
  return doc;
}
