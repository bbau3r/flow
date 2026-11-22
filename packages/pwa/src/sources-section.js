// The Sources page of App settings: where scripts can live. Temp is this browser's own storage,
// for scripts not in a file yet. Local sources are files on this device, and cloud sources are
// services, most added by extensions, each with Connect or Disconnect when it needs signing in
// or setting up.

import { button } from '@flow/element/source';
import { providers } from './providers/index.js';
import { h, toast } from './ui.js';

function cloudProperty(provider) {
  const status = provider.status();
  const account = h('p', { class: 'source-account', 'data-source': provider.id });
  const action = button({ label: 'Connect', cls: 'fl-btn-outline', attrs: { 'data-action': 'connect', 'data-source': provider.id } });
  const draw = () => {
    const connection = provider.connection?.() ?? null;
    action.hidden = !connection;
    if (!status.ok) {
      account.textContent = status.reason;
      action.disabled = true;
    } else if (connection) {
      account.textContent = connection.connected ? `Connected${connection.account ? `: ${connection.account}` : ''}` : 'Not connected';
    } else {
      account.textContent = 'Ready';
    }
    const label = connection?.connected ? 'Disconnect' : 'Connect';
    action.lastChild.textContent = label;
    action.setAttribute('aria-label', `${label} ${provider.label}`);
    action.title = `${label} ${provider.label}`;
  };
  action.addEventListener('click', async () => {
    try {
      if (provider.connection().connected) await provider.disconnect();
      else await provider.connect();
    } catch (err) {
      toast(`${provider.label}: ${err.message}`);
    }
    draw();
  });
  draw();
  return {
    label: provider.label,
    keywords: 'cloud source storage connect sign in',
    description: provider.description,
    control: action,
    below: account,
  };
}

/** The Sources section for App settings. */
export function sourcesSection() {
  const local = providers.filter((provider) => provider.kind === 'local');
  const cloud = providers.filter((provider) => provider.kind === 'cloud');
  return {
    id: 'sources',
    label: 'Sources',
    icon: 'folder',
    topics: [
      {
        label: 'Temp',
        description: 'Project file temporarily saved in the browser’s own local storage. Autosaves there as you write. Need to save to persist file.',
        properties: [],
      },
      {
        label: 'Local',
        description: 'Project file from your device.',
        properties: local.map((provider) => ({
          label: provider.label,
          keywords: 'local file device folder',
          description: provider.description,
          control: null,
        })),
      },
      {
        label: 'Cloud',
        description: 'External cloud sources to save and load files.',
        properties: cloud.length ? cloud.map(cloudProperty) : [{
          label: 'No cloud sources',
          keywords: 'cloud drive sync',
          description: 'Extensions can add them, such as Proton Drive, on the Extensions page.',
          control: null,
        }],
      },
    ],
  };
}
