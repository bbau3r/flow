// The project's settings, which are kept in the file itself, on its title page, so the
// script looks the same wherever it's opened. The Cover lists the title page's own fields, in the
// script's order, whatever they are. A page size shows on the page at once, and only Save writes
// anything into the script, as one undo step; closing any other way puts the page back.

import { button } from './controls.js';
import { pageSizeSetting } from './dimensions-field.js';
import { openSettingsPanel } from './settings-panel.js';

// A field's text box grows with its lines, as a contact block needs several.
function fieldBox(field, onInput) {
  const box = document.createElement('textarea');
  box.value = field.value;
  box.setAttribute('aria-label', field.label);
  box.spellcheck = true;
  const fit = () => { box.rows = Math.max(1, box.value.split('\n').length); };
  fit();
  box.addEventListener('input', () => {
    fit();
    onInput(box.value);
  });
  return box;
}

function coverTopic(fields, values) {
  if (!fields.length) {
    return {
      label: 'Cover',
      properties: [{
        label: 'No title page',
        keywords: 'cover title page fields',
        description: 'This script starts without a title page. Start it with a line such as Title: Big Fish, and its fields show here.',
        control: null,
      }],
    };
  }
  return {
    label: 'Cover',
    properties: fields.map((field, i) => ({
      label: field.label,
      keywords: 'cover title page field',
      control: fieldBox(field, (value) => { values[i] = value; }),
    })),
  };
}

export function openSettingsDialog(parent, actions) {
  // The title page's fields, and what's typed into them, in the script's order.
  const fields = actions.getCover();
  const values = fields.map((field) => field.value);
  const dimensions = pageSizeSetting({
    label: 'Dimensions',
    value: actions.getDimensions(),
    onChange: (size) => actions.preview(size),
    description: 'Saved in the script, in a Settings boneyard on its title page. Only Fountain view shows it.',
  });

  let saved = false;
  const save = () => {
    const size = dimensions.value;
    if (size === null) return;
    saved = true;
    panel.close();
    actions.save({ dimensions: size, cover: values });
  };
  const panel = openSettingsPanel(parent, {
    title: 'Project Settings',
    icon: 'page-size',
    sections: [{
      id: 'page',
      label: 'Page',
      icon: 'page-size',
      topics: [coverTopic(fields, values), {
        label: 'Paper',
        properties: [dimensions.property],
      }],
    }],
    onClose: () => {
      if (!saved) actions.preview(null);
      actions.onClose();
    },
    actions: [
      button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => panel.close() }),
      button({ label: 'Save', cls: 'fl-btn-primary', onClick: save }),
    ],
  });
  panel.dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type !== 'search') save();
  });
}
