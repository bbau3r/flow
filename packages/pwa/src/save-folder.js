// The save folder: a folder on this device where scripts are saved, chosen once in App settings'
// Defaults. Opening and saving a file start there, unless a script already has a file of its
// own, so new scripts land in it with a single press of Enter. Only browsers that can be given a
// folder, Chrome and Edge on a computer, offer it. Its handle is kept in IndexedDB.

import { button } from '@flow/element/source';
import { deleteKept, getKept, putKept } from './store.js';
import { h, toast } from './ui.js';

const KEY = 'save-folder';

export const canChooseFolder = () => 'showDirectoryPicker' in window;

let folder;

/** The save folder's handle, or null when none is chosen. */
export async function readSaveFolder() {
  if (folder === undefined) {
    try {
      folder = (await getKept(KEY)) ?? null;
    } catch {
      folder = null;
    }
  }
  return folder;
}

/** Lets the person choose the save folder. Resolves to it, or null if they cancelled. */
export async function chooseSaveFolder() {
  try {
    const handle = await window.showDirectoryPicker({ id: 'flow-save-folder', mode: 'readwrite' });
    folder = handle;
    await putKept(KEY, handle);
    return handle;
  } catch (err) {
    if (err?.name === 'AbortError') return null;
    throw err;
  }
}

export async function clearSaveFolder() {
  folder = null;
  await deleteKept(KEY);
}

/** The save folder as a settings property: its name, and buttons to choose another or clear it. */
export function saveFolderSetting() {
  const shown = h('p', { class: 'save-folder-name', 'data-save-folder': '' });
  const choose = button({ label: 'Choose folder', icon: 'folder', cls: 'fl-btn-outline', attrs: { id: 'choose-save-folder' } });
  const clear = button({ label: 'Clear', cls: 'fl-btn-outline', attrs: { id: 'clear-save-folder' } });
  const draw = (handle) => {
    shown.textContent = handle ? `Saving in ${handle.name}` : 'None chosen: the dialogs start where they were last left.';
    clear.hidden = !handle;
  };
  const supported = canChooseFolder();
  choose.disabled = !supported;
  choose.addEventListener('click', async () => {
    try {
      const handle = await chooseSaveFolder();
      if (handle) draw(handle);
    } catch (err) {
      toast(err.message);
    }
  });
  clear.addEventListener('click', async () => {
    await clearSaveFolder();
    draw(null);
  });
  draw(null);
  readSaveFolder().then(draw);
  return {
    label: 'Save folder',
    keywords: 'folder directory save open default location local files',
    description: supported
      ? 'Opening and saving start in this folder, so a new script saves there with a single Enter. A script with a file of its own still saves back beside it.'
      : 'This browser can’t be given a folder. Chrome and Edge on a computer can.',
    control: [choose, clear],
    below: shown,
  };
}
