// The PDF export options. All but the page size apply to the page view as they change. The
// page size is the script's own, from its page settings, unless one export asks for another.

import { formatDimensions } from '@flow/core';
import { button, openModal } from './controls.js';
import { dimensionsField } from './dimensions-field.js';

const CHECKS = [
  ['titlePage', 'Title page'],
  ['sceneNumbers', 'Scene numbers'],
  ['boldScenes', 'Bold scene headings'],
  ['underlineScenes', 'Underline scene headings'],
  ['doubleSpaceScenes', 'Double space before scenes'],
  ['sceneContinued', 'Scene continued across pages'],
  ['pageNumbers', 'Page numbers'],
];

const DEFAULT = 'default';

export function openExportDialog(parent, actions) {
  const options = actions.getOptions();

  const paper = dimensionsField({
    label: 'Paper',
    value: actions.getExportPaper() ?? DEFAULT,
    first: { value: DEFAULT, label: `Default (${formatDimensions(actions.getScriptPaper())})` },
    onChange: (size) => actions.setExportPaper(size === DEFAULT ? null : size),
  });

  const checks = CHECKS.map(([key, label]) => {
    const wrap = document.createElement('label');
    wrap.className = 'fl-field';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = options[key];
    input.addEventListener('change', () => actions.setOption(key, input.checked));
    wrap.append(input, label);
    return wrap;
  });

  const modal = openModal(parent, {
    title: 'Export PDF',
    icon: 'pdf',
    body: [...paper.nodes, ...checks],
    onClose: actions.onClose,
    actions: [
      button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => modal.close() }),
      button({
        label: 'Export PDF',
        cls: 'fl-btn-primary',
        onClick: () => {
          if (paper.value === null) return;
          modal.close();
          actions.exportPdf();
        },
      }),
    ],
  });
}
