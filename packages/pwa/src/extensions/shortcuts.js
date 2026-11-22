// Extension commands' keyboard shortcuts, written like Mod+Shift+K: Mod is Cmd on a Mac and Ctrl
// elsewhere, and the last part is a letter or digit. These read them against a key press and
// write them the way each system shows shortcuts.

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

const parse = (shortcut) => {
  const parts = shortcut.split('+');
  const key = parts.pop().toLowerCase();
  const mods = new Set(parts.map((part) => part.toLowerCase()));
  if (mods.has('mod')) mods.add(MAC ? 'meta' : 'ctrl');
  return { key, ctrl: mods.has('ctrl'), meta: mods.has('meta'), alt: mods.has('alt'), shift: mods.has('shift') };
};

/** Whether a keydown is the shortcut. */
export function matchesShortcut(event, shortcut) {
  if (!shortcut) return false;
  const want = parse(shortcut);
  // event.code keeps letters and digits steady when Alt or Shift changes what the key types.
  const pressed = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase()
    : /^Digit\d$/.test(event.code) ? event.code.slice(5) : event.key.toLowerCase();
  return pressed === want.key && event.ctrlKey === want.ctrl && event.metaKey === want.meta
    && event.altKey === want.alt && event.shiftKey === want.shift;
}

/** The shortcut as this system writes it, such as ⇧⌘K or Ctrl+Shift+K. */
export function shortcutLabel(shortcut) {
  if (!shortcut) return '';
  const { key, ctrl, meta, alt, shift } = parse(shortcut);
  const letter = key.toUpperCase();
  if (MAC) return `${ctrl ? '⌃' : ''}${alt ? '⌥' : ''}${shift ? '⇧' : ''}${meta ? '⌘' : ''}${letter}`;
  return [ctrl && 'Ctrl', meta && 'Win', alt && 'Alt', shift && 'Shift', letter].filter(Boolean).join('+');
}
