// Opening a file handed to Flow by the operating system. A file already in the recent list
// opens there rather than appearing twice, refreshed from the file unless it holds changes
// not yet saved, which saving will then ask about.

import { createDoc, listDocs, putDoc } from './store.js';
import { localProvider } from './providers/local.js';

const sameFile = async (doc, handle) => doc.provider === 'local' && !!doc.ref?.handle && doc.ref.handle.isSameEntry(handle);

export async function openLaunchedFile(handle) {
  const file = await localProvider.openHandle(handle);
  const text = file.text.replace(/\r\n?/g, '\n');
  for (const doc of await listDocs()) {
    if (!(await sameFile(doc, handle))) continue;
    if (doc.value === doc.savedValue) {
      Object.assign(doc, { value: text, savedValue: text, ref: file.ref, updatedAt: Date.now() });
      await putDoc(doc);
    }
    return doc;
  }
  return createDoc({ name: file.name, value: text, provider: localProvider.id, ref: file.ref, saved: true });
}
