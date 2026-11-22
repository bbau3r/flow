# Writing an app extension

An app extension adds to what Flow does: settings, commands in the Document menu, tabs beside Write, Outline and Read, places to open scripts from on the home page, and bubbles along the bottom of the editor. Every app extension starts with a JSON manifest. What it can do beyond that depends on how it reaches Flow.

| How it arrives | What it can be | Where it comes from |
| --- | --- | --- |
| A JSON file, added in App settings | The manifest only: settings and commands that type text | **App settings**, **Extensions**, **Add extension** |
| Registered by code on the page | The manifest and an `activate` function, so anything below | `window.flowExtensions.register(manifest, activate)` |
| Built in | The same as code, shipped with Flow | A folder in `packages/pwa/src/extensions/` |

**Flow never loads code from a file.** Adding a `manifest.json` reads that file and nothing else, even if a `.js` file sits beside it. An app added from a file needs at least one command that types text, or Flow turns it away, since it would have nothing to run.

Every extension starts turned off, and its on or off, and its settings, are kept on this device.

## The manifest

```json
{
  "id": "scene-starters",
  "kind": "app",
  "name": "Scene starters",
  "version": "1.0.0",
  "author": "Your name",
  "icon": "scene",
  "description": "Types the start of a scene heading.",
  "settings": [],
  "commands": [
    { "id": "interior", "label": "Insert INT.", "shortcut": "Mod+Shift+1", "insert": "INT. " },
    { "id": "exterior", "label": "Insert EXT.", "shortcut": "Mod+Shift+2", "insert": "EXT. " }
  ]
}
```

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | 2 to 40 lowercase letters, digits or dashes, starting with a letter. It can't be the id of an extension Flow already has. |
| `kind` | yes | `"app"` |
| `name` | yes | What App settings calls it, up to 60 characters |
| `version`, `author`, `description` | no | Shown on its card on the Extensions page |
| `icon` | no | One of Flow's icon names, such as `scene`, `keyboard` or `info`. Unknown names draw nothing. |
| `settings` | no | Its settings, below |
| `commands` | no | Commands that type text, below |

### Commands that type text

Each command goes in the Document menu, in a group of its own after Flow's items, while a script is open. Choosing it types its `insert` text at the cursor in the Write tab, replacing any selection, as pasting would; in the other tabs, which have no cursor, it does nothing. Text with line breaks becomes several lines.

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Unique within the extension |
| `label` | yes | The menu item's name |
| `title` | no | Its tooltip |
| `icon` | no | An icon name; the extension's own icon otherwise |
| `shortcut` | no | Such as `Mod+Shift+K`. `Mod` is Cmd on a Mac and Ctrl elsewhere; `Ctrl`, `Alt`, `Shift` and `Meta` can be used too, and the last part is one letter or digit. The menu shows it as the system writes it. |
| `insert` | yes, from a file | The text it types |

Pick shortcuts that Flow and browsers don't already use. Ctrl+S, Ctrl+B, Ctrl+I, Ctrl+U and Ctrl+Z, for instance, are taken.

### Settings

An app with settings gets a page of its own in App settings, after a rule below Flow's own pages, while it's on. **Appearance** has a switch for each one, under **Settings tabs**, to take its page out of the rail. Its **Settings** button on the Extensions page opens the page either way.

```json
"settings": [
  { "key": "startMode", "type": "choice", "topic": "Modes", "label": "Start in", "default": "normal",
    "options": [{ "value": "normal", "label": "Normal" }, { "value": "insert", "label": "Insert" }],
    "description": "The mode a script opens in." },
  { "key": "bubble", "type": "boolean", "topic": "Display", "label": "Mode bubble", "default": true }
]
```

| Field | What it is |
| --- | --- |
| `key` | How code reads it, unique within the extension |
| `type` | `boolean` (a switch), `choice` (a dropdown of `options`), `text` or `number` (with optional `min` and `max`) |
| `label` | Its name on the page |
| `description` | A line under it |
| `topic` | The heading it's grouped under, `General` when left out. Topics appear in the order their first setting does. |
| `default` | Its value until it's changed |

## Extensions with code

Code can register an extension on the page, as a userscript or a page that hosts Flow would:

```js
window.flowExtensions.register(manifest, activate);
```

It's checked like any other manifest, then listed on the Extensions page as "Added by code". Its on or off is kept, but the code itself has to register again on every visit. Flow's built-in extensions work the same way, but ship with it: each is a folder in `packages/pwa/src/extensions/` holding `manifest.json` and `index.js`, listed in `built-in.js`.

### activate(flow)

Flow calls `activate` each time the extension is turned on, including when Flow starts with it on. It can return a function, which runs when it's turned off. Everything it added through `flow` is taken away by itself.

| Member | What it does |
| --- | --- |
| `flow.manifest` | Its checked manifest |
| `flow.settings.get(key)` | A setting's value, or its default |
| `flow.settings.onChange(fn)` | Calls `fn(key, value)` after one of its settings changes. Returns a function that stops it. |
| `flow.addCommand(command)` | A command, as in the manifest, but with `run({ script })` in place of `insert`. `script` is the open `<flow-script>`. |
| `flow.addTab(tab)` | A tab beside Write, Outline and Read: `{ id, label, icon, title, render(root, context) }` |
| `flow.addSource(provider)` | A place to open and save scripts, which the home page's Open offers beside This device |
| `flow.onEditor(fn)` | Calls `fn(script)` for each script that opens, and for any already open. `fn` can return a cleanup, which runs as the script closes or the extension turns off. |

Every `add` returns a function that takes it away again.

### Tabs

`render(root, context)` runs each time the tab is shown, to fill `root`, and can return a function that runs as it's hidden. `context` has:

- `script`: the `<flow-script>` element
- `lines()`: the script's source lines
- `edit(lines)`: replaces them, as one undo step
- `show(line, tab)`: opens a source line in `'write'` or `'read'`

A tab's place in the address is `?tab=<extension id>-<tab id>`, so a reload stays on it. Undo, redo and the view menus hide while it's showing, and the page scale applies to its text through `font-size`.

```js
flow.addTab({
  id: 'stats',
  label: 'Stats',
  icon: 'info',
  render(root, { lines }) {
    const words = lines().join(' ').split(/\s+/).filter(Boolean).length;
    root.textContent = `${words} words`;
  },
});
```

### Sources

A source follows the provider interface at the top of `packages/pwa/src/providers/index.js`: `id`, `label`, `description`, `status()`, `open()`, `save(doc, options)`, `saveAs(doc)`, `saveHint()` and `location(doc)`.

### Bubbles

Bubbles go along the bottom of the editor through `script.addBubble`, usually from `flow.onEditor`:

```js
flow.onEditor((script) => {
  const node = document.createElement('span');
  node.textContent = 'Hello';
  return script.addBubble({ node, side: 'end', label: 'Hello', tabs: ['write'] });
});
```

| Option | What it is |
| --- | --- |
| `node` | What the bubble holds |
| `side` | `'start'`, after the editor's own pills on the left, or `'end'`, on the right just before undo and redo |
| `label` | Its accessible name |
| `tabs` | The tabs it shows in, such as `['write']`; every tab when left out |
| `css` | Styles for it. The bubble is inside the editor's shadow root, where the page's styles don't reach. The theme's `--flow-*` colors do. |

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

## A worked example: Vim lite

Vim lite, built into Flow, is written only against this API. Its folder, `packages/pwa/src/extensions/vim-lite/`, has its manifest with four settings, `index.js`, which uses `flow.onEditor` to give each script a bubble beside undo and redo and a key handler, and `vim.js`, the engine, which edits only through `text`.
