// What P2P keeps on this device: whether it's on (App settings › App), the signal server peers
// meet through, and the alias you go by. Also the random parts of connecting: server names,
// tokens and the colors members are told apart by.

const ENABLED_KEY = 'flow-p2p';
const ROUTE_KEY = 'flow-p2p-route';
const ALIAS_KEY = 'flow-p2p-alias';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    if (value == null || value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private browsing can refuse storage; the choice still holds for this visit.
  }
};

/** Whether P2P is on. It starts off, and turns on in App settings. */
export const p2pEnabled = () => read(ENABLED_KEY) === 'on';

/** Turns P2P on or off, telling open views with a `flow-p2p` event on window. */
export function setP2pEnabled(on) {
  write(ENABLED_KEY, on ? 'on' : null);
  window.dispatchEvent(new CustomEvent('flow-p2p', { detail: { enabled: !!on } }));
}

/** The signal server's address as typed, or '' for PeerJS's free public one. */
export const readRoute = () => read(ROUTE_KEY) ?? '';
export const saveRoute = (route) => write(ROUTE_KEY, route.trim());

/**
 * PeerJS's options for a signal server's address, such as localhost:9000 for one run on this
 * computer with `npx peerjs --port 9000`. An empty address is PeerJS's public server. Throws
 * when it isn't an address.
 */
export function routeOptions(route) {
  const typed = route.trim();
  if (!typed) return {};
  const local = /^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(typed);
  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(typed) ? typed : `${local ? 'http' : 'https'}://${typed}`);
  } catch {
    throw new Error(`“${typed}” isn’t a server address. Try one like localhost:9000.`);
  }
  const secure = url.protocol === 'https:' || url.protocol === 'wss:';
  return { host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port) || (secure ? 443 : 80), path: url.pathname || '/', secure };
}

/** Which signal server is in use, as a sentence. */
export const routeNote = (route) => (route.trim() ? `Using ${route.trim()} server.` : 'Using PeerJS public server.');

const ADJECTIVES = ['Amber', 'Brave', 'Calm', 'Clever', 'Swift', 'Quiet', 'Merry', 'Bold', 'Gentle', 'Lucky', 'Bright', 'Keen', 'Noble', 'Sunny', 'Witty', 'Misty'];
const ANIMALS = ['Heron', 'Otter', 'Fox', 'Wren', 'Badger', 'Lynx', 'Falcon', 'Hare', 'Owl', 'Seal', 'Robin', 'Moth', 'Panda', 'Raven', 'Stag', 'Koi'];

const pick = (list) => list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];

/** The alias you go by, or a new random one, such as Quiet Heron, kept for next time. */
export function readAlias() {
  const kept = read(ALIAS_KEY);
  if (kept) return kept;
  const alias = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
  write(ALIAS_KEY, alias);
  return alias;
}

export const saveAlias = (alias) => write(ALIAS_KEY, cleanAlias(alias));

/** An alias as shown: trimmed, on one line, and not too long. */
export const cleanAlias = (alias) => String(alias ?? '').replace(/\s+/g, ' ').trim().slice(0, 32);

/** A server name to suggest, such as misty-otter-42. */
export const randomServerName = () => `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${10 + (crypto.getRandomValues(new Uint8Array(1))[0] % 90)}`.toLowerCase();

/** A server name as peers find it: lower case, letters, digits and dashes. */
export const serverSlug = (name) => String(name ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

// No 0, O, 1, I or L, which are easy to misread when a token is read out.
const TOKEN_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A random token to share as the session's password, such as K7QM-3XRA-PW2H. */
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((byte) => TOKEN_CHARS[byte % TOKEN_CHARS.length]).join('');
  return chars.match(/.{4}/g).join('-');
}

/** A token as compared: what was typed, without spaces or dashes, in capitals. */
export const tokenKey = (token) => String(token ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Colors that read well behind white letters, in light and dark themes alike.
export const MEMBER_COLORS = ['#d9534f', '#e07b28', '#b8901a', '#3d9a5b', '#228f8f', '#3a7bd5', '#7461d1', '#b04fa3', '#8a6a4f', '#5f7a8a'];

/** A random member color, one nobody in `taken` has where possible. */
export function randomColor(taken = []) {
  const free = MEMBER_COLORS.filter((color) => !taken.includes(color));
  return pick(free.length ? free : MEMBER_COLORS);
}

// An invite: everything a guest needs, as JSON to paste into Connect. It's signed with the
// token, so a pasted invite that was changed or cut short is caught rather than half filled in.
const INVITE_KIND = 'flow-p2p-invite';

async function inviteSignature({ server, token, route }) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(tokenKey(token)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${INVITE_KIND}\n${serverSlug(server)}\n${route.trim()}`));
  return [...new Uint8Array(signed).slice(0, 12)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** An invite to a session, as the JSON text to copy. */
export async function makeInvite({ server, token, route = '' }) {
  const invite = { kind: INVITE_KIND, v: 1, server: serverSlug(server), token, route: route.trim() };
  return JSON.stringify({ ...invite, sig: await inviteSignature(invite) });
}

/**
 * The server, token and route in pasted text, when it's an invite. Null for anything else, and
 * throws when it's an invite whose signature doesn't match.
 */
export async function readInvite(text) {
  let invite;
  try {
    invite = JSON.parse(String(text ?? '').trim());
  } catch {
    return null;
  }
  if (invite?.kind !== INVITE_KIND) return null;
  const fields = { server: String(invite.server ?? ''), token: String(invite.token ?? ''), route: String(invite.route ?? '') };
  if (invite.sig !== await inviteSignature(fields)) throw new Error('That invite has been changed or cut short. Ask the host to copy it again.');
  return fields;
}
