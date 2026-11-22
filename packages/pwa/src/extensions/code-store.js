// What extensions keep in IndexedDB: the code of apps added from files, which can be larger than
// local storage likes, and each extension's own data, through flow.storage. Data can be anything
// IndexedDB can hold, such as a folder handle a source needs to find its files again.

const DB_NAME = 'flow-extensions';
const CODE = 'code';
const DATA = 'data';

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(CODE);
      request.result.createObjectStore(DATA);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run(store, mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const getCode = (id) => run(CODE, 'readonly', (s) => s.get(id));
export const putCode = (id, code) => run(CODE, 'readwrite', (s) => s.put(code, id));
export const deleteCode = (id) => run(CODE, 'readwrite', (s) => s.delete(id));

// Each extension's data is kept under its id, so one can't read another's.
const dataKey = (id, key) => `${id}\u0000${key}`;

/** An extension's own storage: get(key), set(key, value), delete(key) and keys(), all async. */
export function extensionStorage(id) {
  const prefix = dataKey(id, '');
  return {
    get: (key) => run(DATA, 'readonly', (s) => s.get(dataKey(id, String(key)))),
    set: (key, value) => run(DATA, 'readwrite', (s) => s.put(value, dataKey(id, String(key)))),
    delete: (key) => run(DATA, 'readwrite', (s) => s.delete(dataKey(id, String(key)))),
    keys: async () => (await run(DATA, 'readonly', (s) => s.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`))))
      .map((key) => key.slice(prefix.length)),
  };
}

/** Forgets everything an extension kept, as removing it does. */
export const clearExtensionData = (id) => run(DATA, 'readwrite', (s) => s.delete(IDBKeyRange.bound(dataKey(id, ''), `${dataKey(id, '')}￿`)));

/**
 * Loads an app's code as a module, from its text, and returns its activate function: the module's
 * export called activate, or its default export.
 */
export async function loadModule(code) {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  try {
    const module = await import(/* @vite-ignore */ url);
    const activate = module.activate ?? module.default;
    if (typeof activate !== 'function') throw new Error('Its code has to export a function called activate, or one as its default.');
    return activate;
  } finally {
    URL.revokeObjectURL(url);
  }
}
