// An app extension's settings as a section of the settings panel, built from the settings its
// manifest lists: a switch, a choice, text or a number each, grouped into the topics they name.
// App settings shows it after its own sections, below a rule.

import { toggleSwitch } from '@flow/element/source';
import { setSetting, settingsOf } from './host.js';

function control(manifest, setting, value) {
  const save = (next) => setSetting(manifest.id, setting.key, next);
  if (setting.type === 'boolean') {
    return toggleSwitch({ label: setting.label, checked: value, onChange: save });
  }
  if (setting.type === 'choice') {
    const select = document.createElement('select');
    for (const option of setting.options) select.add(new Option(option.label, option.value, false, option.value === value));
    select.addEventListener('change', () => save(select.value));
    return select;
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

/** The section for an app's settings, or null for an app with none. */
export function extensionSection(manifest, { hidden = false } = {}) {
  if (!manifest.settings?.length) return null;
  const values = settingsOf(manifest.id);
  const topics = [];
  for (const setting of manifest.settings) {
    let topic = topics.find(({ label }) => label === setting.topic);
    if (!topic) {
      topic = { label: setting.topic, properties: [] };
      topics.push(topic);
    }
    topic.properties.push({
      label: setting.label,
      description: setting.description,
      keywords: `${manifest.name} extension`,
      control: control(manifest, setting, values[setting.key]),
    });
  }
  return { id: sectionId(manifest.id), label: manifest.name, icon: manifest.icon, topics, hidden };
}
