// What extensions keep in IndexedDB: the code of apps added from files, which can be larger than
// local storage likes, and each extension's own data, through flow.storage. An app's code is
// { main, files }: the name of the file it starts from, and every .js file by name. Data can be
// anything IndexedDB can hold, such as a folder handle a source needs to find its files again.

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

// The folder an extension was added from, for updating it from there again. Ids have no colons,
// so these keys never meet an extension's code.
export const getFolder = (id) => run(CODE, 'readonly', (s) => s.get(`folder:${id}`));
export const putFolder = (id, handle) => run(CODE, 'readwrite', (s) => s.put(handle, `folder:${id}`));
export const deleteFolder = (id) => run(CODE, 'readwrite', (s) => s.delete(`folder:${id}`));

// Each extension's data is kept under its id, so one can't read another's. Its keys all sort
// between the id and the id followed by the last character there is.
const LAST = String.fromCharCode(0xffff);
const dataKey = (id, key) => `${id}\u0000${key}`;

/** An extension's own storage: get(key), set(key, value), delete(key) and keys(), all async. */
export function extensionStorage(id) {
  const prefix = dataKey(id, '');
  return {
    get: (key) => run(DATA, 'readonly', (s) => s.get(dataKey(id, String(key)))),
    set: (key, value) => run(DATA, 'readwrite', (s) => s.put(value, dataKey(id, String(key)))),
    delete: (key) => run(DATA, 'readwrite', (s) => s.delete(dataKey(id, String(key)))),
    keys: async () => (await run(DATA, 'readonly', (s) => s.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}${LAST}`))))
      .map((key) => key.slice(prefix.length)),
  };
}

/** Forgets everything an extension kept, as removing it does. */
export const clearExtensionData = (id) => run(DATA, 'readwrite', (s) => s.delete(IDBKeyRange.bound(dataKey(id, ''), `${dataKey(id, '')}${LAST}`)));

// An import of another file beside it, such as from './engine.js', in a static import, an
// export from, or import().
const RELATIVE = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])\.\/([\w.-]+\.m?js)\2/g;

/**
 * Loads an app's code, { main, files }, as modules, and returns its activate function: the main
 * file's export called activate, or its default export. Files import each other as './name.js';
 * each is turned into a module of its own once the files it imports are, so they can't import
 * each other in a circle.
 */
export async function loadModule({ main, files }) {
  const urls = new Map();
  const loading = new Set();
  const urlFor = (name) => {
    if (urls.has(name)) return urls.get(name);
    if (!(name in files)) throw new Error(`${name} is imported but wasn’t added with the extension.`);
    if (loading.has(name)) throw new Error(`${name} imports itself through other files, which Flow can’t load.`);
    loading.add(name);
    const text = files[name].replace(RELATIVE, (_, before, quote, file) => `${before}${quote}${urlFor(file)}${quote}`);
    loading.delete(name);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    urls.set(name, url);
    return url;
  };
  // The URLs stay, as a file may import another only later, with import().
  const module = await import(/* @vite-ignore */ urlFor(main));
  const activate = module.activate ?? module.default;
  if (typeof activate !== 'function') throw new Error('Its code has to export a function called activate, or one as its default.');
  return activate;
}
