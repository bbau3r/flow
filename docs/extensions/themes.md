# Writing a theme extension

A theme extension adds one or more palettes to Flow's theme chooser. It's a single JSON file, with no code. Once it's added and turned on, its palettes sit beside Sage, Sand and the rest, each with a light and a dark version, and Auto switches between them with the device.

## Adding it to Flow

1. Save the JSON below as a file ending in `.json`, called anything, such as `mint.json`.
2. In Flow, open **App settings**, then **Extensions**, and choose **Add theme**.
3. Pick the file. Flow checks it, and if anything's wrong it says what, under the buttons.
4. It's added turned on, and its palettes show under **Appearance**. Its switch turns it off.

Added extensions stay on this device. To change one, edit the file and add it again: a file with the same `id` replaces the one before, and stays on or off as it was. **Remove** takes it out of Flow.

## An example

```json
{
  "id": "mint",
  "kind": "theme",
  "name": "Mint",
  "version": "1.0.0",
  "author": "Your name",
  "description": "Cool green on pale paper, and soft green on charcoal.",
  "palettes": {
    "mint": {
      "label": "Mint",
      "light": {
        "desk": "#dfe8e3",
        "paper": "#f4faf6",
        "ink": "#1e2b25",
        "accent": "#1d7a55",
        "accent-ink": "#f4faf6",
        "secondary": "#8a4f7d"
      },
      "dark": {
        "desk": "#1a1d1c",
        "paper": "#232826",
        "ink": "#e2ebe6",
        "accent": "#6fd3a8",
        "accent-ink": "#232826",
        "secondary": "#d9a3cf"
      }
    }
  }
}
```

## The fields

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | 2 to 40 lowercase letters, digits or dashes, starting with a letter. It can't be the id of an extension Flow has built in. |
| `kind` | yes | `"theme"` |
| `name` | yes | What the Extensions page calls it, up to 60 characters |
| `version` | no | Shown on its card. Defaults to `1.0.0`. |
| `author` | no | Shown on its card |
| `description` | no | Shown on its card, and searched, up to 400 characters |
| `icon` | no | Its own drawing, as `{ "paths": [...] }`, SVG path data on a 24 by 24 grid, or one of Flow's icon names, such as `"palette"`. Without one it shows a jigsaw piece. [The apps guide](apps.md#icons) has more. |
| `palettes` | yes | One or more palettes, by name |

A palette's name, such as `mint` above, is what Flow stores as the chosen theme, as `mint-light`, `mint-dark` or `mint-auto`. It has to be 2 to 24 lowercase letters and digits, starting with a letter, with no dashes. It can't be the name of a palette Flow has built in (`sage`, `sand`, `sea`, `romance`, `forest`, `lavender`, `graphite`), or of one another extension that's on already uses.

Each palette has a `label`, which the theme chooser shows, and a `light` and a `dark` set of colors. Either set can leave colors out, and anything left out comes from Sage.

## The colors

Every value has to be a CSS color, such as `#1d7a55`, `rgb(29 122 85)` or `hsl(155 62% 30%)`. Anything else is turned away, because the colors go into a stylesheet.

| Color | Where it shows |
| --- | --- |
| `desk` | Behind the pages, and the app's background |
| `paper` | The pages, and the covers on the home page |
| `ink` | The script's text |
| `muted` | Quieter text, such as hints and descriptions |
| `accent` | The primary color: the current tab, pressed buttons, focus rings, switches |
| `accent-ink` | Text and icons drawn on `accent` |
| `secondary` | A color that complements `accent`, used in previews and the Flow wordmark |
| `secondary-ink` | Text on `secondary` |
| `success`, `warning`, `danger` | States. Keep them close to green, amber and red, and shift them only when your colors would clash. |
| `rule` | Borders and dividing lines |
| `ribbon-bg`, `ribbon-ink` | The pills, menus and bars, and their text |
| `bubble-bg`, `bubble-ink` | Comment bubbles in the script |
| `shadow` | Shadows, usually a dark color with some transparency, such as `rgb(0 0 0 / 0.6)` |

A few things make a palette easy to read:

- Keep `ink` on `paper`, and `accent-ink` on `accent`, at a contrast of at least 4.5 to 1.
- In dark versions, keep `desk` and `paper` close to grey with a hint of your hue, and put the color in `accent` and `secondary`.
- Keep `desk` and `paper` apart enough that the pages stand out from the desk.

## When it's turned off

Turning a theme extension off takes its palettes out of the chooser. If one was in use, Flow shows Sage in the meantime, but remembers the choice: turning the extension back on brings it back.
