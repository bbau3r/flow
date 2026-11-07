import { registerSW } from 'virtual:pwa-register';
import { installControlStyles, loadFonts } from '@flow/element/source';
import './styles.css';
import { getDoc } from './store.js';
import { renderHome } from './home.js';
import { renderEditor } from './editor-view.js';
import { currentTheme, toast } from './ui.js';
import { openLaunchedFile } from './launch.js';

const app = document.getElementById('app');
let leaveView = null;

async function route() {
  leaveView?.();
  leaveView = null;
  const id = /^#\/edit\/([^?]+)/.exec(location.hash)?.[1];
  const doc = id && (await getDoc(id));
  if (doc) leaveView = renderEditor(app, doc);
  else await renderHome(app);
}

const onHome = () => !/^#\/edit\//.test(location.hash);

installControlStyles();
document.documentElement.dataset.theme = currentTheme();
loadFonts();
window.addEventListener('hashchange', () => route().catch((err) => toast(err.message)));
// Provider availability depends on the connection, so keep the home page's cards current.
for (const event of ['online', 'offline']) {
  window.addEventListener(event, () => { if (onHome()) route(); });
}
route().catch((err) => toast(err.message));

// Files opened with Flow from the operating system, such as a double-clicked .fountain file.
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async ({ files }) => {
    if (!files?.length) return;
    try {
      let doc = null;
      for (const handle of files) doc = await openLaunchedFile(handle);
      const target = `#/edit/${doc.id}`;
      // The script may be open already, which needs a redraw rather than a new address.
      if (location.hash === target) await route();
      else location.hash = target;
    } catch (err) {
      toast(err.message);
    }
  });
}

const updateSW = registerSW({
  onNeedRefresh() {
    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.setAttribute('role', 'status');
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.addEventListener('click', () => updateSW(true));
    banner.append('A new version of Flow is ready. ', reload);
    document.body.append(banner);
  },
});
