// The extensions that ship with Flow. Each is a folder holding its manifest.json and, for an
// app, an index.js exporting activate(flow), written only against the extension API in
// host.js, as an extension from anywhere else would be. All of them start turned off.

import vimManifest from './vim-lite/manifest.json';
import { activate as vimActivate } from './vim-lite/index.js';
import protonManifest from './proton-drive/manifest.json';
import { activate as protonActivate } from './proton-drive/index.js';
import typewriterManifest from './typewriter/manifest.json';

export const BUILT_IN = [
  { manifest: vimManifest, activate: vimActivate },
  { manifest: protonManifest, activate: protonActivate },
  { manifest: typewriterManifest },
];
