import { FlowScript } from './flow-script.js';

export { FlowScript };
export { registerTheme } from './themes.js';
export { parse, layout, DEFAULT_OPTIONS } from '@flow/core';

if (!customElements.get('flow-script')) customElements.define('flow-script', FlowScript);
