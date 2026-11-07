// A page size picker: a dropdown of named sizes and Custom, which shows a width, a height and
// their unit. Shared by the project settings and the PDF export, which adds its own first
// choice.

import { customLimits, PAPER_NAMES, parseDimensions, UNITS } from '@flow/core';

const CUSTOM = 'custom';
const UNIT_NAMES = { in: 'in', cm: 'cm', mm: 'mm' };
const round = (n) => Math.round(n * 100) / 100;

function numberInput(label) {
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.step = 'any';
  input.setAttribute('aria-label', label);
  return input;
}

/**
 * `value` is 'letter', 'a4', { width, height, unit } or, with a `first` choice of
 * { value, label }, that choice's value. `onChange` gets the same, once the size is valid.
 */
export function dimensionsField({ label = 'Page size', value, first, onChange }) {
  const size = parseDimensions(value);
  const custom = size && typeof size === 'object' ? size : null;
  const chosen = first && value === first.value ? first.value : custom ? CUSTOM : size ?? 'letter';

  const field = document.createElement('label');
  field.className = 'fl-field';
  const select = document.createElement('select');
  if (first) select.add(new Option(first.label, first.value));
  for (const [key, name] of Object.entries(PAPER_NAMES)) select.add(new Option(name, key));
  select.add(new Option('Custom', CUSTOM));
  select.value = chosen;
  field.append(label, select);

  const start = custom ?? { width: 8.5, height: 11, unit: 'in' };
  const width = numberInput('Width');
  const height = numberInput('Height');
  const unit = document.createElement('select');
  unit.setAttribute('aria-label', 'Unit');
  for (const [key, name] of Object.entries(UNIT_NAMES)) unit.add(new Option(name, key));
  width.value = String(start.width);
  height.value = String(start.height);
  unit.value = start.unit;
  const times = document.createElement('span');
  times.className = 'fl-unit';
  times.textContent = '×';
  const sizes = document.createElement('div');
  sizes.className = 'fl-field fl-custom-size';
  sizes.append(width, times, height, unit);
  const hint = document.createElement('p');
  hint.className = 'fl-hint';

  // The limits follow the unit, and so do the numbers when it changes.
  const applyLimits = () => {
    const { width: [minW, maxW], height: [minH, maxH] } = customLimits(unit.value);
    Object.assign(width, { min: String(minW), max: String(maxW) });
    Object.assign(height, { min: String(minH), max: String(maxH) });
    hint.textContent = `From ${minW} to ${maxW} ${unit.value} wide, so the script's columns fit, and ${minH} to ${maxH} ${unit.value} tall.`;
  };
  let lastUnit = unit.value;
  unit.addEventListener('change', () => {
    const factor = UNITS[unit.value] / UNITS[lastUnit];
    lastUnit = unit.value;
    for (const input of [width, height]) if (input.value !== '') input.value = String(round(Number(input.value) * factor));
    applyLimits();
  });
  applyLimits();

  const current = () => {
    if (select.value !== CUSTOM) return select.value;
    const w = Number(width.value);
    const h = Number(height.value);
    const valid = width.value !== '' && height.value !== '' && width.checkValidity() && height.checkValidity();
    hint.classList.toggle('fl-hint-error', !valid);
    return valid ? parseDimensions({ width: w, height: h, unit: unit.value }) : null;
  };
  const sync = () => {
    sizes.hidden = select.value !== CUSTOM;
    hint.hidden = sizes.hidden;
    const next = current();
    if (next !== null) onChange?.(next);
  };
  select.addEventListener('change', sync);
  unit.addEventListener('change', sync);
  width.addEventListener('input', sync);
  height.addEventListener('input', sync);
  sizes.hidden = chosen !== CUSTOM;
  hint.hidden = sizes.hidden;

  return {
    nodes: [field, sizes, hint],
    /** The size as chosen, or null while a custom size is out of range. */
    get value() { return current(); },
  };
}
