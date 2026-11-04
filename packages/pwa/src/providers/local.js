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

export const localProvider = {
  id: 'local',
  label: 'This device',
  description: 'Open a Fountain file from your computer or phone.',

  status: () => ({ ok: true }),

  saveHint: () => (canWriteFiles()
    ? 'Choose the folder and file name.'
    : 'Downloads a copy. This browser can\u2019t choose a folder.'),

  // Browsers never reveal a file's folder path, only that they can write back to it.
  location: (doc) => (doc.ref?.handle ? 'Original file on this device' : 'Downloaded copy'),

  async open() {
    if (!canWriteFiles()) {
      const file = await pickWithInput();
      return file && { name: file.name, text: await file.text(), ref: { downloaded: true } };
    }
    try {
      const [handle] = await window.showOpenFilePicker({ id: PICKER_ID, types: TYPES });
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), ref: { handle, lastModified: file.lastModified } };
    } catch (err) {
      if (isCancel(err)) return null;
      throw err;
    }
  },

  async save(doc, { force = false } = {}) {
    const { handle, lastModified } = doc.ref ?? {};
    // Without a file to return to, a browser that can ask where to save should ask.
    if (!handle) return canWriteFiles() ? this.saveAs(doc) : download(doc);
    // The browser forgets write permission between sessions, so ask again if needed.
    if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted'
      && (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
      throw new Error('Permission to save to this file was denied.');
    }
    const current = await handle.getFile();
    if (!force && current.lastModified > lastModified) {
      throw new ConflictError(`${doc.name} changed outside Flow since it was last opened or saved.`);
    }
    return { name: doc.name, ref: { handle, lastModified: await writeTo(handle, doc.value) } };
  },

  async saveAs(doc) {
    if (!canWriteFiles()) return download(doc);
    try {
      // Start next to the original when there is one, so a copy lands beside it.
      const handle = await window.showSaveFilePicker({
        suggestedName: fileNameFor(doc.name),
        types: TYPES,
        ...(doc.ref?.handle ? { startIn: doc.ref.handle } : { id: PICKER_ID }),
      });
      return { name: handle.name, ref: { handle, lastModified: await writeTo(handle, doc.value) } };
    } catch (err) {
      if (isCancel(err)) return null;
      throw err;
    }
  },
};
