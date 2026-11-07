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
| `workspace` | `write` (the script), `outline` (its acts, sequences, scenes and transitions as cards and blocks, which edit the same text) or `read` (the pages as they print, with editing off) | `write` |
| `scale` | How large the script is shown, as a percentage from 50 to 200 | `100` |
| `theme` | `sage`, `sand`, `sea`, `romance`, `forest`, `lavender` or `graphite` followed by `-light`, `-dark` or `-auto`; plain `auto`, which means `sage-auto`; or a registered name | `sage-light` |
| `paper` | `letter` or `a4` | `letter` |

### Properties and methods

| Member | Purpose |
| --- | --- |
| `value` | Get or set the script as Fountain text |
| `outline` | Tree of sections, scenes and synopses |
| `pageCount` | Script pages at the current print options |
| `printOptions` | Paper, title page, scene numbers, bold or underlined headings, double spacing, page numbers, `sceneContinued`, and the `more`, `contd`, `continuedTop` and `continuedBottom` text |
| `exportPdf(options)` | Resolves to `{ blob, bytes, pageCount, unsupported }` |
| `downloadPdf(options)` | Same, and saves the file |
| `scrollToLine(line)` | Jumps to a source line |
| `exportActions` | The app's own actions, shown before PDF as `{ label, title, icon, attrs, onClick }`. They appear as icon buttons, or in a vertical ... menu when space runs short. |

### Events

| Event | `detail` |
| --- | --- |
| `flow-change` | `{ value, outline }`. Fires for user edits, not for setting `value`. |
| `flow-selection` | Current line type and active B/I/U |
| `flow-ready` | None. Fires when a render or editor mount finishes. |
| `flow-scale` | `{ scale }`. Fires when the writer changes the page scale. |

### Slots

The editor has a top row, the action center that joins it when there is room, and a row of pills along the bottom, all floating over the script. The action center holds the current tab's commands: formatting in Write, and Act, Sequence and Synopsis in Outline. Read has none. Folded away, it shrinks to its toggle. When the action center has a row of its own, the toggle stays at the start of that row but floats over the page, which moves up by the whole row. Apps add their own controls with named slots, and read-only mode shows none of them.

| Slot | Where it goes |
| --- | --- |
| `document` | Top row, left |
| `tabs` | Top row, after `document` |
| `status-end` | Right end of the bottom row |

### Shared controls

The pills, buttons, menus, tabs and modals are exported so that an app's own controls match the editor's. Call `installControlStyles()` once to use them outside the element, which also adds the theme colors for `<html data-theme="...">`.

```js
import { actionPill, button, installControlStyles, Menu, openModal, pill, pillSep, tabs } from '@flow/element/source';
```

## Writing

Syntax markers such as `**`, `.` or `@` show only on the line you're on. Everywhere else you see just the formatted result. The formatting row writes the same Fountain syntax you could type yourself, adding blank lines or force markers only when a line needs them to parse as the chosen type.

- **Comments.** `[[notes]]` appear as bubbles. In the editor, clicking one opens it for editing. In read-only mode it expands in place.
- **Boneyard.** `/* cut text */` is separate from comments. In the editor it stays readable in place, dimmed and struck through. It never appears in read-only pages or PDFs. The strikethrough S button cuts the selection, or the current line, and restores it when pressed again.
- **Outlining.** `#` and `##` sections and `= synopses` are visible while editing but never appear in read-only pages or PDFs, and they take no page space. They're available through `outline` for future navigation features.
- **Outline tab.** Plan a script as cards, in order with its scenes and transitions. A scene and a transition next to each other share a card, and two of the same kind don't. Each scene shows its number, which is the one thing about it you can edit here. The action center's Act, Sequence and Synopsis add a `#`, `##` or `=` line. Pointing at one draws a line where it would add its card. Click to add it there, or drag it to where it should go. With nothing selected, it goes at the end of the script. A new act or sequence starts at the selected card when that card could belong to it, taking in that card and what follows up to the next header of its level: with sequences A to G and C selected, a new act holds C through G. Otherwise a new card goes below the selected one. A card is selected by clicking or focusing it, and clicking between cards or pressing Escape clears that. Drag a card by its handle, or use the arrow keys on the handle, to move it with all the script text it holds. Scenes and transitions can be moved here but only edited or deleted in the script. The outline follows the file: synopses and sequences can sit above the first act, and anything below an act is part of it. Every synopsis shows, wherever it is. Removing an act takes it and its sequences out of the script, and leaves its scenes, dialogue and synopses to the card above. Undo works across the tabs.
- **Read tab.** The script with editing off, as Paged (the pages as they print, the default) or Seamless, chosen from its own view menu whichever view Write is in.
- **Opening files.** Installed on a desktop with Chrome or Edge, the app opens `.fountain` and `.spmd` files from the file manager, in the window that's already open. A file already in the recent list reopens there, refreshed from disk unless it has unsaved changes. Android doesn't support this yet.
- **Tabs in the app.** The address records the tab as `#/edit/<id>?tab=outline` or `?tab=read`, so a reload stays on it.
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

 Use `--flow-font` to change the script typeface; anything but a 0.6em-wide monospace font will throw off page alignment. Use `--flow-ui-font` to change the interface font, which defaults to the bundled Roboto. PDFs are always black on white.

## Architecture

- **`packages/core`** has no DOM or Tiptap dependency: the parser, layout engine, ribbon text edits and PDF writer. A new front end, such as the Drive plugin, can reuse all of it.
- **`packages/element`** is the web component. It takes text in and emits text out, and has no storage of its own, so each later level supplies its own persistence.

Two decisions shape the code:

1. **The text is the document.** Each editor line holds raw Fountain, and all formatting is ProseMirror decoration derived from the parser. Files round-trip byte for byte, apart from line endings, which normalize to `\n`.
2. **One layout engine.** Read-only pages and PDFs draw the same `layout()` output, and the editor uses it to place page breaks. Metrics follow [afterwriting](https://afterwriting.com/)'s print profiles.

## The PWA

The home page starts a new script or opens one from a provider. New scripts begin with a title page containing every field Flow prints, to keep or delete.

Scripts autosave to IndexedDB on the device, so work survives closing the tab or losing the connection. The Recent list is that local copy. **Save** writes to the file, and won't overwrite a file that changed elsewhere without asking. After the first visit, the whole app works offline, including PDF export.

Storage options live in `packages/pwa/src/providers/`. To add one, write an object with the interface described in `providers/index.js` and add it to the list.

| Provider | Opening | Saving |
| --- | --- | --- |
| This device, Chromium browsers | File picker | OS save dialog, opened in the file's folder with its name filled in |
| This device, other browsers, including iOS | File picker | Downloads a copy, because these browsers can't choose a folder |

### Deploying to GitHub Pages

Pushing to `main` runs the tests, then builds and publishes to the `gh-pages` branch, which GitHub Pages serves. Other branches and pull requests only run the tests. Pages must stay set to **Deploy from a branch: `gh-pages`**, which is the current setting.

The site then lives at `https://<owner>.github.io/<repo>/`. Builds use relative paths, so nothing depends on the repository's name.

## Known limitations

- **Editor page breaks are approximate within a line.** They fall between source lines, so a paragraph or speech split across pages shows the break before the line, without `(MORE)`/`(CONT'D)`. Comments, sections and synopses also add visible height in the editor only, and they stay with the page they introduce. Read-only view and PDF are exact.
- **PDFs cover Western and some Central European characters.** Text uses the embedded Courier Prime, then the Courier built into PDF readers for accents it lacks. Anything else prints as `?`, and a pill along the bottom reports which characters were affected. Other alphabets will need another font.
- **Long scripts cost more per keystroke:** about 2.5 ms on a short script and 85 ms at 113 pages on a desktop. This needs work before the PWA targets phones.
- **Browser coverage:** automated tests run in Chromium-based browsers only. Firefox and Safari are untested.
