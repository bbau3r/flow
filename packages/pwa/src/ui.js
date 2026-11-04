// Small DOM helpers shared by the views.

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

export function timeAgo(when) {
  const minutes = Math.round((Date.now() - when) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const THEMES = [['auto', 'Auto'], ['amber-light', 'Light'], ['amber-dark', 'Dark']];
const THEME_KEY = 'flow-theme';

export function currentTheme() {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'auto';
  } catch {
    return 'auto';
  }
}

export function themePicker(onChange) {
  const select = h('select', {
    'aria-label': 'Theme',
    class: 'theme',
    onchange: () => {
      try {
        localStorage.setItem(THEME_KEY, select.value);
      } catch {
        // Private browsing can refuse storage; the theme still applies for this visit.
      }
      document.documentElement.dataset.theme = select.value;
      onChange?.(select.value);
    },
  });
  for (const [value, label] of THEMES) select.add(new Option(label, value, false, value === currentTheme()));
  return select;
}
