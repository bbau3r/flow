// Files on this device. Browsers with the File System Access API save straight back
// to the file. Others, including iOS Safari, open through a file input and save by
// downloading a copy.

import { ConflictError, fileNameFor } from './index.js';

const EXTENSIONS = ['.fountain', '.spmd', '.txt'];
const TYPES = [{ description: 'Fountain screenplay', accept: { 'text/plain': EXTENSIONS } }];
// Pickers with the same id reopen in the folder last used with it.
const PICKER_ID = 'flow-scripts';

const canWriteFiles = () => 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
const isCancel = (err) => err?.name === 'AbortError';

function pickWithInput() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = EXTENSIONS.join(',');
    input.addEventListener('change', () => resolve(input.files[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

function download(doc) {
  const name = fileNameFor(doc.name);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([doc.value], { type: 'text/plain;charset=utf-8' }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  return { name, ref: { downloaded: true } };
}

async function writeTo(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
  return (await handle.getFile()).lastModified;
}

async function pickSaveTarget(doc) {
  try {
    return await window.showSaveFilePicker({
      suggestedName: fileNameFor(doc.name),
      types: TYPES,
      // startIn opens the folder holding that file. Otherwise, reuse the last folder.
      ...(doc.ref?.handle ? { startIn: doc.ref.handle } : { id: PICKER_ID }),
    });
  } catch (err) {
    if (isCancel(err)) return null;
    throw err;
  }
}

export const localProvider = {
  id: 'local',
  label: 'This device',
  description: 'Open a Fountain file from your computer or phone.',

  status: () => ({ ok: true }),

  saveHint: () => (canWriteFiles()
    ? 'Choose the folder and file name.'
    : 'Downloads a copy. This browser can\u2019t choose a folder.'),

  // Browsers can open a file's folder but never reveal its path.
  location: (doc) => (doc.ref?.handle ? 'On this device' : 'Downloaded copy'),

  async open() {
    if (!canWriteFiles()) {
      const file = await pickWithInput();
      return file && { name: file.name, text: await file.text(), ref: { downloaded: true } };
    }
    try {
      const [handle] = await window.showOpenFilePicker({ id: PICKER_ID, types: TYPES });
      return await this.openHandle(handle);
    } catch (err) {
      if (isCancel(err)) return null;
      throw err;
    }
  },

  /** Reads a file the writer has already chosen, such as one opened with Flow from the system. */
  async openHandle(handle) {
    const file = await handle.getFile();
    return { name: file.name, text: await file.text(), ref: { handle, lastModified: file.lastModified } };
  },

  // Saving always shows the OS dialog, opened in the file's folder with its name filled
  // in, so confirming is one keypress and choosing somewhere else is just as easy.
  async save(doc, { force = false, target = null } = {}) {
    if (!canWriteFiles()) return download(doc);
    const original = doc.ref?.handle;
    const handle = target ?? await pickSaveTarget(doc);
    if (!handle) return null;
    if (!force && original && await handle.isSameEntry(original)) {
      const current = await handle.getFile();
      if (current.lastModified > doc.ref.lastModified) {
        const conflict = new ConflictError(`${doc.name} changed outside Flow since it was last opened or saved.`);
        conflict.target = handle;
        throw conflict;
      }
    }
    return { name: handle.name, ref: { handle, lastModified: await writeTo(handle, doc.value) } };
  },

  saveAs(doc) {
    return this.save(doc);
  },
};
