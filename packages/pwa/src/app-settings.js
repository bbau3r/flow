// The app's own settings, which belong to this device rather than to any script: the theme, what
// new scripts start with, which extension settings get a tab, the sources scripts can live in,
// the extensions themselves, and installing Flow as an app. Each app extension that's on and has settings follows Flow's own
// sections, after a rule. They open from the gear on the home page and from App settings in a
// script's Document menu, and every change applies at once.

import { button, openSettingsPanel, pageSizeSetting, PALETTES, toggleSwitch } from '@flow/element/source';
import { DEFAULT_COVER } from '@flow/core';
import { readDefaults, saveDefaults } from './defaults.js';
import { themeControls } from './ui.js';
import { getExtension, isEnabled, listExtensions, onExtensionsChange, setShowsInSettings, showsInSettings } from './extensions/host.js';
import { extensionsSection } from './extensions/manager.js';
import { sourcesSection } from './sources-section.js';
import { providers } from './providers/index.js';
import { extensionSection, sectionId } from './extensions/settings.js';

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

// Part of the Appearance page: whether each app extension's settings get a tab of their own
// here. Either way, the Extensions page turns to them.
function settingsTabsTopic(apps, panel) {
  const properties = apps.map(({ manifest }) => ({
    label: manifest.name,
    keywords: 'layout extension tab rail settings show hide',
    description: `Gives ${manifest.name}’s settings a tab of their own below the rule, while it’s on.`,
    control: toggleSwitch({
      label: `Show ${manifest.name} in App settings`,
      checked: showsInSettings(manifest.id),
      attrs: { 'data-settings-tab': manifest.id },
      onChange: (on) => {
        setShowsInSettings(manifest.id, on);
        panel()?.setHidden(sectionId(manifest.id), !(on && isEnabled(manifest.id)));
      },
    }),
  }));
  if (!properties.length) {
    properties.push({
      label: 'Extension tabs',
      keywords: 'layout extension tab rail settings',
      description: 'App extensions with settings can have a tab of their own here.',
      control: null,
    });
  }
  return { label: 'Settings tabs', properties };
}

const tabShown = (id) => isEnabled(id) && showsInSettings(id);

/**
 * Opens App settings, on the section called `start` if given, such as 'extensions'. Returns the
 * panel, which reopens itself in place when the list of extensions or palettes changes.
 */
export function openAppSettings({ onClose, start } = {}) {
  const theme = themeControls();
  const install = installControl();
  const paletteNames = Object.values(PALETTES).map(({ label }) => label).join(' ');
  let panel = null;
  let reopening = false;
  // Every app with settings has a section, kept out of the rail while it's off or hidden.
  const apps = listExtensions().filter(({ manifest }) => manifest.kind === 'app' && manifest.settings.length);
  const extensionSections = apps.map(({ manifest }) => extensionSection(manifest, { hidden: !tabShown(manifest.id) }));

  const sourceCount = providers.length;
  const stopListening = onExtensionsChange((change) => {
    const kind = getExtension(change.id)?.manifest.kind;
    // Extensions coming or going, a theme's palette, a source, or an extension that couldn't
    // start, change what the panel holds.
    const reopen = ['added', 'removed', 'error'].includes(change.type)
      || (change.type === 'enabled' && (kind === 'theme' || providers.length !== sourceCount || getExtension(change.id)?.error));
    if (reopen) {
      reopening = true;
      stopListening();
      panel.close();
      const next = openAppSettings({ onClose, start: 'extensions' });
      // Focus stays on the switch that changed things, when it's still there.
      next.dialog.querySelector(`.fl-switch[data-extension="${CSS.escape(change.id)}"]`)?.focus();
    } else if (change.type === 'enabled') {
      panel.setHidden(sectionId(change.id), !tabShown(change.id));
    }
  });

  panel = openSettingsPanel(document.body, {
    title: 'App Settings',
    icon: 'settings',
    start,
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
        }, settingsTabsTopic(apps, () => panel)],
      },
      defaultsSection(),
      sourcesSection(),
      extensionsSection(() => panel),
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
      ...(extensionSections.length ? ['divider', ...extensionSections] : []),
    ],
    onClose: () => {
      install.stop();
      stopListening();
      if (!reopening) onClose?.();
    },
  });
  return panel;
}
