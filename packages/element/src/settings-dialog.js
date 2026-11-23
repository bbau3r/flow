// The project's settings, which are kept in the file itself, so the script looks the same
// wherever it's opened. Two sections: the Cover, the title page's own fields, whatever they are,
// in the script's order, and the Page, its size. Every change goes into the script as it's made,
// joining one undo step as typing does.

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

function coverSection(fields, setField) {
  const properties = fields.length
    ? fields.map((field, i) => ({
      label: field.label,
      keywords: 'cover title page field',
      control: fieldBox(field, (value) => setField(i, value)),
    }))
    : [{
      label: 'No title page',
      keywords: 'cover title page fields',
      description: 'This script starts without a title page. Start it with a line such as Title: Big Fish, and its fields show here.',
      control: null,
    }];
  return { id: 'cover', label: 'Cover', icon: 'cover', topics: [{ label: 'Title page', properties }] };
}

export function openSettingsDialog(parent, actions) {
  // The title page's fields, and what's typed into them, in the script's order.
  const fields = actions.getCover();
  const values = fields.map((field) => field.value);
  const setField = (i, value) => {
    values[i] = value;
    actions.setCover(values);
  };

  const dimensions = pageSizeSetting({
    label: 'Dimensions',
    value: actions.getDimensions(),
    onChange: (size) => { if (size) actions.setDimensions(size); },
    description: 'Saved in the script, in a Settings boneyard on its title page. Only Fountain view shows it.',
  });

  openSettingsPanel(parent, {
    title: 'Project Settings',
    icon: 'page-size',
    sections: [
      coverSection(fields, setField),
      {
        id: 'page',
        label: 'Page',
        icon: 'page',
        topics: [{ label: 'Paper', properties: [dimensions.property] }],
      },
    ],
    onClose: () => actions.onClose(),
  });
}
