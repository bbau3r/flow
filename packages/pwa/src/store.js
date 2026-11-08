// Scripts autosave here, so work survives a closed tab or a dropped connection
// whether or not it has been saved to a file yet.
//
// A doc is { id, name, value, savedValue, provider, ref, updatedAt, highlights }. `savedValue`
// is what was last written to the provider (null if never), `ref` is whatever the provider
// needs to find the file again, and `highlights` are the Read tab's, kept on this device.

const DB_NAME = 'flow';
const STORE = 'docs';

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const getDoc = (id) => run('readonly', (s) => s.get(id));
export const putDoc = (doc) => run('readwrite', (s) => s.put(doc));
export const deleteDoc = (id) => run('readwrite', (s) => s.delete(id));

export async function listDocs() {
  const docs = await run('readonly', (s) => s.getAll());
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createDoc({ name, value, provider = null, ref = null, saved = false }) {
  const doc = {
    id: crypto.randomUUID(),
    name,
    value,
    savedValue: saved ? value : null,
    provider,
    ref,
    updatedAt: Date.now(),
  };
  await putDoc(doc);
  return doc;
}
