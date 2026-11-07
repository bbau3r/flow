// The project's settings, which are kept in the file itself, on its title page, so the
// script looks the same wherever it's opened. Each change shows on the page at once, and
// only Save writes it into the script; closing any other way puts the page back.

import { button, icon, openModal } from './controls.js';
import { dimensionsField } from './dimensions-field.js';
import { pagePreview } from './page-preview.js';

export function openSettingsDialog(parent, actions) {
  const preview = pagePreview(actions.getDimensions());
  const dimensions = dimensionsField({
    label: 'Dimensions',
    value: actions.getDimensions(),
    onChange: (size) => {
      preview.show(size);
      actions.preview(size);
    },
  });
  const note = document.createElement('p');
  note.className = 'fl-hint fl-info';
  const text = document.createElement('span');
  text.textContent = 'Settings are saved in the script title section, only some are visible in fountain view.';
  note.append(icon('info'), text);

  let saved = false;
  const save = () => {
    const size = dimensions.value;
    if (size === null) return;
    saved = true;
    modal.close();
    actions.setDimensions(size);
  };
  const modal = openModal(parent, {
    title: 'Project Settings',
    body: [...dimensions.nodes, preview.root, note],
    onClose: () => {
      if (!saved) actions.preview(null);
      actions.onClose();
    },
    actions: [
      button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => modal.close() }),
      button({ label: 'Save', cls: 'fl-btn-primary', onClick: save }),
    ],
  });
  modal.dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') save();
  });
}
