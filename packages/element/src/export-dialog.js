// The PDF export options, which apply to the page view as they change.

import { button, openModal } from './controls.js';

const CHECKS = [
  ['titlePage', 'Title page'],
  ['sceneNumbers', 'Scene numbers'],
  ['boldScenes', 'Bold scene headings'],
  ['underlineScenes', 'Underline scene headings'],
  ['doubleSpaceScenes', 'Double space before scenes'],
  ['sceneContinued', 'Scene continued across pages'],
  ['pageNumbers', 'Page numbers'],
];

const PAPERS = [['letter', 'US Letter'], ['a4', 'A4']];

export function openExportDialog(parent, actions) {
  const options = actions.getOptions();

  const paper = document.createElement('label');
  paper.className = 'fl-field';
  const select = document.createElement('select');
  for (const [value, label] of PAPERS) select.add(new Option(label, value, false, options.paper === value));
  select.addEventListener('change', () => actions.setOption('paper', select.value));
  paper.append('Paper', select);

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
    body: [paper, ...checks],
    onClose: actions.onClose,
    actions: [
      button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => modal.close() }),
      button({
        label: 'Export PDF',
        cls: 'fl-btn-primary',
        onClick: () => {
          modal.close();
          actions.exportPdf();
        },
      }),
    ],
  });
}
