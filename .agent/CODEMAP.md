# Flow code map

For coding agents starting a session. It says where things live and how they connect, so you
can go straight to the right file. The README covers behavior and the public API; read it for
what a feature should do. This file covers where the code is.

**Keep it current.** When you add, rename, split or remove a source file, or move a
responsibility between files, update this map in the same commit.

## Shape of the repo

npm workspaces, plain JavaScript (ES modules, no TypeScript, no framework), built with Vite.

```
packages/core      @flow/core     Pure logic. No DOM, no Tiptap. Parser, layout, text edits, PDF.
packages/element   @flow/element  The <flow-script> web component. Text in, text out, no storage.
packages/pwa       @flow/pwa      The installable app around the element: home, autosave, files.
```

Dependencies only point down: `pwa -> element -> core`, and `pwa -> core` directly.
The PWA imports the element from source (`@flow/element/source`), not from its build.

## Core ideas to hold on to

1. **The text is the document.** Every editor line is one raw Fountain source line. All
   formatting is ProseMirror *decoration* computed from `parse()`. Never store rich text.
   Every feature that changes the script (ribbon, outline, settings) is a pure function in
   core that takes source lines and returns new source lines.
2. **One layout engine.** `layout()` in core feeds the read-only pages, the PDF and the
   editor's page breaks, so all three agree.
3. **Read-only stays small.** `readonly.js` and anything it imports must never import
   Tiptap or pdf-lib. `editor.js` and `@flow/core/pdf` are loaded with dynamic `import()`.
4. **Settings live in the file**, in a `/* Settings: ... */` boneyard (see `settings.js`).

## packages/core/src

| File | What it does | Key exports |
| --- | --- | --- |
| `index.js` | Re-exports everything except PDF | — |
| `parser.js` | Line-oriented Fountain parser. One entry per source line with raw offsets. | `parse`, `scriptTitle`, `SCENE_RE`, `TITLE_INDENT` |
| `inline.js` | Emphasis (`*`, `**`, `***`, `_`, `\`) as runs with offsets | `parseInline` |
| `layout.js` | Parsed script to pages of positioned rows. Wrapping, dialogue, (MORE)/(CONT'D), pagination. | `layout`, `titlePositions`, `wrapRuns`, `COL`, `WIDTH`, `DEFAULT_OPTIONS` |
| `settings.js` | Paper profiles, dimension parsing/formatting, reading/writing the Settings boneyard | `parseDimensions`, `formatDimensions`, `pageProfile`, `resolvePaper`, `writeSetting`, `PROFILES`, `CUSTOM_LIMITS` |
| `convert.js` | Ribbon edits: change a line's type, emphasis, boneyard, dual dialogue, page break, title-page Enter/Backspace | `applyLineType`, `toggleEmphasis`, `emphasisAt`, `toggleBoneyard`, `toggleDual`, `dualAt`, `insertPageBreak`, `continueTitleField`, `joinTitleValue`, `lineTypeKey` |
| `outline.js` | Outline-tab edits: cards from `#`/`##`/scenes/transitions, drop slots, moving blocks, adding/removing acts, sequences, synopses | `outlineCards`, `outlineSlots`, `moveOutlineBlock`, `addOutlineSection`, `addOutlineSynopsis`, `removeOutlineCard`, `setOutlineSceneNumber`, ... |
| `template.js` | New-script title page | `newScript` |
| `pdf.js` | Draws `layout()` output with pdf-lib. Separate entry `@flow/core/pdf`. | `renderPdf` |

### Data shapes

`parse(text)` returns `{ source, lines, comments, titlePage, settingsBlock, settings, outline }`.

- `lines[i]`: `{ index, raw, masked, start, type, prefix, comments, runs, text, name? }`.
  `masked` is `raw` with `[[comments]]` blanked to `\0`. `runs` are styled text spans with
  offsets into `raw`. `name` is set for `character` lines.
- Line `type`s: `blank`, `action`, `scene`, `character`, `dialogue`, `parenthetical`,
  `transition`, `centered`, `lyrics`, `section`, `synopsis`, `comment`, `title`,
  `page-break` (set in `parser.js` `classifyBody` and `parse`). Lines may also carry
  `forced` (a `!`, `@`, `.`, `>` marker), `level` (sections), `sceneNumber`, `inDialogue`.
- `comments`: `{ id, type: 'note' | 'boneyard', start, end, text, lineStart, lineEnd }`.
  Notes are `[[...]]`, boneyards `/* ... */`.
- `titlePage`: entries `{ key, lines: [lineIndex, ...] }`.
- `outline`: a tree from `{ type: 'root' }` of `section` nodes (`level`, `title`, `line`,
  `synopses`, `children`) and `scene` nodes.

`layout(parsed, options)` returns `{ profile, options, pages, pageStarts }`.
Pages are `{ kind: 'title' | 'script', number, showNumber, rows }`; rows carry `y`, `line`
(source index), `type` and runs. Units: columns of 0.1in, rows of 1/6in.

Edit functions in `convert.js` and `outline.js` take an array of source lines (`input`) and
return new lines, plus a cursor where relevant.

## packages/element/src

| File | What it does |
| --- | --- |
| `index.js` | Package entry. Defines `<flow-script>`, exports shared controls, `installControlStyles()` |
| `flow-script.js` | `FlowScript` custom element. Attributes, properties, events, theme and paper, pinch-to-scale, page tracking, switching between Write / Outline / Read, building the bars, PDF export. The hub: start here. |
| `editor.js` | `FlowEditor`, the Tiptap editor (loaded on demand). `Line` node, the `FountainDecorations` plugin (incremental reparse in `updateScript`, decorations in `lineDecorations`/`activeDecorations`, page gaps in `computeGaps`), title-page key handling, ribbon commands (`setLineType`, `emphasis`, `boneyard`, `dual`, `pageBreak`), `commit`/`commitFromOutline` |
| `readonly.js` | Plain-DOM renderer for Read tab and `readonly`: paged (`renderPages`) or seamless (`renderFlow`), comment bubbles. No Tiptap. |
| `outline.js` | Outline tab UI (`createOutline`): cards, drag and keyboard moves, add tools. Every change goes through core `outline.js` and back into the editor. |
| `ribbon.js` | Top row: document/tabs slots, export and settings buttons, plus the action center. Formatting pills that follow the cursor's line. |
| `action-center.js` | Per-tab command rows (`setActions(tab, ...)`), foldable |
| `statusbar.js` | Bottom pills: view menu, scale, page jump, `status-end` slot. `SCALE_MIN/MAX/STEP`. |
| `highlights.js` | Read-tab highlights via the CSS Custom Highlight API: painter, toolbar dots, Highlight Manager dialog, color popover (vanilla-colorful) |
| `export-dialog.js` | PDF export options modal |
| `settings-dialog.js` | Project settings modal (page dimensions), previews live, Save writes the boneyard |
| `dimensions-field.js` | Paper size picker shared by both dialogs |
| `page-preview.js` | Small drawing of the sheet with measurements |
| `controls.js` | Shared UI kit: `button`, `pill`, `pillSep`, `foldingPill`, `tabs`, `actionPill`, `Menu`, `openModal`, `icon`, `CONTROL_TOKENS`, `CONTROLS_CSS`, `token()` |
| `themes.js` | `PALETTES` (sage, sand, sea, romance, forest, lavender, graphite x light/dark), `registerTheme`, `THEME_CSS` (`:host`), `PAGE_THEME_CSS` (`:root[data-theme]`) |
| `styles.js` | The shadow-root stylesheet `STYLES`, page geometry in em |
| `fonts.js` / `pdf-fonts.js` | Courier Prime and Roboto inlined; WOFF2 on screen, WOFF for PDF |

Other folders: `demo/` (dev page with `sample.fountain`, opened by `npm run dev`),
`e2e/` (Playwright specs plus `readonly.html` and `blank.html` fixtures).

### How an edit flows

1. User types, or a ribbon/outline action runs a core edit function.
2. `FlowEditor` applies it as a transaction; `FountainDecorations` reparses touched lines and
   recomputes decorations and page gaps.
3. `onChange` in `FlowScript.#renderEditor` updates `#value`, reapplies paper if the Settings
   block changed, redraws the outline if visible, and fires `flow-change`.
4. `onState` updates the ribbon and statusbar and fires `flow-selection`.

### Events fired by `<flow-script>`

`flow-change`, `flow-selection`, `flow-ready`, `flow-scale`, `flow-highlights`
(`{ highlights }`, used by the PWA to persist them; not yet in the README).

## packages/pwa/src

| File | What it does |
| --- | --- |
| `main.js` | Boot: styles, theme, fonts, hash router (`#/edit/<id>` or home), `launchQueue` file opening, service-worker update banner |
| `home.js` | Home page: new script, provider cards, Recent list |
| `editor-view.js` | Hosts `<flow-script>` for one doc: fills slots (Document pill, tabs, Appearance), `exportActions` (Save/Save as), autosave on `flow-change`, highlights, `?tab=` in the URL, provider chooser |
| `store.js` | IndexedDB autosave. Doc: `{ id, name, value, savedValue, provider, ref, updatedAt, highlights }` |
| `launch.js` | Opening a file handed over by the OS, deduped against Recent |
| `providers/index.js` | Provider interface (documented at the top), `providers` list, `ConflictError`, `fileNameFor` |
| `providers/local.js` | "This device": File System Access API, or file input plus download fallback |
| `ui.js` | `h()` DOM helper, `toast`, `timeAgo`, theme picker and persistence |
| `styles.css` | App page styles |

`vite.config.js` holds the PWA manifest (file handlers, icons) and Workbox precaching.
`e2e/serve.mjs` serves the built PWA under `/flow/` for tests.

## Tests and tooling

| Command | What runs |
| --- | --- |
| `npm test` | Vitest: `packages/core/test/core.test.js` (parser, layout, edits, settings, PDF) |
| `npm run test:e2e` | Builds element and PWA, then Playwright in Edge (CI: Chromium). Use this, not bare `playwright test`, which tests a stale PWA build. |
| `npm run dev` / `dev:pwa` | Vite dev servers |

E2E specs: `packages/element/e2e/element.spec.js` (large; grouped by `test.describe`: phone
width, outline tab, title page, project settings, Highlight Manager, ...),
`element/e2e/dist.spec.js` (built bundles), `packages/pwa/e2e/pwa.spec.js`,
`pwa/e2e/scrollbars.spec.js`.

CI: `.github/workflows/ci.yml` runs both test suites on branches and PRs. `deploy.yml` runs CI
on push to `main`, then publishes `packages/pwa/dist` to `gh-pages`. Pushing to `main` deploys.

## Where to look for...

| Task | Start in |
| --- | --- |
| Fountain syntax being misread | `core/src/parser.js` (`classifyBody`), then `inline.js` |
| Page breaks, wrapping, (MORE)/(CONT'D) | `core/src/layout.js` (`buildBlocks`, `paginate`) |
| Something that looks wrong only in the editor | `element/src/editor.js` decorations, `styles.js` |
| A formatting button | `ribbon.js` -> `FlowEditor` method -> `core/src/convert.js` |
| Outline card behavior | `element/src/outline.js` -> `core/src/outline.js` |
| Colors, a new theme token | `themes.js`, `controls.js` (`CONTROL_TOKENS`), then the README tables |
| Paper sizes / Settings boneyard | `core/src/settings.js`, `settings-dialog.js` |
| PDF output | `core/src/pdf.js` (draws `layout()`), `pdf-fonts.js` |
| Saving, opening files, conflicts | `pwa/src/providers/`, `editor-view.js` |
| A new storage provider | `providers/index.js` interface; `BACKLOG.md` for the plans |

## Conventions

- Commits: `feat(element): ...`, `fix(core): ...`, `style(...)`, `test(pwa)`. Scopes are the
  package or feature (`core`, `element`, `pwa`, `outline`).
- Branches: `feature/<name>` or `fix/<name>`, merged into `main` with a merge commit, then deleted.
- Each file opens with a comment saying what it is for, written in plain prose. Keep that
  up when adding files.
- Private class members use `#`. Factories are `createX()` returning `{ root, ... }`;
  modals are `openXDialog(parent, actions)`.
- Planned work lives in `BACKLOG.md`.
