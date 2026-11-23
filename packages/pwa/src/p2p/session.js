// A P2P session: one script written in by several people at once, each in their own browser,
// joined directly to each other with WebRTC through PeerJS. The host's browser is the "server":
// it holds the script, checks each guest's token, and puts every edit in order. Peers find each
// other through a signal server, PeerJS's public one or one run locally, which only introduces
// them; the script itself goes straight between browsers.
//
// Edits travel as commits: each change to the script is diffed into an operation (see
// @flow/core's ot.js) and stamped with who made it. The host applies commits in the order they
// arrive, transforming any made at the same time, and sends each one on, so everyone ends on the
// same text and every change can be told apart by its author. Changes from others never join
// your undo history, so undo only takes back your own.
//
// One session runs at a time, for one script. `currentSession()` is it, and `onSessionChange`
// hears when one starts, changes or ends.

import { applyOperation, baseLength, compose, diffText, isNoop, isOperation, operationChanges, transform } from '@flow/core';
import { cleanAlias, randomColor, routeOptions, serverSlug, tokenKey } from './config.js';

const PROTOCOL = 1;
const PEER_PREFIX = 'flow-p2p-';
const JOIN_TIMEOUT_MS = 20000;
const HELLO_TIMEOUT_MS = 10000;
// How many commits the host keeps to transform late ones against. A guest further behind is
// sent the whole script again.
const LOG_LIMIT = 1000;
// Commits by one person this close together count as one change in the list of changes.
const ACTIVITY_GROUP_MS = 90 * 1000;
const ACTIVITY_LIMIT = 50;
const MAX_MEMBERS = 16;

let current = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener(current));

/** The session running now, or null. */
export const currentSession = () => current;

/** Calls `listener(session)` whenever a session starts, changes or ends. Returns a function to stop. */
export function onSessionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// PeerJS's errors, said plainly.
function peerError(err, serverName) {
  const messages = {
    'unavailable-id': `Someone is already hosting “${serverName}”. Pick another server name.`,
    'peer-unavailable': `No one is hosting “${serverName}” right now. Check the server name, and that the host has started.`,
    'browser-incompatible': 'This browser can’t make direct connections (WebRTC).',
    network: 'Couldn’t reach the signal server. Check your connection, or the route.',
    'server-error': 'The signal server couldn’t be reached.',
    'socket-error': 'The connection to the signal server failed.',
    'socket-closed': 'The signal server closed the connection.',
    'ssl-unavailable': 'The signal server needs a secure (https) address.',
    'invalid-id': 'That server name can’t be used. Try letters, numbers and dashes.',
    'invalid-key': 'The signal server turned down the key.',
  };
  return new Error(messages[err?.type] ?? err?.message ?? 'Something went wrong connecting.');
}

async function createPeer(id, route, serverName) {
  const options = { ...routeOptions(route), debug: 0 };
  const { Peer } = await import('peerjs');
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, options) : new Peer(options);
    const fail = (err) => {
      peer.destroy();
      reject(peerError(err, serverName));
    };
    peer.once('open', () => {
      peer.off('error', fail);
      resolve(peer);
    });
    peer.once('error', fail);
  });
}

const hostPeerId = (serverName) => `${PEER_PREFIX}${serverSlug(serverName)}`;

// What's shared about a member, which everyone sees.
const publicMember = ({ id, alias, color, since, host }) => ({ id, alias, color, since, host: !!host });

// An alias no one else in the session has, adding a number if need be.
function uniqueAlias(alias, members, self) {
  const taken = new Set(members.filter((member) => member.id !== self).map((member) => member.alias.toLowerCase()));
  const base = cleanAlias(alias) || 'Guest';
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
  return name;
}

// The line a change starts on, counted in the text it was made to.
function lineOf(text, op) {
  const first = operationChanges(op)[0];
  if (!first) return 0;
  let line = 0;
  for (let i = text.indexOf('\n'); i !== -1 && i < first.from; i = text.indexOf('\n', i + 1)) line++;
  return line;
}

class Session {
  role;
  serverName;
  token;
  route;
  docId = null;
  status = 'connecting';
  // Why the session ended, for a guest who didn't leave themselves.
  reason = null;
  self = null;
  members = [];
  // Changes by who made them, newest first: { by, alias, color, line, commits, added, removed, at }.
  activity = [];
  peer = null;
  // The script as this session knows it, and the editor showing it.
  text = '';
  version = 0;
  script = null;
  #onChange = null;
  #listeners = new Set();

  constructor({ role, serverName, token, route }) {
    this.role = role;
    this.serverName = serverName;
    this.token = token;
    this.route = route;
  }

  get active() {
    return this.status === 'hosting' || this.status === 'connected';
  }

  /** Calls `listener()` whenever members, status or changes move. Returns a function to stop. */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  changed() {
    this.#listeners.forEach((listener) => listener());
    notify();
  }

  /**
   * Joins the session to a <flow-script>: edits made in it become commits, and commits from
   * others go into it. Returns a function that lets go of it.
   */
  attach(script) {
    this.detach();
    this.script = script;
    this.#onChange = () => this.syncLocal();
    script.addEventListener('flow-change', this.#onChange);
    // Anything that arrived before the editor was there goes in now.
    if (script.value !== this.text) script.applyChanges(operationChanges(diffText(script.value, this.text)));
    return () => this.detach(script);
  }

  detach(script = this.script) {
    if (!script || script !== this.script) return;
    script.removeEventListener('flow-change', this.#onChange);
    this.script = null;
  }

  // Shows a commit from someone else in the editor, keeping this.text in step first, so the
  // flow-change it fires finds nothing new.
  showRemote(op) {
    this.text = applyOperation(this.text, op);
    if (this.script) this.script.applyChanges(operationChanges(op));
  }

  // Notes a commit in the list of changes, joining the last one when it's the same person's.
  record(op, author, before) {
    const member = this.members.find(({ id }) => id === author) ?? { id: author, alias: 'Someone', color: '#888' };
    const changes = operationChanges(op);
    const added = changes.reduce((sum, change) => sum + change.text.length, 0);
    const removed = changes.reduce((sum, change) => sum + change.to - change.from, 0);
    const now = Date.now();
    const last = this.activity[0];
    if (last && last.by === author && now - last.at < ACTIVITY_GROUP_MS) {
      Object.assign(last, { commits: last.commits + 1, added: last.added + added, removed: last.removed + removed, at: now, alias: member.alias, color: member.color });
    } else {
      this.activity.unshift({ by: author, alias: member.alias, color: member.color, line: lineOf(before, op), commits: 1, added, removed, since: now, at: now });
      this.activity.length = Math.min(this.activity.length, ACTIVITY_LIMIT);
    }
  }

  /** How many commits a member has made, and when they last did. */
  contributions(id) {
    const mine = this.activity.filter(({ by }) => by === id);
    return { commits: mine.reduce((sum, entry) => sum + entry.commits, 0), last: mine[0]?.at ?? null };
  }

  /** Ends the session: the host stops hosting, a guest leaves. */
  end(reason = null) {
    if (this.status === 'closed') return;
    this.status = 'closed';
    this.reason = reason;
    this.detach();
    this.closeConnections();
    // A moment's grace, so the last messages, such as telling guests it's over, get there.
    const { peer } = this;
    this.peer = null;
    setTimeout(() => peer?.destroy(), 400);
    if (current === this) current = null;
    this.changed();
  }
}

class HostSession extends Session {
  #guests = new Map();
  #log = [];

  async start({ alias, text }) {
    this.text = text;
    this.self = { id: 'host', alias: cleanAlias(alias) || 'Host', color: randomColor(), since: Date.now(), host: true };
    this.members = [this.self];
    try {
      this.peer = await createPeer(hostPeerId(this.serverName), this.route, this.serverName);
    } catch (err) {
      this.status = 'closed';
      throw err;
    }
    this.peer.on('connection', (conn) => this.#welcome(conn));
    // Losing the signal server only stops new guests finding the session, so it tries again.
    this.peer.on('disconnected', () => {
      if (this.status === 'hosting') setTimeout(() => this.peer?.reconnect(), 2000);
    });
    this.peer.on('error', () => {});
    this.status = 'hosting';
    this.changed();
  }

  syncLocal() {
    if (!this.script || this.status !== 'hosting') return;
    const value = this.script.value;
    if (value === this.text) return;
    this.#commit(diffText(this.text, value), this.self.id, null);
  }

  // Applies a commit made against the current text, notes it, and sends it to every guest but
  // the one who made it, who is told it's in.
  #commit(op, author, from) {
    const before = this.text;
    if (from) this.showRemote(op);
    else this.text = applyOperation(this.text, op);
    this.version += 1;
    this.#log.push({ op, version: this.version });
    if (this.#log.length > LOG_LIMIT) this.#log.splice(0, this.#log.length - LOG_LIMIT);
    this.record(op, author, before);
    const at = Date.now();
    for (const [conn, guest] of this.#guests) {
      if (!guest.member) continue;
      if (conn === from) conn.send({ t: 'ack', v: this.version });
      else conn.send({ t: 'commit', v: this.version, op, by: author, at });
    }
    this.changed();
  }

  #welcome(conn) {
    const guest = { member: null };
    this.#guests.set(conn, guest);
    const timer = setTimeout(() => {
      if (!guest.member) conn.close();
    }, HELLO_TIMEOUT_MS);
    conn.on('data', (message) => {
      try {
        this.#receive(conn, guest, message);
      } catch {
        // A guest whose commits don't fit is sent the script afresh.
        conn.send({ t: 'reset', v: this.version, text: this.text });
      }
    });
    conn.on('close', () => {
      clearTimeout(timer);
      this.#guests.delete(conn);
      if (guest.member) {
        this.members = this.members.filter((member) => member !== guest.member);
        this.#sendMembers();
      }
    });
    conn.on('error', () => conn.close());
  }

  #receive(conn, guest, message) {
    if (!message || typeof message !== 'object') return;
    if (!guest.member) {
      if (message.t !== 'hello') return;
      const deny = (reason) => {
        conn.send({ t: 'denied', reason });
        setTimeout(() => conn.close(), 500);
      };
      if (message.protocol !== PROTOCOL) return deny('protocol');
      if (tokenKey(message.token) !== tokenKey(this.token)) return deny('token');
      if (this.members.length >= MAX_MEMBERS) return deny('full');
      const taken = this.members.map(({ color }) => color);
      guest.member = {
        id: conn.peer,
        alias: uniqueAlias(message.alias, this.members, conn.peer),
        color: typeof message.color === 'string' && /^#[0-9a-f]{6}$/i.test(message.color) && !taken.includes(message.color) ? message.color : randomColor(taken),
        since: Date.now(),
        conn,
      };
      this.members.push(guest.member);
      conn.send({ t: 'welcome', you: publicMember(guest.member), members: this.members.map(publicMember), text: this.text, v: this.version, name: this.docName?.() ?? '' });
      this.#sendMembers();
      return;
    }
    if (message.t === 'commit') {
      const base = message.base;
      if (!isOperation(message.op) || !Number.isInteger(base) || base > this.version) throw new Error('bad commit');
      // Anything typed here first is a commit of the host's own, ahead of the guest's.
      this.syncLocal();
      const missed = this.#log.filter(({ version }) => version > base);
      if (missed.length !== this.version - base) throw new Error('too far behind');
      // The guest's commit was made before these, so it moves past each of them.
      let op = message.op;
      for (const entry of missed) [op] = transform(op, entry.op);
      if (baseLength(op) !== this.text.length) throw new Error('bad commit');
      this.#commit(op, guest.member.id, conn);
    } else if (message.t === 'profile') {
      guest.member.alias = uniqueAlias(message.alias, this.members, guest.member.id);
      this.#sendMembers();
    }
  }

  #sendMembers() {
    const members = this.members.map(publicMember);
    for (const [conn, guest] of this.#guests) if (guest.member) conn.send({ t: 'members', members });
    this.changed();
  }

  setAlias(alias) {
    this.self.alias = uniqueAlias(alias, this.members, this.self.id);
    this.#sendMembers();
  }

  /** Removes a guest from the session. */
  kick(id) {
    const member = this.members.find((each) => each.id === id && !each.host);
    if (!member) return;
    member.conn.send({ t: 'kicked' });
    setTimeout(() => member.conn.close(), 300);
    this.members = this.members.filter((each) => each !== member);
    this.#sendMembers();
  }

  closeConnections() {
    for (const conn of this.#guests.keys()) {
      try {
        conn.send({ t: 'ended' });
      } catch {
        // Already gone.
      }
      setTimeout(() => conn.close(), 200);
    }
    this.#guests.clear();
  }
}

class GuestSession extends Session {
  conn = null;
  // The commit sent and not yet confirmed, and what's been typed since, waiting its turn.
  #outstanding = null;
  #buffer = null;
  #ended = false;
  #settle = null;
  #timer = 0;

  // Connects, says hello with the token, and waits to be welcomed. Resolves with the script's
  // name and text.
  async start({ alias, color }) {
    this.peer = await createPeer(null, this.route, this.serverName);
    this.peer.on('error', (err) => this.#fail(peerError(err, this.serverName)));
    return new Promise((resolve, reject) => {
      this.#settle = { resolve, reject };
      const conn = this.peer.connect(hostPeerId(this.serverName), { reliable: true });
      this.conn = conn;
      this.#timer = setTimeout(() => this.#fail(new Error(`Couldn’t reach “${this.serverName}”. The host may be behind a network that blocks direct connections.`)), JOIN_TIMEOUT_MS);
      conn.on('open', () => conn.send({ t: 'hello', protocol: PROTOCOL, token: this.token, alias: cleanAlias(alias), color }));
      conn.on('data', (message) => this.#receive(message));
      conn.on('close', () => this.#closed());
      conn.on('error', () => this.#closed());
    });
  }

  #fail(err) {
    clearTimeout(this.#timer);
    if (this.#settle) {
      const { reject } = this.#settle;
      this.#settle = null;
      this.peer?.destroy();
      this.status = 'closed';
      reject(err);
    }
  }

  #closed() {
    if (this.#settle) return this.#fail(new Error(`“${this.serverName}” closed the connection.`));
    if (this.status === 'closed') return;
    this.end(this.#ended ? 'The host ended the session.' : 'Lost the connection to the host.');
  }

  #receive(message) {
    if (!message || typeof message !== 'object') return;
    switch (message.t) {
      case 'welcome': {
        clearTimeout(this.#timer);
        this.text = String(message.text ?? '');
        this.version = message.v;
        this.members = message.members;
        this.self = message.you;
        this.status = 'connected';
        const { resolve } = this.#settle ?? {};
        this.#settle = null;
        resolve?.({ name: message.name, text: this.text });
        this.changed();
        break;
      }
      case 'denied': {
        const reasons = {
          token: 'The token doesn’t match. Check it with the host.',
          full: `“${this.serverName}” is full.`,
          protocol: 'The host is on a different version of Flow. Both of you reloading should fix it.',
        };
        this.#fail(new Error(reasons[message.reason] ?? 'The host turned down the connection.'));
        break;
      }
      case 'members':
        this.members = message.members;
        this.self = this.members.find(({ id }) => id === this.self?.id) ?? this.self;
        this.changed();
        break;
      case 'commit': {
        if (!isOperation(message.op)) return;
        // Anything typed here and not yet sent goes first, so the commit can move past it.
        this.syncLocal();
        let op = message.op;
        if (this.#outstanding) [this.#outstanding, op] = transform(this.#outstanding, op);
        if (this.#buffer) [this.#buffer, op] = transform(this.#buffer, op);
        this.version = message.v;
        const before = this.text;
        this.showRemote(op);
        this.record(op, message.by, before);
        this.changed();
        break;
      }
      case 'ack': {
        this.version = message.v;
        if (this.#outstanding) this.record(this.#outstanding, this.self.id, this.text);
        this.#outstanding = this.#buffer;
        this.#buffer = null;
        if (this.#outstanding) this.#send(this.#outstanding);
        this.changed();
        break;
      }
      case 'reset':
        // The host lost track of this copy, so it starts again from the host's.
        this.#outstanding = null;
        this.#buffer = null;
        this.version = message.v;
        this.showRemote(diffText(this.text, String(message.text ?? '')));
        break;
      case 'kicked':
        this.end('The host removed you from the session.');
        break;
      case 'ended':
        this.#ended = true;
        break;
      default:
    }
  }

  #send(op) {
    this.conn.send({ t: 'commit', base: this.version, op });
  }

  syncLocal() {
    if (!this.script || this.status !== 'connected') return;
    const value = this.script.value;
    if (value === this.text) return;
    const op = diffText(this.text, value);
    this.text = value;
    if (isNoop(op)) return;
    if (this.#outstanding) this.#buffer = this.#buffer ? compose(this.#buffer, op) : op;
    else {
      this.#outstanding = op;
      this.#send(op);
    }
  }

  setAlias(alias) {
    this.conn?.send({ t: 'profile', alias: cleanAlias(alias) });
  }

  closeConnections() {
    this.conn?.close();
  }
}

/**
 * Hosts a session for the script `docId`, under `serverName`, with `token` as its password.
 * `text` is the script now, and `docName()` its name for guests. Resolves with the session once
 * peers can find it; rejects with a plain message when it can't start, such as when the server
 * name is taken.
 */
export async function hostSession({ docId, docName, serverName, token, alias, route, text }) {
  if (!serverSlug(serverName)) throw new Error('Give the server a name, so others can find it.');
  if (!tokenKey(token)) throw new Error('The session needs a token.');
  current?.end();
  const session = new HostSession({ role: 'host', serverName: serverSlug(serverName), token, route });
  session.docId = docId;
  session.docName = docName;
  current = session;
  try {
    await session.start({ alias, text });
  } catch (err) {
    if (current === session) current = null;
    notify();
    throw err;
  }
  return session;
}

/**
 * Joins the session hosted as `serverName`, with its token. Resolves with { session, name, text }:
 * the session and the host's script, once the host lets you in. Rejects with a plain message
 * when it can't, such as when no one is hosting under that name or the token is wrong.
 */
export async function joinSession({ serverName, token, alias, color, route }) {
  if (!serverSlug(serverName)) throw new Error('Enter the server name the host gave you.');
  if (!tokenKey(token)) throw new Error('Enter the token the host gave you.');
  current?.end();
  const session = new GuestSession({ role: 'guest', serverName: serverSlug(serverName), token, route });
  try {
    const { name, text } = await session.start({ alias, color });
    current = session;
    notify();
    return { session, name, text };
  } catch (err) {
    session.peer?.destroy();
    throw err;
  }
}
