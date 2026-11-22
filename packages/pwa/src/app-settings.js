// The app's own settings, which belong to this device rather than to any script: the theme, what
// new scripts start with, and installing Flow as an app. They open from the gear on the home page and from App settings in a
// script's Document menu, and every change applies at once.

import { button, openSettingsPanel, pageSizeSetting, PALETTES } from '@flow/element/source';
import { DEFAULT_COVER } from '@flow/core';
import { readDefaults, saveDefaults } from './defaults.js';
import { themeControls } from './ui.js';

// The browser offers installing once, through this event, and only while it's not installed.
let installPrompt = null;
const installListeners = new Set();
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installListeners.forEach((listener) => listener());
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installListeners.forEach((listener) => listener());
});

const installed = () => matchMedia('(display-mode: standalone)').matches;

function installControl() {
  const control = button({
    label: 'Install',
    icon: 'download',
    cls: 'fl-btn-primary',
    attrs: { id: 'install' },
    onClick: async () => {
      await installPrompt?.prompt();
      installPrompt = null;
      sync();
    },
  });
  function sync() {
    control.disabled = !installPrompt;
    control.lastChild.textContent = installed() ? 'Installed' : 'Install';
  }
  sync();
  installListeners.add(sync);
  return { control, stop: () => installListeners.delete(sync) };
}

// A field's text box grows with the lines in it, as a contact block needs several.
function valueBox(value, label, onInput) {
  const box = document.createElement('textarea');
  box.value = value;
  box.rows = Math.max(1, value.split('\n').length);
  box.setAttribute('aria-label', label);
  box.addEventListener('input', () => {
    box.rows = Math.max(1, box.value.split('\n').length);
    onInput(box.value);
  });
  return box;
}

const PLACEHOLDER_NOTE = '{date} and {year} fill in when a script is made.';

// The Defaults page: the page size and the title page fields a new script starts with. Each
// standard field is a property of its own, with its text and a switch that leaves it off.
function defaultsSection() {
  const defaults = readDefaults();
  const save = () => saveDefaults(defaults);

  // The same picker and drawing of the sheet as the project settings.
  const size = pageSizeSetting({
    value: defaults.dimensions,
    keywords: 'new script',
    description: 'New scripts start at this size. US Letter adds no setting to the script.',
    onChange: (value) => {
      defaults.dimensions = value;
      save();
    },
  });

  const fieldProperty = (field) => {
    const box = valueBox(field.value, field.key, (value) => {
      field.value = value;
      save();
    });
    const include = document.createElement('input');
    include.type = 'checkbox';
    include.checked = field.enabled;
    include.title = `Include ${field.key}`;
    include.setAttribute('aria-label', `Include ${field.key}`);
    box.disabled = !field.enabled;
    include.addEventListener('change', () => {
      field.enabled = include.checked;
      box.disabled = !include.checked;
      save();
    });
    return {
      label: field.key,
      keywords: 'cover title page new script',
      control: [box, include],
      description: /\{(date|year)\}/.test(DEFAULT_COVER.find(({ key }) => key === field.key)?.value ?? '') ? PLACEHOLDER_NOTE : null,
    };
  };

  return {
    id: 'defaults',
    label: 'Defaults',
    icon: 'bulb',
    topics: [
      {
        label: 'Page',
        properties: [size.property],
      },
      {
        label: 'Cover page',
        properties: defaults.cover.map(fieldProperty),
      },
    ],
  };
}

export function openAppSettings({ onClose } = {}) {
  const theme = themeControls();
  const install = installControl();
  const paletteNames = Object.values(PALETTES).map(({ label }) => label).join(' ');
  return openSettingsPanel(document.body, {
    title: 'App Settings',
    icon: 'settings',
    sections: [
      {
        id: 'appearance',
        label: 'Appearance',
        icon: 'palette',
        topics: [{
          label: 'Theme',
          properties: [
            {
              label: 'Mode',
              keywords: 'auto light dark night colour color scheme',
              control: theme.modes,
              description: 'Auto follows your device’s light or dark setting.',
            },
            {
              label: 'Palette',
              keywords: `colour color theme ${paletteNames}`,
              control: theme.grid,
              wide: true,
            },
          ],
        }],
      },
      defaultsSection(),
      {
        id: 'app',
        label: 'App',
        icon: 'app',
        topics: [{
          label: 'Installing',
          properties: [{
            label: 'Install Flow',
            keywords: 'install app pwa offline desktop home screen',
            control: install.control,
            description: 'Opens Flow in its own window and keeps it working offline. Browsers that can install it offer this here; others have it in their own menu, such as Add to Home Screen.',
          }],
        }],
      },
    ],
    onClose: () => {
      install.stop();
      onClose?.();
    },
  });
}
