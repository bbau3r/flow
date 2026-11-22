// An app extension's settings as a section of the settings panel, built from the settings its
// manifest lists: a switch, a choice, text or a number each, grouped into the topics they name.
// A cloud source the extension adds, when it connects, gets a topic of its own there too, with
// Connect or Disconnect. App settings shows the section after its own, below a rule.

import { button, keyCapture, toggleSwitch } from '@flow/element/source';
import { extensionSources, setSetting, settingsOf } from './host.js';
import { h, toast } from '../ui.js';

function control(manifest, setting, value) {
  const save = (next) => setSetting(manifest.id, setting.key, next);
  if (setting.type === 'boolean') {
    return toggleSwitch({ label: setting.label, checked: value, onChange: save });
  }
  if (setting.type === 'key') {
    return keyCapture({ label: setting.label, value, onChange: save });
  }
  if (setting.type === 'choice') {
    const select = document.createElement('select');
    for (const option of setting.options) select.add(new Option(option.label, option.value, false, option.value === value));
    select.addEventListener('change', () => save(select.value));
    return select;
  }
  // Several lines of text get a box that grows with them, under the setting's name.
  if (setting.type === 'text' && setting.multiline) {
    const box = document.createElement('textarea');
    box.value = String(value);
    box.spellcheck = true;
    const fit = () => { box.rows = Math.max(3, box.value.split('\n').length + 1); };
    fit();
    box.addEventListener('input', () => {
      fit();
      save(box.value);
    });
    return box;
  }
  const input = document.createElement('input');
  input.type = setting.type === 'number' ? 'number' : 'text';
  input.value = String(value);
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (setting.type === 'number') {
    if (setting.min !== null) input.min = String(setting.min);
    if (setting.max !== null) input.max = String(setting.max);
    input.addEventListener('change', () => {
      save(input.value);
      input.value = String(settingsOf(manifest.id)[setting.key]);
    });
  } else {
    input.addEventListener('input', () => save(input.value));
  }
  return input;
}

export const sectionId = (id) => `extension-${id}`;

// A source's connection: who or where it's connected to, and the button that connects it or
// lets go. An extension with one source calls it Connection, since its page has its name already.
function sourceTopic(source, only) {
  const account = h('p', { class: 'source-account', 'data-source': source.id });
  const action = button({ label: 'Connect', cls: 'fl-btn-outline', attrs: { 'data-action': 'connect', 'data-source': source.id } });
  const draw = () => {
    const status = source.status();
    const connection = source.connection();
    action.disabled = !status.ok;
    if (!status.ok) account.textContent = status.reason;
    else account.textContent = connection?.connected ? `Connected${connection.account ? `: ${connection.account}` : ''}` : 'Not connected';
    const label = connection?.connected ? 'Disconnect' : 'Connect';
    action.lastChild.textContent = label;
    action.setAttribute('aria-label', `${label} ${source.label}`);
    action.title = `${label} ${source.label}`;
  };
  action.addEventListener('click', async () => {
    try {
      if (source.connection()?.connected) await source.disconnect();
      else await source.connect();
    } catch (err) {
      toast(`${source.label}: ${err.message}`);
    }
    draw();
  });
  draw();
  return {
    label: only ? 'Connection' : source.label,
    description: source.description,
    properties: [{
      label: 'Account',
      keywords: 'cloud source connect sign in sign out account',
      control: action,
      below: account,
    }],
  };
}

/** The section for an app's settings, or null for an app with none and no source to connect. */
export function extensionSection(manifest, { hidden = false } = {}) {
  const sources = extensionSources(manifest.id).filter((source) => source.connection);
  if (!manifest.settings?.length && !sources.length) return null;
  const values = settingsOf(manifest.id);
  const topics = sources.map((source) => sourceTopic(source, sources.length === 1));
  for (const setting of manifest.settings) {
    let topic = topics.find(({ label }) => label === setting.topic);
    if (!topic) {
      topic = { label: setting.topic, properties: [] };
      topics.push(topic);
    }
    topic.properties.push({
      wide: setting.type === 'text' && setting.multiline,
      label: setting.label,
      description: setting.description,
      keywords: `${manifest.name} extension`,
      control: control(manifest, setting, values[setting.key]),
    });
  }
  return { id: sectionId(manifest.id), label: manifest.name, icon: manifest.icon, topics, hidden };
}
