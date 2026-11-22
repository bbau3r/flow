// Proton Drive, as a cloud source added by an extension. Proton has no way yet for an app like
// Flow to sign in to Proton Drive directly, so this works through the Proton Drive desktop app,
// which keeps a folder on the computer in sync with the cloud. Connecting means choosing that
// folder; after that, scripts open from it and save into it, and the app syncs them.
//
// It's written only against the extension API: flow.addSource, and flow.storage to remember the
// folder between visits. It follows docs/extensions/sources.md, which uses it as its example.

const TYPES = [{ description: 'Fountain screenplay', accept: { 'text/plain': ['.fountain', '.spmd', '.txt'] } }];

const supported = () => 'showDirectoryPicker' in window && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
const isCancel = (err) => err?.name === 'AbortError';

// Flow tells a file that changed elsewhere by this name, and asks before overwriting it.
function conflict(message, target) {
  const err = new Error(message);
  err.name = 'ConflictError';
  err.target = target;
  return err;
}

const fileName = (name) => {
  const clean = String(name || 'Untitled Screenplay').replace(/\s*·\s*/g, ' - ').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Untitled Screenplay';
  return /\.(fountain|spmd|txt)$/i.test(clean) ? clean : `${clean}.fountain`;
};

export function activate(flow) {
  let folder = null;
  const loaded = flow.storage.get('folder').then((handle) => { folder = handle ?? null; }).catch(() => {});

  // Where a file sits in the folder, such as Scripts/Big Fish.fountain, or null when it's
  // somewhere else on the computer, which wouldn't reach Proton Drive.
  const pathIn = async (handle) => {
    const parts = await folder.resolve(handle);
    return parts ? parts.join('/') : null;
  };

  const outside = () => new Error(`That file isn’t in your Proton Drive folder, ${folder.name}, so it wouldn’t sync. Choose a file inside it, or use This device for files elsewhere.`);

  // A picker needs a fresh click, which choosing the folder can use up.
  const picker = async (pick) => {
    try {
      return await pick();
    } catch (err) {
      if (isCancel(err)) return null;
      if (err?.name === 'SecurityError') throw new Error('Proton Drive is connected. Choose it again to pick a script.');
      throw err;
    }
  };

  async function write(handle, text) {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return (await handle.getFile()).lastModified;
  }

  const source = {
    id: 'proton-drive',
    kind: 'cloud',
    label: 'Proton Drive',
    description: 'Scripts in your Proton Drive, through the folder the Proton Drive app syncs on this computer.',

    status: () => (supported() ? { ok: true } : { ok: false, reason: 'Needs Chrome or Edge on a computer' }),

    connection: () => ({ connected: !!folder, account: folder ? `the ${folder.name} folder` : '' }),

    async connect() {
      await loaded;
      const handle = await picker(() => window.showDirectoryPicker({ id: 'flow-proton-drive', mode: 'readwrite' }));
      if (!handle) return null;
      folder = handle;
      await flow.storage.set('folder', handle);
      flow.toast(`Proton Drive connected, through ${handle.name}.`);
      return source.connection();
    },

    async disconnect() {
      folder = null;
      await flow.storage.delete('folder');
    },

    saveHint: () => (folder ? `Saves into ${folder.name}, which the Proton Drive app syncs.` : 'Choose your Proton Drive folder first, then where in it to save.'),

    location: (doc) => doc.ref?.path ?? '',

    async open() {
      await loaded;
      const [handle] = (await picker(() => window.showOpenFilePicker({ startIn: folder, types: TYPES }))) ?? [];
      if (!handle) return null;
      const path = await pathIn(handle);
      if (path === null) throw outside();
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), ref: { handle, path, lastModified: file.lastModified } };
    },

    // Like saving on this device, the system's dialog opens on the file's own folder with its
    // name filled in, and a file changed elsewhere since is only overwritten when asked.
    async save(doc, { force = false, target = null } = {}) {
      await loaded;
      const original = doc.ref?.handle;
      const handle = target ?? await picker(() => window.showSaveFilePicker({
        suggestedName: fileName(doc.name),
        types: TYPES,
        startIn: original ?? folder,
      }));
      if (!handle) return null;
      const path = await pathIn(handle);
      if (path === null) throw outside();
      if (!force && original && await handle.isSameEntry(original)) {
        const current = await handle.getFile();
        if (current.lastModified > doc.ref.lastModified) throw conflict(`${doc.name} changed in Proton Drive since it was last opened or saved.`, handle);
      }
      return { name: handle.name, ref: { handle, path, lastModified: await write(handle, doc.value) } };
    },

    saveAs(doc) {
      return source.save({ ...doc, ref: null });
    },
  };

  flow.addSource(source);
}
