# flow

Write Fountain-based screenplays. Formatting appears as you type, and the file stays plain [Fountain](https://fountain.io/syntax) text.

The project has three planned levels, each built on the one before it:

| Level | Status |
| --- | --- |
| Standalone web component, `<flow-script>` | Built (`packages/element`) |
| Installable offline PWA | Built (`packages/pwa`) |
| Google Drive | Built into the PWA, needs Google credentials to switch on |

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

<flow-script theme="amber-dark">
  <script type="text/fountain">
    INT. HOUSE - DAY

    She *runs*.
  </script>
</flow-script>
```

The build produces two forms:

- `flow-script.bundle.js` is one self-contained file (about 400 KB gzipped).
- `flow-script.js` plus its chunks loads Tiptap and pdf-lib only when needed. Read-only pages need about 14 KB of code, plus 82 KB for the font.

### Attributes

| Attribute | Values | Default |
| --- | --- | --- |
| `readonly` | present or absent. Renders without Tiptap. | absent |
| `view` | `page` (standard script pages) or `flow` (continuous) | `page` |
| `theme` | `amber-light`, `amber-dark`, `auto`, or a registered name | `amber-light` |
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

### Events

| Event | `detail` |
| --- | --- |
| `flow-change` | `{ value, outline }`. Fires for user edits, not for setting `value`. |
| `flow-selection` | Current line type and active B/I/U |
| `flow-ready` | None. Fires when a render or editor mount finishes. |

## Writing

Syntax markers such as `**`, `.` or `@` show only on the line you're on. Everywhere else you see just the formatted result. The ribbon writes the same Fountain syntax you could type yourself, adding blank lines or force markers only when a line needs them to parse as the chosen type.

- **Comments.** `[[notes]]` appear as bubbles. In the editor, clicking one opens it for editing. In read-only mode it expands in place.
- **Boneyard.** `/* cut text */` is separate from comments. In the editor it stays readable in place, dimmed and struck through. It never appears in read-only pages or PDFs. The ribbon's Boneyard button cuts the selection, or the current line, and restores it when pressed again.
- **Outlining.** `#` and `##` sections and `= synopses` are visible while editing but never appear in read-only pages or PDFs, and they take no page space. They're available through `outline` for future navigation features.

## Theming

Three ways to theme, which can be combined:

```css
/* 1. Override any color from your own CSS */
flow-script { --flow-paper: #fff; --flow-ink: #111; }
```

```js
// 2. Register a named theme. Colors you leave out fall back to amber light.
import { registerTheme } from './flow-script.js';
registerTheme('sepia', { paper: '#f4ecd8', ink: '#3b2f1e' });
```

```html
<!-- 3. Select a theme by name -->
<flow-script theme="sepia"></flow-script>
```

Colors: `desk`, `paper`, `ink`, `muted`, `accent`, `accent-ink`, `rule`, `ribbon-bg`, `ribbon-ink`, `bubble-bg`, `bubble-ink`, `shadow`. Use `--flow-font` to change the script typeface; anything but a 0.6em-wide monospace font will throw off page alignment. PDFs are always black on white.

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
| Google Drive | Google's picker | Directly back to the file |

### Deploying to GitHub Pages

Pushing to `main` runs the tests, then builds and deploys. Other branches and pull requests only run the tests. It needs one setting, once: **Settings > Pages > Build and deployment > Source: GitHub Actions**. Without it, the deploy step fails with a 404.

The site then lives at `https://<owner>.github.io/<repo>/`. Builds use relative paths, so nothing depends on the repository's name.

### Turning on Google Drive

Without credentials, the Google Drive card says "Needs setup". To switch it on:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project and enable the **Google Drive API** and the **Google Picker API**.
2. Configure the OAuth consent screen, and add the `.../auth/drive.file` scope. This narrow scope only reaches files people pick in Flow or create with it.
3. Create an **OAuth client ID** of type "Web application", with your site's origin as an authorized JavaScript origin, such as `https://<owner>.github.io` and `http://localhost:5173`.
4. Create an **API key**, restricted to the Picker API and your site.
5. Add these as repository variables under **Settings > Secrets and variables > Actions > Variables**. They're public identifiers that ship in the page, not secrets.

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | The OAuth client ID |
| `GOOGLE_API_KEY` | The API key |
| `GOOGLE_APP_ID` | The project number, shown on the project's dashboard |

For local development, put the same values in `packages/pwa/.env.local` with a `VITE_` prefix, such as `VITE_GOOGLE_CLIENT_ID`.

## Known limitations

- **Editor page breaks are approximate within a line.** They fall between source lines, so a paragraph or speech split across pages shows the break before the line, without `(MORE)`/`(CONT'D)`. Comments, sections and synopses also add visible height in the editor only, and they stay with the page they introduce. Read-only view and PDF are exact.
- **PDFs use the built-in Courier,** which covers Western European characters only. Anything else prints as `?`, and the ribbon reports which characters were affected. Non-Latin scripts will need an embedded font.
- **Long scripts cost more per keystroke:** about 2.5 ms on a short script and 85 ms at 113 pages on a desktop. This needs work before the PWA targets phones.
- **Browser coverage:** automated tests run in Chromium-based browsers only. Firefox and Safari are untested.
- **Google Drive is tested against stand-ins:** Flow's own requests and handling are tested, but with fakes for Google's scripts and servers. It needs a real run once credentials exist.
