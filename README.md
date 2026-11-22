# flow

Write Fountain-based screenplays. Formatting appears as you type, and the file stays plain [Fountain](https://fountain.io/syntax) text.

The project has three planned levels, each built on the one before it:

| Level | Status |
| --- | --- |
| Standalone web component, `<flow-script>` | Built (`packages/element`) |
| Installable offline PWA | Built (`packages/pwa`) |
| Google Drive | Shelved, with the work kept on the `feat/google-drive-folders` branch |

## Getting started

```sh
npm install
npm run dev        # component demo with the sample script
npm run dev:pwa    # the PWA
npm test           # parser, layout, conversion and PDF unit tests
npm run test:e2e   # builds, then drives the component in Microsoft Edge
npm run build      # writes packages/element/dist
npm run build:pwa  # writes packages/pwa/dist
```

## Using the component

```html
<script type="module" src="flow-script.bundle.js"></script>

<flow-script theme="sage-dark">
  <script type="text/fountain">
    INT. HOUSE - DAY

    She *runs*.
  </script>
</flow-script>
```

The build produces two forms:

- `flow-script.bundle.js` is one self-contained file (about 400 KB gzipped).
- `flow-script.js` plus its chunks loads Tiptap and pdf-lib only when needed. Read-only pages need about 21 KB of code, plus 82 KB for the font.

### Attributes

| Attribute | Values | Default |
| --- | --- | --- |
| `readonly` | present or absent. Renders without Tiptap. | absent |
| `view` | How the Write tab shows the script: `flow` (Seamless, continuous), `page` (standard script pages) or `source` (the Fountain text itself, with nothing hidden or formatted, and still editable). Read-only mode shows pages unless it's set. | `flow` |
| `read-view` | How the Read tab shows the script: `page` (the pages as they print) or `flow` (Seamless, continuous). Also the `readView` property. | `page` |
| `workspace` | `write` (the script), `outline` (its acts, sequences, scenes and transitions as cards and blocks, which edit the same text), `read` (the pages as they print, with editing off), or the id of a tab added with `addWorkspace()` | `write` |
| `scale` | How large the script is shown, as a percentage from 50 to 200 | `100` |
| `text-width` | `wide` runs Seamless and Fountain views across most of the window on a large screen; absent keeps their usual column. A switch beside the view menu, in Write and Read alike, showing `><` or `<>` for the width it's at, changes it and fires `flow-text-width`. Also the `textWidth` property. | absent |
| `theme` | `sage`, `sand`, `sea`, `romance`, `forest`, `lavender` or `graphite` followed by `-light`, `-dark` or `-auto`; plain `auto`, which means `sage-auto`; or a registered name | `sage-light` |
| `paper` | `letter`, `a4` or a custom size such as `6in x 9in`. The size for a script whose own settings name none. | `letter` |

### Properties and methods

| Member | Purpose |
| --- | --- |
| `value` | Get or set the script as Fountain text |
| `outline` | Tree of sections, scenes and synopses |
| `pageCount` | Script pages at the current print options |
| `printOptions` | Paper, title page, scene numbers, bold or underlined headings, double spacing, page numbers, `sceneContinued`, and the `more`, `contd`, `continuedTop` and `continuedBottom` text |
| `exportPdf(options)` | Resolves to `{ blob, bytes, pageCount, unsupported }`. The page size is the script's own unless `paperOverride` names another. |
| `downloadPdf(options)` | Same, and saves the file |
| `scrollToLine(line)` | Jumps to a source line |
| `highlights` | The Read tab's highlights, as `[{ terms, color, enabled }]`. `terms` are comma-separated words matched whole and without regard to case, and `color` is a hex color. The element keeps no storage, so an app saves them from `flow-highlights`. |
| `menuItems` | What the Document menu holds, as groups kept apart by rules. Items are `{ label, icon, shortcut, title, attrs, onClick }`, or have `panel: { title, build(menu) }` in place of `onClick` to swap the menu for a card of their own, from the nodes `build` returns. The strings `'pdf'` and `'project-settings'` place the element's own Export to PDF and Project settings. Defaults to `[['pdf'], ['project-settings']]`. |
| `closeMenu()` | Closes the Document menu if it's open |
| `insertText(text)` | Types text at the cursor in Write, replacing any selection, as pasting would. Returns `false` in other tabs, which have no cursor. |
| `addWidget({ place, node, label, icon, onClick, tabs, css })` | Adds a widget, a pill of the app's own in the bars: `place` is `'bottom-start'`, after the element's own pills along the bottom (the default), `'bottom-end'`, just before undo and redo, or `'top-end'`, the top right corner. It holds `node`, or, with `onClick`, a button named `label` with `icon`. `tabs` limits it to some workspaces, and `css` styles it inside the shadow root. Returns a function that takes it away. |
| `addWorkspace({ id, render })` | Adds a tab of the app's own, shown when `workspace` is `id`. `render(root, { script, lines, edit, show })` fills it each time it shows and may return a cleanup. The app adds the tab to its own tabs. Returns a function that takes it away. |
| `addEditorKeys(handler)` | Lets an app see keys before the editor: `{ keydown(event, text), input(typed, text), attach(text), detach() }`. `text` edits the script as `{ line, ch }` places; [the apps guide](docs/extensions/apps.md#keys) lists it. Returns a function that takes it away. |

### Events

| Event | `detail` |
| --- | --- |
| `flow-change` | `{ value, outline }`. Fires for user edits, not for setting `value`. |
| `flow-selection` | Current line type and active B/I/U |
| `flow-ready` | None. Fires when a render or editor mount finishes. |
| `flow-scale` | `{ scale }`. Fires when the writer changes the page scale. |
| `flow-text-width` | `{ textWidth }`, `'wide'` or `null`. Fires when the writer widens or narrows the text. |
| `flow-workspace` | `{ workspace }`. Fires when the element changes tab itself, as when the outline's menu shows a card in Write or Read, so an app's own tabs can follow. Not fired for setting `workspace`. |
| `flow-highlights` | `{ highlights }`. Fires when the writer changes highlights in the Highlight Manager or turns one off or on, not for setting `highlights`. |

### Slots

The editor has a top row, the action center that joins it when there is room, and a row of pills along the bottom, all floating over the script. The action center holds the current tab's commands: formatting in Write, and Act, Sequence and Synopsis in Outline. Read has none. Folded away, it shrinks to its toggle. When the action center has a row of its own, the toggle stays at the start of that row but floats over the page, which moves up by the whole row. Apps add their own controls with named slots, and read-only mode shows none of them.

| Slot | Where it goes |
| --- | --- |
| `document` | Inside the Document menu's pill, at the left of the top row, after the menu icon. Empty, the pill reads "Document". |
| `tabs` | Top row, after `document` |
| `status-end` | Right end of the bottom row |

### Shared controls

The pills, buttons, menus, tabs, search field, modals, the settings panel, the paper size picker, the page size setting and the theme chooser are exported so that an app's own controls match the editor's. Call `installControlStyles()` once to use them outside the element, which also adds the theme colors for `<html data-theme="...">`.

```js
import { actionPill, addPalette, button, dimensionsField, installControlStyles, Menu, openModal, openSettingsPanel, pill, pillSep, removePalette, searchField, tabs, themeChooser, toggleSwitch } from '@flow/element/source';
```

`openSettingsPanel(parent, { title, icon, sections, actions, onClose })` lays settings out the same way everywhere: a search box floating above the panel, a rail of section icons down its left when there's more than one section, each section with a button that folds or unfolds all its topics, and topics that fold on their own. Sections are `{ id, label, icon, topics }`, topics `{ label, open, properties }`, and properties `{ label, description, control, below, wide, keywords }`. A property's control sits beside its name, or under it when `wide`, and `below` runs the full width beneath, such as a preview. The search sits at the top of the panel, and each section is a page of its own that the rail turns to. Searching looks through every section, matching names, descriptions and keywords, and shows matching topics open. The string `'divider'` between sections draws a rule across the rail, `hidden: true` keeps a section out of the rail and searches, and `start` names the section to open on. The panel it returns has `show(id)`, which turns to any section, hidden or not, and `setHidden(id, hidden)`.

`pageSizeSetting({ label, value, description, onChange })` is a page size as a settings property: the picker, with a drawing of the sheet under it that follows each choice. It returns `{ property, value }`.

`themeChooser({ value, onChange })` is the Auto, Light and Dark switch and the palette grid, for `{ palette, mode }`. It returns `{ root, modes, grid }`, so the parts can also go into a settings panel separately. The modes are `tabs({ fixed: true })`, the same tabs as Write, Outline and Read, kept as a pill at any width.

`icon(name)` draws one of Flow's icons by name, or `{ paths }`, SVG path data on a 24 by 24 grid, set as data so it can only draw shapes. `tabs({ fit: true })` measures whether its labels fit the room they have and shows a dropdown when they don't, switching back when there's room again; the theme's Auto, Light and Dark use it. `toggleSwitch({ label, checked, onChange })` is an on/off switch, a checkbox drawn as a sliding switch. `addPalette(name, { label, light, dark })` adds a palette while the app runs, to the theme chooser and as `name-light`, `name-dark` and `name-auto`, with colors left out taken from Sage; `removePalette(name)` takes it away.

`searchField({ label, cls, onInput })` is a search box in a pill with its icon at the right, returning `{ root, input }`. `iconSwitch({ label, states, onChange })` is a switch drawn as an icon button whose icon and tooltip show its current state, as the width switch does.

## Writing

Syntax markers such as `**`, `.` or `@` show only on the line you're on. Everywhere else you see just the formatted result. The formatting row writes the same Fountain syntax you could type yourself, adding blank lines or force markers only when a line needs them to parse as the chosen type.

- **Comments.** `[[notes]]` appear as comment bubbles. In the editor, clicking one opens it for editing. In read-only mode it expands in place.
- **Boneyard.** `/* cut text */` is separate from comments. In the editor it stays readable in place, dimmed and struck through. It never appears in read-only pages or PDFs. The strikethrough S button cuts the selection, or the current line, and restores it when pressed again.
- **Outlining.** `#` and `##` sections and `= synopses` are visible while editing but never appear in read-only pages or PDFs, and they take no page space. They're available through `outline` for future navigation features.
- **Outline tab.** Plan a script as cards, in order with its scenes and transitions. A scene and a transition next to each other share a card, and two of the same kind don't. Each scene shows its number, which is the one thing about it you can edit here. The action center's Act, Sequence and Synopsis add a `#`, `##` or `=` line. Pointing at one draws a line where it would add its card. Click to add it there, or drag it to where it should go. With nothing selected, it goes at the end of the script. A new act or sequence starts at the selected card when that card could belong to it, taking in that card and what follows up to the next header of its level: with sequences A to G and C selected, a new act holds C through G. Otherwise a new card goes below the selected one. A card is selected by clicking or focusing it, and clicking between cards or pressing Escape clears that. Drag a card by its handle, or use the arrow keys on the handle, to move it with all the script text it holds. Scenes and transitions can be moved here but only edited or deleted in the script. The outline follows the file: synopses and sequences can sit above the first act, and anything below an act is part of it. Every synopsis shows, wherever it is. Removing an act takes it and its sequences out of the script, and leaves its scenes, dialogue and synopses to the card above. Right-clicking a card, anywhere but its text boxes, offers Show in Write and Show in Read, which open that part of the script at the top of the page, with the cursor at its start in Write. Undo works across the tabs.
- **Read tab.** The script with editing off, as Paged (the pages as they print, the default) or Seamless, chosen from its own view menu whichever view Write is in.
- **Keeping your place.** Moving between tabs or views keeps the same part of the script at the top of the page, and the Outline shows the card it belongs to. Back in Write, a cursor left out of sight moves to where you are, so typing carries on there.
- **Opening files.** Installed on a desktop with Chrome or Edge, the app opens `.fountain` and `.spmd` files from the file manager, in the window that's already open. A file already in the recent list reopens there, refreshed from disk unless it has unsaved changes. Android doesn't support this yet.
- **Tabs in the app.** The address records the tab as `#/edit/<id>?tab=outline` or `?tab=read`, so a reload stays on it.
- **Document menu.** The pill at the left of the top row opens a card of commands below it: in the app, Home, Save, Save as, Export to PDF, Theme, Project settings and App settings. Theme swaps the menu for a card of its own, which rises from behind it, with a back button, and Escape or the left arrow steps back. On a phone the menu flies out from the left and covers most of the screen.
- **Project settings.** Project settings in the Document menu opens them. Dimensions is US Letter, A4 or Custom, a width and height in inches, centimetres or millimetres. The page shows each choice as it's made, with a drawing of the sheet and its measurements in the dialog, and Save writes it into the script, in a boneyard at the bottom of its title page, or at the top of a script without one:

  ```
  Title: Big Fish
  /*
  Settings:
      Dimensions: 21cm x 29.7cm
  */
  ```

  Flow reads the first boneyard that opens with `Settings:`, wherever it is. Being a boneyard, it never prints, in Flow or any other Fountain app, and only Fountain view shows it. Typed by hand, `6" x 9"`, `6in x 9in` and `150 x 230 mm` all work. Custom pages are 7.5 to 17 inches wide, so the script's columns fit, and 6 to 17 inches tall. The PDF export's Paper starts at Default, the script's own size, and choosing another changes only that export.
- **Title page.** After a key with nothing beside it, such as `Contact:`, Enter indents the next line and keeps doing so down its values. A second Enter on an empty one stops. A value on the same line as its key gets an ordinary new line. Values can be indented with a tab or two or more spaces, as long as all of a key's values match, and the key shows from any of them. The indent is out of sight in Seamless and Paged views, where the arrow keys and Backspace behave as if it weren't there, and it's on show in Fountain view.

Paged view numbers every page, including page 1. The Read tab and PDFs follow the screenplay standard and leave page 1 unnumbered.

## Theming

Three ways to theme, which can be combined:

```css
/* 1. Override any color from your own CSS */
flow-script { --flow-paper: #fff; --flow-ink: #111; }
```

```js
// 2. Register a named theme. Colors you leave out fall back to sage light.
import { registerTheme } from './flow-script.js';
registerTheme('sepia', { paper: '#f4ecd8', ink: '#3b2f1e' });
```

```html
<!-- 3. Select a theme by name -->
<flow-script theme="sepia"></flow-script>
```

Colors: `desk`, `paper`, `ink`, `muted`, `accent`, `accent-ink`, `secondary`, `secondary-ink`, `success`, `warning`, `danger`, `rule`, `ribbon-bg`, `ribbon-ink`, `bubble-bg`, `bubble-ink`, `shadow`.

`accent` is the primary color, and `secondary` complements it. `success`, `warning` and `danger` stay much the same in every palette, shifted only where a palette's own colors would clash with them.

Each component also has its own tokens, which default to those colors. Set them the same ways, as `--flow-<token>` in CSS or by name in `registerTheme`:

| Component | Tokens |
| --- | --- |
| Pills | `pill-bg`, `pill-ink`, `pill-border`, `pill-radius`, `pill-shadow`, `float-shadow`, `pill-tint-bg`, `pill-tint-border` |
| Buttons | `button-radius`, `button-hover-bg`, `button-active-bg`, `button-active-ink`, `focus`, `scrollbar` |
| Tabs | `tabs-bg`, `tabs-border`, `tabs-ink`, `tab-selected-bg`, `tab-selected-ink` |
| Menus | `menu-bg`, `menu-ink`, `menu-border`, `menu-radius`, `menu-heading-bg`, `menu-heading-ink` |
| Modals | `dialog-bg`, `dialog-ink`, `dialog-radius` |
| Fields | `check` (checkboxes, radio buttons, sliders and progress bars), `field-bg`, `field-ink`, `field-border`, `selection-bg` |
| Outline | `drop-line` (where a dragged card lands), `preview-line` (where a tool would add one, `secondary` by default), `danger-hover` (pointing at something that deletes) |
| Pages and desk | `page-shadow` (a hard, offset shadow under every page), `desk-noise` (a faint grain), `desk-gradient` (a soft wash of the theme's colors). Set either desk token to `none` to leave it out. The `fl-desk` class gives an app's own page the same desk, and `fl-paper` gives a sheet on it the pages' paper and shadow. |

 Use `--flow-font` to change the script typeface; anything but a 0.6em-wide monospace font will throw off page alignment. Use `--flow-ui-font` to change the interface font, which defaults to the bundled Roboto. PDFs are always black on white.

## Architecture

- **`packages/core`** has no DOM or Tiptap dependency: the parser, layout engine, ribbon text edits and PDF writer. A new front end, such as the Drive plugin, can reuse all of it.
- **`packages/element`** is the web component. It takes text in and emits text out, and has no storage of its own, so each later level supplies its own persistence.

Two decisions shape the code:

1. **The text is the document.** Each editor line holds raw Fountain, and all formatting is ProseMirror decoration derived from the parser. Files round-trip byte for byte, apart from line endings, which normalize to `\n`.
2. **One layout engine.** Read-only pages and PDFs draw the same `layout()` output, and the editor uses it to place page breaks. Metrics follow [afterwriting](https://afterwriting.com/)'s print profiles.

## The PWA

The home page is a shelf of sheets: New, Open, then each recent script drawn as its own title page, wrapping onto as many rows as they need, two to a row on a phone. The search box above filters the recent scripts by name and title page, and the gear opens App settings: Appearance (the theme, and which extensions' settings get a tab), Defaults, Sources, Extensions and App (installing Flow). New scripts begin with a title page containing every field Flow prints, to keep or delete. Defaults changes that for this device: the page size new scripts start at, and the text of each standard title page field after Title, each with a switch to leave it off. `{date}` and `{year}` fill in when a script is made, and empty fields are left off too. Core's `newScript(today, { cover, dimensions })` builds the text. With one place to open from, Open goes straight to its picker; with several, it asks which.

Scripts autosave to IndexedDB on the device, so work survives closing the tab or losing the connection. The recent scripts are that local copy. **Save** writes to the file, and won't overwrite a file that changed elsewhere without asking. After the first visit, the whole app works offline, including PDF export.

Every script shows where it lives, its source, in the document pill and on its cover on the home page:

| Source | Meaning |
| --- | --- |
| **Temp** | Not in a file yet: only in this browser's storage, on this device |
| **Local** | A file on this device |
| **Cloud** | A cloud service, with its name, such as **Cloud · Proton Drive** |

App settings has a **Sources** page listing them, with **Connect** and **Disconnect** for cloud sources that need signing in. Open and the first Save say whether each choice is local or cloud. Storage options live in `packages/pwa/src/providers/`, as providers with the interface described in `providers/index.js`. Cloud sources come from extensions, through `flow.addSource`; [the sources guide](docs/extensions/sources.md) shows how to add one.

| Provider | Opening | Saving |
| --- | --- | --- |
| This device, Chromium browsers | File picker | OS save dialog, opened in the file's folder with its name filled in |
| This device, other browsers, including iOS | File picker | Downloads a copy, because these browsers can't choose a folder |
| Proton Drive, an extension | File picker, in the Proton Drive app's synced folder | Into that folder, which the Proton Drive app syncs |

### Extensions

Extensions add to Flow on this device. Each is a JSON manifest, with code for most apps. **Themes** add palettes to the theme chooser. **Apps** can add settings, commands in the Document menu with keyboard shortcuts, widgets in the editor's bars (along the bottom on either side, and in the top right corner), tabs beside Write, Outline and Read, and cloud sources. An extension someone adds starts turned on; those built into Flow start off. Each shows its own icon, or a jigsaw piece.

App settings has an **Extensions** page listing apps and then themes, each with a switch, a **Settings** button for an app with settings, and **Remove** for one added from files. **Add extension** opens the file picker for a manifest `.json` and any `.js` files with it, which Flow checks before adding: theme colors have to be colors, icons only path data, ids can't clash, and anything wrong is explained under the button. Each app with settings that's on also gets a page after a rule at the bottom of the rail, which **Appearance**, under **Settings tabs**, can take out of the rail.

**Code asks first.** An app's code runs inside Flow with everything Flow can do, so whenever files bring code, Flow shows **Do you trust this extension?**, naming it, its author and its files, before adding it, and again for every update. Cancel is the default. The code is kept in IndexedDB and loaded as modules when the extension is turned on; files import each other as `./name.js`. Code running on the page can also register an extension with `window.flowExtensions.register(manifest, activate)`.

Three extensions are built in:

- **Vim lite** gives the editor a small set of Vim's keys. Normal, Insert, Visual and Visual line modes; the motions `h j k l w b e W B E 0 ^ $ gg G f F t T`, with counts; the operators `d c y` over any of them, and doubled for whole lines; and `i a I A o O x X s S D C Y p P u J r ~`, Ctrl+R to redo, and Escape or Ctrl+[ to leave a mode. A count before `i a I A o O` types what's typed that many times on leaving Insert, so `3ihey` then Escape gives `heyheyhey`. `/` and `?` search forward and back for words, ignoring case unless the search has a capital; `n` and `N` find the next and previous, coming round from the other end, and `*` and `#` find the word under the cursor. A widget just before undo and redo shows the mode, the keys of the command being typed, and what the last one did: while a search is typed the mode reads Search, with how many matches there are, and after it, which match it's on, such as Match 3 of 7. Tapping its mode switches between Normal and Insert, for screens with no Escape key. Its settings choose the mode a script opens in, a two-key chord such as `jk` that works like Escape, the block cursor and the widget. It's written only against the extension API, in `packages/pwa/src/extensions/vim-lite/`.
- **Proton Drive** is a cloud source. Proton has no sign-in for apps like Flow yet, so it works through the folder the Proton Drive desktop app syncs: **Connect** on the Sources page chooses that folder, and scripts open from it and save into it, while files outside it are turned away. It needs Chrome or Edge on a computer.
- **Typewriter** is a theme: black ink and a red ribbon on warm paper, with a charcoal dark version.

**Writing one:** [the themes guide](docs/extensions/themes.md) covers palettes and their colors, [the apps guide](docs/extensions/apps.md) covers the manifest, icons, settings, commands, code and the API for tabs, widgets and keys, and [the sources guide](docs/extensions/sources.md) covers adding a cloud source.

### Deploying to GitHub Pages

Pushing to `main` runs the tests, then builds and publishes to the `gh-pages` branch, which GitHub Pages serves. Other branches and pull requests only run the tests. Pages must stay set to **Deploy from a branch: `gh-pages`**, which is the current setting.

The site then lives at `https://<owner>.github.io/<repo>/`. Builds use relative paths, so nothing depends on the repository's name.

## Known limitations

- **Editor page breaks are approximate within a line.** They fall between source lines, so a paragraph or speech split across pages shows the break before the line, without `(MORE)`/`(CONT'D)`. Comments, sections and synopses also add visible height in the editor only, and they stay with the page they introduce. Read-only view and PDF are exact.
- **PDFs cover Western and some Central European characters.** Text uses the embedded Courier Prime, then the Courier built into PDF readers for accents it lacks. Anything else prints as `?`, and a pill along the bottom reports which characters were affected. Other alphabets will need another font.
- **Long scripts cost more per keystroke:** about 2.5 ms on a short script and 85 ms at 113 pages on a desktop. This needs work before the PWA targets phones.
- **Browser coverage:** automated tests run in Chromium-based browsers only. Firefox and Safari are untested.
