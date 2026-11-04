// Google Drive, using the narrow drive.file permission: Flow can only see files the
// user picks here or creates with it, never the rest of their Drive.
//
// Credentials are public identifiers, set at build time (see the README).
// `globalThis.FLOW_CONFIG` overrides them for a deployment or a test.

import { ConflictError, fileNameFor } from './index.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const config = () => {
  const env = import.meta.env;
  const override = globalThis.FLOW_CONFIG ?? {};
  return {
    clientId: override.googleClientId ?? env.VITE_GOOGLE_CLIENT_ID,
    apiKey: override.googleApiKey ?? env.VITE_GOOGLE_API_KEY,
    appId: override.googleAppId ?? env.VITE_GOOGLE_APP_ID,
  };
};

function loadScript(src, isReady) {
  if (isReady()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not reach Google. Check your connection.'));
    document.head.append(script);
  });
}

let token = null;
let tokenExpires = 0;

async function getToken() {
  if (token && Date.now() < tokenExpires) return token;
  await loadScript('https://accounts.google.com/gsi/client', () => globalThis.google?.accounts?.oauth2);
  return new Promise((resolve, reject) => {
    const client = globalThis.google.accounts.oauth2.initTokenClient({
      client_id: config().clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google sign-in failed: ${response.error}`));
          return;
        }
        token = response.access_token;
        tokenExpires = Date.now() + (Number(response.expires_in) - 60) * 1000;
        resolve(token);
      },
      error_callback: (err) => reject(new Error(err.type === 'popup_closed' ? 'Google sign-in was cancelled.' : `Google sign-in failed: ${err.type}`)),
    });
    client.requestAccessToken();
  });
}

async function request(url, options = {}, retry = true) {
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${await getToken()}` },
  });
  // Tokens last about an hour and a script can stay open far longer.
  if (response.status === 401 && retry) {
    token = null;
    return request(url, options, false);
  }
  if (!response.ok) throw new Error(`Google Drive returned an error (${response.status}).`);
  return response;
}

const readMeta = async (fileId) => (await request(`${API}/${fileId}?fields=name,modifiedTime`)).json();

async function pickFile() {
  const accessToken = await getToken();
  await loadScript('https://apis.google.com/js/api.js', () => globalThis.gapi);
  await new Promise((resolve) => globalThis.gapi.load('picker', resolve));
  const { picker } = globalThis.google;
  const { apiKey, appId } = config();
  return new Promise((resolve) => {
    new picker.PickerBuilder()
      .addView(new picker.DocsView(picker.ViewId.DOCS).setMode(picker.DocsViewMode.LIST))
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs[0].id);
        if (data.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}

export const googleDriveProvider = {
  id: 'google-drive',
  label: 'Google Drive',
  description: 'Open a Fountain file stored in your Google Drive.',

  status() {
    const { clientId, apiKey, appId } = config();
    if (!clientId || !apiKey || !appId) return { ok: false, reason: 'Needs setup' };
    if (!navigator.onLine) return { ok: false, reason: 'Needs internet' };
    return { ok: true };
  },

  saveHint: () => 'Saves to the top level of your Drive.',

  location: () => 'Google Drive',

  async open() {
    const fileId = await pickFile();
    if (!fileId) return null;
    const meta = await readMeta(fileId);
    const text = await (await request(`${API}/${fileId}?alt=media`)).text();
    return { name: meta.name, text, ref: { fileId, modifiedTime: meta.modifiedTime } };
  },

  async save(doc, { force = false } = {}) {
    const { fileId, modifiedTime } = doc.ref;
    const current = await readMeta(fileId);
    if (!force && current.modifiedTime !== modifiedTime) {
      throw new ConflictError(`${doc.name} changed in Google Drive since it was last opened or saved.`);
    }
    const response = await request(`${UPLOAD}/${fileId}?uploadType=media&fields=name,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
      body: doc.value,
    });
    const saved = await response.json();
    return { name: saved.name, ref: { fileId, modifiedTime: saved.modifiedTime } };
  },

  async saveAs(doc) {
    const name = fileNameFor(doc.name);
    const boundary = `flow-${crypto.randomUUID()}`;
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name, mimeType: 'text/plain' }),
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      doc.value,
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const response = await request(`${UPLOAD}?uploadType=multipart&fields=id,name,modifiedTime`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const saved = await response.json();
    return { name: saved.name, ref: { fileId: saved.id, modifiedTime: saved.modifiedTime } };
  },
};
