# Writing an app extension

An app extension adds to what Flow does: settings, commands in the Document menu, widgets in the editor's bars, tabs beside Write, Outline and Read, and cloud providers to open and save scripts in. Every app extension starts with a JSON manifest, and most bring code with it.

| How it arrives | What it can be | Where it comes from |
| --- | --- | --- |
| Files, added in App settings | A manifest, and its `.js` files if it has code | **App settings**, **Extensions**, **Add extension** |
| Registered by code on the page | A manifest and an `activate` function | `window.flowExtensions.register(manifest, activate)` |
| Built in | The same, shipped with Flow | A folder in `packages/pwa/src/extensions/` |

An extension someone adds starts turned on. The ones built into Flow start off. On or off, and its settings, are kept on this device.

## Adding one

Choose **Add extension** on the **Extensions** page of App settings, then pick the manifest, a `.json` file, together with any `.js` files it uses. Flow checks the manifest first, and says what's wrong under the button if anything is.

**Code asks first, every time.** When the files include code, Flow shows **Do you trust this extension?** before adding anything. It names the extension, its author and its files. Code from a file runs inside Flow with everything Flow can do: it can read and change your scripts, and reach the files and accounts Flow is connected to on this device. Flow can't check what the code does, so only add code from someone you trust. Cancel is the default, and an update asks again.

To update an extension, add its files again: the same `id` replaces the one before. **Remove** takes it out of Flow, with its settings and anything it kept on this device.

## The manifest

```json
{
  "id": "word-count",
  "kind": "app",
  "name": "Word count",
  "version": "1.0.0",
  "author": "Your name",
  "icon": { "paths": ["M4 6h16", "M4 12h10", "M4 18h7"] },
  "description": "Counts the words in the script, in the top right corner.",
  "main": "index.js",
  "settings": [],
  "commands": []
}
```

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | 2 to 40 lowercase letters, digits or dashes, starting with a letter. It can't be the id of an extension Flow already has. |
| `kind` | yes | `"app"` |
| `name` | yes | What App settings calls it, up to 60 characters |
| `version`, `author`, `description` | no | Shown with it on the Extensions page |
| `icon` | no | Its icon, below. Without one it shows a jigsaw piece. |
| `main` | no | The `.js` file its code starts from, such as `index.js` |
| `settings` | no | Its settings, below |
| `commands` | no | Commands that type text, below |

An app needs code (`main`) or at least one command, or there's nothing for it to do and Flow turns it away.

### Icons

An icon is its own drawing, as SVG path data on a 24 by 24 grid, drawn in Flow's line style: two pixels wide, rounded, in the color around it.

```json
"icon": { "paths": ["M12 2.5 21.5 12 12 21.5 2.5 12z", "m8.5 8 3.5 8 3.5-8"] }
```

Up to twelve paths. Only path data is taken, letters and numbers, so an icon can't carry anything but shapes. The name of one of Flow's own icons, such as `"settings"`, also works. Commands and tabs take an icon the same way, and use the extension's own when they have none.

### Commands that type text

These need no code. Each goes in the Document menu, in a group of its own after Flow's items, while a script is open. Choosing it types its `insert` text at the cursor in the Write tab, replacing any selection, as pasting would; in the other tabs, which have no cursor, it does nothing. Text with line breaks becomes several lines.

```json
"commands": [
  { "id": "interior", "label": "Insert INT.", "shortcut": "Mod+Shift+1", "widget": "top-end", "insert": "INT. " }
]
```

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Unique within the extension |
| `label` | yes | The menu item's name |
| `title` | no | Its tooltip |
| `icon` | no | Its icon; the extension's own otherwise |
| `shortcut` | no | Such as `Mod+Shift+K`. `Mod` is Cmd on a Mac and Ctrl elsewhere; `Ctrl`, `Alt`, `Shift` and `Meta` can be used too, and the last part is one letter or digit. The menu shows it as the system writes it. |
| `widget` | no | Also shows it as a button in the editor's bars: `"top-end"`, the top right corner, `"bottom-start"`, after the pills along the bottom, or `"bottom-end"`, just before undo and redo |
| `insert` | yes | The text it types |

Pick shortcuts that Flow and browsers don't already use. Ctrl+S, Ctrl+B, Ctrl+I, Ctrl+U and Ctrl+Z, for instance, are taken.

### Settings

An app with settings gets a page of its own in App settings, after a rule below Flow's own pages, while it's on. **Appearance** has a switch for each one, under **Settings tabs**, to take its page out of the rail. Its **Settings** button on the Extensions page opens the page either way.

```json
"settings": [
  { "key": "goal", "type": "number", "topic": "Counting", "label": "Daily goal", "default": 1000, "min": 0,
    "description": "Words to write each day." },
  { "key": "pages", "type": "boolean", "topic": "Counting", "label": "Count pages too", "default": false }
]
```

| Field | What it is |
| --- | --- |
| `key` | How code reads it, unique within the extension |
| `type` | `boolean` (a switch), `choice` (a dropdown of `options`, each `{ value, label }`), `text`, or `number` (with optional `min` and `max`) |
| `label` | Its name on the page |
| `description` | A line under it |
| `topic` | The heading it's grouped under, `General` when left out. Topics appear in the order their first setting does. |
| `default` | Its value until it's changed |

## Code

The `main` file is an ES module. It exports `activate`, or a default function, which Flow calls each time the extension is turned on, including when Flow starts with it on.

```js
// index.js
import { countWords } from './count.js';

export function activate(flow) {
  flow.onEditor((script) => {
    const node = document.createElement('span');
    const show = () => { node.textContent = `${countWords(script.value)} words`; };
    show();
    script.addEventListener('flow-change', show);
    const remove = script.addWidget({ node, place: 'top-end', label: 'Word count' });
    return () => {
      script.removeEventListener('flow-change', show);
      remove();
    };
  });
}
```

```js
// count.js
export const countWords = (text) => text.split(/\s+/).filter(Boolean).length;
```

**Files import each other as `./name.js`,** from the same folder, and every one has to be chosen in Add extension. Each is loaded as a module of its own, after the files it imports, so files can't import each other in a circle. Code from a file can't import Flow's own modules, or packages by name such as `lodash`; bundle those into your files, or use `flow.ui` for Flow's controls.

### activate(flow)

`activate` can return a function, which runs when the extension is turned off. Everything it added through `flow` is taken away by itself.

| Member | What it does |
| --- | --- |
| `flow.manifest` | Its checked manifest |
| `flow.settings.get(key)` | A setting's value, or its default |
| `flow.settings.onChange(fn)` | Calls `fn(key, value)` after one of its settings changes. Returns a function that stops it. |
| `flow.storage` | Its own storage on this device: `get(key)`, `set(key, value)`, `delete(key)` and `keys()`, all returning promises. It holds anything IndexedDB can, such as a folder handle, and other extensions can't read it. |
| `flow.ui` | Flow's controls, so an extension's look matches: `button`, `icon`, `pill`, `pillSep`, `toggleSwitch`, `iconSwitch`, `tabs`, `searchField`, `actionPill`, `Menu`, `openModal`. The [README](../../README.md#shared-controls) describes each. |
| `flow.toast(message)` | A short message at the bottom of the screen |
| `flow.addCommand(command)` | A command, as in the manifest, but with `run({ script })` in place of `insert`. `script` is the open `<flow-script>`. |
| `flow.addTab(tab)` | A tab beside Write, Outline and Read: `{ id, label, icon, title, render(root, context) }` |
| `flow.addSource(provider)` | A cloud provider, to open and save scripts in. It gets a sheet beside Open on the home page, and, when it signs in, a Connection topic on the extension's settings page. [The sources guide](sources.md) covers them. |
| `flow.onEditor(fn)` | Calls `fn(script)` for each script that opens, and for any already open. `fn` can return a cleanup, which runs as the script closes or the extension turns off. |

Every `add` returns a function that takes it away again.

### Tabs

`render(root, context)` runs each time the tab is shown, to fill `root`, and can return a function that runs as it's hidden. `context` has:

- `script`: the `<flow-script>` element
- `lines()`: the script's source lines
- `edit(lines)`: replaces them, as one undo step
- `show(line, tab)`: opens a source line in `'write'` or `'read'`

A tab's place in the address is `?tab=<extension id>-<tab id>`, so a reload stays on it. Undo, redo and the view menus hide while it's showing, and the page scale applies to its text through `font-size`.

### Widgets

Widgets are an extension's own pills in the editor's bars, through `script.addWidget`, usually from `flow.onEditor`:

| Option | What it is |
| --- | --- |
| `place` | `'top-end'`, the top right corner; `'bottom-start'`, after the editor's own pills along the bottom (the default); or `'bottom-end'`, at the bottom right, just before undo and redo |
| `node` | What the widget holds |
| `onClick`, `icon`, `label`, `title` | In place of `node`, a button: `label` names it, `icon` draws it, and `onClick` runs when it's pressed |
| `tabs` | The tabs it shows in, such as `['write']`; every tab when left out |
| `css` | Styles for it. A widget is inside the editor's shadow root, where the page's styles don't reach. The theme's `--flow-*` colors do. |

```js
flow.onEditor((script) => script.addWidget({
  place: 'top-end',
  label: 'Insert the date',
  icon: { paths: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'] },
  onClick: () => script.insertText(new Date().toLocaleDateString()),
}));
```

### Keys

`script.addEditorKeys(handler)` lets an extension see keys before the editor does. `handler` can have:

- `keydown(event, text)`: return `true` to take the key
- `input(typed, text)`: return `true` to keep typed text out, such as from a phone's keyboard
- `attach(text)`: runs when an editor is ready for it
- `detach()`: runs when it's taken away

`text` works on the script as lines. Places are `{ line, ch }`, counted from 0.

| Member | What it does |
| --- | --- |
| `lineCount`, `line(i)`, `lines()` | The source lines |
| `cursor()`, `selection()` | Where the cursor is, and `{ anchor, head }` |
| `setCursor(place)`, `select(anchor, head)` | Moves the cursor, or selects |
| `replace(from, to, text, cursor)` | Replaces the text between two places as one undo step, then puts the cursor at `cursor` |
| `undo()`, `redo()` | |
| `setCaret(style)` | `'block'` draws the cursor over its character; `null` for the usual line |
| `hidden(i)` | Whether a line is out of sight, such as the settings |

Shortcuts with Ctrl or Cmd are best left alone, so the app's own keep working.

## Registering from code on the page

Code already running on the page, such as a userscript or a page that hosts Flow, can register an extension without files:

```js
window.flowExtensions.register(manifest, activate);
```

It's checked like any other manifest, then listed as "Added by code" and "Runs its own code". Its on or off is kept, but the code has to register again on every visit. No trust question is asked, since the code is already running.

## Worked examples

- **Vim lite**, built into Flow in `packages/pwa/src/extensions/vim-lite/`, uses only this API. It has a manifest with four settings and its own icon; `index.js`, which uses `flow.onEditor` to give each script a widget beside undo and redo and a key handler; and `vim.js`, the engine, which edits only through `text`.
- [The sources guide](sources.md) has a worked example of a cloud provider.
