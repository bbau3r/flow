# Adding a cloud provider

A source is a place scripts are opened from and saved to. Flow names every script by where it lives:

| Source | What it means |
| --- | --- |
| **Temp** | Not in a file yet. It lives only in this browser's storage, on this device, and autosaves there until it's saved to a file. |
| **Local** | A file on this device, through This device. |
| **Cloud** | A cloud service, shown with its name, such as **Cloud · Example Drive**. |

Flow has This device built in, and a save folder in App settings' Defaults for where its dialogs start. Cloud providers come from app extensions, as code: read [the apps guide](apps.md) first for how extensions are made and added.

Once its extension is on, a cloud provider:

- has a sheet of its own on the home page, beside New and Open, with its icon, which opens a script from it;
- is offered when a script is first saved, beside This device, marked Cloud;
- gets a **Connection** topic on its extension's settings page in App settings, with **Connect** and **Disconnect**, when it needs signing in.

## The provider

An extension adds a cloud provider with `flow.addSource(provider)`, usually in `activate`. It's taken away again when the extension is turned off. A provider is an object with:

| Member | What it does |
| --- | --- |
| `id` | Unique among sources, such as `'example-drive'`. Scripts remember it, to save back to the same place. |
| `kind` | `'cloud'` |
| `label` | Its name, such as `'Example Drive'`, on its sheet and wherever scripts in it are named |
| `description` | A line about it, under its name on its settings page |
| `icon` | Optional: its icon for its sheet, as `{ paths }` or one of Flow's icon names. The extension's own otherwise. |
| `status()` | `{ ok: true }`, or `{ ok: false, reason }` when it can't be used here, such as `'Needs a connection'`. The reason shows on its sheet, which is turned off. |
| `open()` | Lets the person choose a script, and resolves to `{ name, text, ref }`, or `null` if they cancelled |
| `save(doc, options)` | Writes `doc.value` to the doc's own file, found through `doc.ref`. Resolves to `{ name, ref }`, or `null` if cancelled. |
| `saveAs(doc)` | Writes to a new file. Resolves to `{ name, ref }`, or `null` if cancelled. |
| `saveHint()` | What choosing it in the Save dialog will do, in a sentence |
| `location(doc)` | Where in the service a doc lives, in words, such as its path, or `''`. It follows the source in the document pill: Cloud · Example Drive · Scripts/Big Fish.fountain. |

`ref` is whatever your provider needs to find the file again: an id, a path. Flow keeps it with the script on this device, in IndexedDB, so it can be anything IndexedDB can hold, and hands it back as `doc.ref`. Keep secrets such as tokens out of it, and in `flow.storage` instead.

### Choosing files

`open()` and `saveAs()` let the person choose a file in the service. Most services have no picker a browser can show, so build one with `flow.ui.openModal` and the service's own list of files: a list of scripts to open, or a folder and a name to save under. Resolve to `null` when the person closes it.

### Signing in

A provider that needs signing in adds three more:

| Member | What it does |
| --- | --- |
| `connection()` | `{ connected, account }`, where `account` says who, such as an email address |
| `connect()` | Signs in, and resolves to `connection()`, or `null` if the person cancelled |
| `disconnect()` | Signs out |

Flow calls `connect()` before opening or saving with a provider that isn't connected, so a sheet on the home page signs in first when it needs to. Keep whatever signing in gives you, such as a token, in `flow.storage`, and read it back in `activate`, so the person stays signed in between visits.

Signing in to most cloud services happens in a pop-up window or by redirecting the page, through OAuth. Your code does that itself, with the service's own library or its documented endpoints, from the browser. Before you start, check that:

- the service lets apps like Flow use it, and on what terms;
- it accepts requests from a web page (CORS), since Flow runs entirely in the browser with no server of its own;
- its sign-in works from Flow's address, which most services ask you to register.

### Files changed elsewhere

When the file changed since the script was opened or saved, `save` shouldn't overwrite it without asking. Throw an error named `ConflictError`, with `target` set to whatever your code needs to save to it after all:

```js
const err = new Error(`${doc.name} changed in Example Drive since it was last opened or saved.`);
err.name = 'ConflictError';
err.target = file;
throw err;
```

Flow asks the person, and if they choose to overwrite, calls `save(doc, { force: true, target })` with that `target`.

### Errors

Anything else `open`, `save`, `saveAs` or `connect` throws is shown to the person in a short message, so write its `message` for them: what went wrong and what they can do. When saving fails, Flow adds that the changes are still kept on this device. Cancelling isn't an error: resolve to `null`.

## An example

A provider for a made-up service, Example Drive, with a REST API and OAuth sign-in. The shape is what matters; a real service's endpoints, scopes and sign-in differ.

```js
// index.js
const API = 'https://api.example-drive.com/v1';

export function activate(flow) {
  let token = null;
  const loaded = flow.storage.get('token').then((saved) => { token = saved ?? null; });

  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
    if (response.status === 401) {
      token = null;
      await flow.storage.delete('token');
      throw new Error('Example Drive signed you out. Connect it again on its settings page.');
    }
    if (!response.ok) throw new Error(`Example Drive couldn’t do that (${response.status}).`);
    return response;
  };

  const source = {
    id: 'example-drive',
    kind: 'cloud',
    label: 'Example Drive',
    description: 'Scripts in your Example Drive.',
    status: () => (navigator.onLine ? { ok: true } : { ok: false, reason: 'Offline' }),

    connection: () => ({ connected: !!token, account: token ? 'Signed in' : '' }),
    async connect() {
      await loaded;
      token = await signInWithPopup(); // the service's OAuth flow, resolving to a token or null
      if (!token) return null;
      await flow.storage.set('token', token);
      return source.connection();
    },
    async disconnect() {
      token = null;
      await flow.storage.delete('token');
    },

    async open() {
      const files = await (await call('/files?type=fountain')).json();
      const chosen = await chooseFile(flow.ui, files); // a modal listing them, resolving to one or null
      if (!chosen) return null;
      const text = await (await call(`/files/${chosen.id}/content`)).text();
      return { name: chosen.name, text, ref: { id: chosen.id, version: chosen.version } };
    },
    async save(doc, { force = false } = {}) {
      if (!doc.ref?.id) return source.saveAs(doc);
      const current = await (await call(`/files/${doc.ref.id}`)).json();
      if (!force && current.version !== doc.ref.version) {
        const err = new Error(`${doc.name} changed in Example Drive since it was last opened or saved.`);
        err.name = 'ConflictError';
        throw err;
      }
      const saved = await (await call(`/files/${doc.ref.id}/content`, { method: 'PUT', body: doc.value })).json();
      return { name: saved.name, ref: { id: saved.id, version: saved.version } };
    },
    async saveAs(doc) {
      const name = await askForName(flow.ui, doc.name); // a modal with a name field, resolving to it or null
      if (!name) return null;
      const saved = await (await call('/files', { method: 'POST', headers: { 'X-Name': name }, body: doc.value })).json();
      return { name: saved.name, ref: { id: saved.id, version: saved.version } };
    },
    saveHint: () => 'Saves to your Example Drive.',
    location: (doc) => doc.ref?.path ?? '',
  };

  flow.addSource(source);
}
```

`signInWithPopup`, `chooseFile` and `askForName` are left to you: they depend on the service and on how you'd like choosing to look. Keep them in files of their own beside `index.js`, imported as `./name.js`, and add them all together.

## Testing it

Flow's tests register providers from code with `window.flowExtensions.register`, with stand-in `open` and `connect` functions, so the home page's sheets, the Connection topic and saving can be tested without a real account. See the cloud provider tests in `packages/pwa/e2e/extensions.spec.js`.
