// The project's settings, which are kept in the file itself, on its title page, so the
// script looks the same wherever it's opened. Each change shows on the page at once, and
// only Save writes it into the script; closing any other way puts the page back.

import { button } from './controls.js';
import { pageSizeSetting } from './dimensions-field.js';
import { openSettingsPanel } from './settings-panel.js';

export function openSettingsDialog(parent, actions) {
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
    actions.setDimensions(size);
  };
  const panel = openSettingsPanel(parent, {
    title: 'Project Settings',
    icon: 'settings',
    sections: [{
      id: 'page',
      label: 'Page',
      icon: 'page-size',
      topics: [{
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
