# Adding a cloud source

A source is a place scripts are opened from and saved to. Flow names every script by where it lives:

| Source | What it means |
| --- | --- |
| **Temp** | Not in a file yet. It lives only in this browser's storage, on this device, and autosaves there. |
| **Local** | A file on this device, through This device. |
| **Cloud** | A cloud service, shown with its name, such as **Cloud · Proton Drive**. |

Flow has This device built in. A cloud source comes from an app extension, as code: read [the apps guide](apps.md) first for how extensions are made and added. Once its extension is on, a source shows on **App settings**, **Sources**, with **Connect** if it needs signing in, and Open on the home page and the first Save offer it beside This device.

## The provider

An extension adds a source with `flow.addSource(provider)`, usually in `activate`. It's taken away again when the extension is turned off. A provider is an object with:

| Member | What it does |
| --- | --- |
| `id` | Unique among sources, such as `'proton-drive'`. Scripts remember it, to save back to the same place. |
| `kind` | `'cloud'`, or `'local'` for files on this device |
| `label` | Its name, such as `'Proton Drive'` |
| `description` | A line about it, for the Sources page and Open |
| `status()` | `{ ok: true }`, or `{ ok: false, reason }` when it can't be used here, such as `'Needs Chrome or Edge on a computer'`. The reason shows on its card, which is turned off. |
| `open()` | Lets the person choose a script, and resolves to `{ name, text, ref }`, or `null` if they cancelled |
| `save(doc, options)` | Writes `doc.value` to the doc's own file, found through `doc.ref`. Resolves to `{ name, ref }`, or `null` if cancelled. |
| `saveAs(doc)` | Writes to a new file. Resolves to `{ name, ref }`, or `null` if cancelled. |
| `saveHint()` | What choosing it in the Save dialog will do, in a sentence |
| `location(doc)` | Where in the service a doc lives, in words, such as its path, or `''`. It follows the source in the document pill: Cloud · Proton Drive · Scripts/Big Fish.fountain. |

`ref` is whatever your source needs to find the file again: an id, a path, a handle. Flow keeps it with the script on this device, in IndexedDB, so it can be anything IndexedDB can hold, and hands it back as `doc.ref`. Keep secrets such as tokens out of it, and in `flow.storage` instead.

### Signing in

A source that needs signing in, or setting up, adds three more:

| Member | What it does |
| --- | --- |
| `connection()` | `{ connected, account }`, where `account` says who or where, such as an email address or a folder's name |
| `connect()` | Signs in or sets up, and resolves to `connection()`, or `null` if the person cancelled |
| `disconnect()` | Signs out, or forgets the setup |

Flow calls `connect()` before opening or saving with a source that isn't connected, and the Sources page offers **Connect** and **Disconnect**. Keep whatever connecting gives you, such as a token or a handle, in `flow.storage`, and read it back in `activate`, so the person stays connected between visits.

Signing in to most cloud services happens in a pop-up window or by redirecting the page, through OAuth. Your code does that itself, with the service's own library or its documented endpoints, from the browser. Check that the service allows requests from a web page (CORS) and that it lets apps like Flow use it; some, such as Proton Drive, don't yet.

### Files changed elsewhere

When the file changed since the script was opened or saved, `save` shouldn't overwrite it without asking. Throw an error named `ConflictError`, with `target` set to whatever your code needs to save to it after all:

```js
const err = new Error(`${doc.name} changed in the cloud since it was last opened or saved.`);
err.name = 'ConflictError';
err.target = file;
throw err;
```

Flow asks the person, and if they choose to overwrite, calls `save(doc, { force: true, target })` with that `target`.

### Errors

Anything else `open`, `save` or `saveAs` throws is shown to the person in a short message, so write its `message` for them: what went wrong and what they can do. When saving fails, Flow adds that the changes are still kept on this device. Cancelling isn't an error: resolve to `null`.

## A worked example: Proton Drive

Proton has no way yet for an app like Flow to sign in to Proton Drive directly. The Proton Drive desktop app keeps a folder on the computer in sync with the cloud, though, and browsers can be given a folder. So Flow's built-in Proton Drive source, in `packages/pwa/src/extensions/proton-drive/index.js`, connects by having the person choose that folder:

```js
export function activate(flow) {
  let folder = null;
  const loaded = flow.storage.get('folder').then((handle) => { folder = handle ?? null; });

  const source = {
    id: 'proton-drive',
    kind: 'cloud',
    label: 'Proton Drive',
    description: 'Scripts in your Proton Drive, through the folder the Proton Drive app syncs on this computer.',
    status: () => ('showDirectoryPicker' in window ? { ok: true } : { ok: false, reason: 'Needs Chrome or Edge on a computer' }),

    connection: () => ({ connected: !!folder, account: folder ? `the ${folder.name} folder` : '' }),
    async connect() {
      await loaded;
      folder = await window.showDirectoryPicker({ mode: 'readwrite' });
      await flow.storage.set('folder', folder);
      return source.connection();
    },
    async disconnect() {
      folder = null;
      await flow.storage.delete('folder');
    },

    async open() {
      const [handle] = await window.showOpenFilePicker({ startIn: folder });
      const path = await folder.resolve(handle); // null when it's outside the folder
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), ref: { handle, path: path.join('/'), lastModified: file.lastModified } };
    },
    // save, saveAs, saveHint and location follow the same pattern.
  };

  flow.addSource(source);
}
```

The real file also turns away files outside the folder, which wouldn't sync, treats cancelling as `null`, checks for changes made elsewhere before saving, and explains when the browser needs another click before a second picker can open. A source for a service with an API swaps the folder for a sign-in and the pickers for the service's own file list, and keeps the same shape.

## Testing it

Flow's tests replace the system's pickers with stand-ins over the browser's private file system, so a source can be tested headless. See the Proton Drive tests in `packages/pwa/e2e/extensions.spec.js`.
