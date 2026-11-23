// Joining someone else's session, from Connect on the home page: the server name and token the
// host gave you, your alias, and under Route, the signal server to meet through. While it tries,
// Connect turns; if it can't get in, a banner across the top says why, and × dismisses it. Once
// in, the host's script opens, kept on this device as a copy of its own, which the next visit to
// the same server brings up to date. Pasting an invite the host copied, anywhere in the dialog,
// fills in the server name, token and route at once.

import { banner, button, openModal, spinner, textField } from '@flow/element/source';
import { createDoc, listDocs, putDoc } from '../store.js';
import { h } from '../ui.js';
import { randomColor, readAlias, readInvite, readRoute, routeOptions, saveAlias, saveRoute, serverSlug } from './config.js';
import { joinSession } from './session.js';

/** Opens the Connect dialog. */
export function openConnectDialog() {
  const error = banner({});
  const filled = banner({ tone: 'info' });
  const server = textField({ label: 'Server name', icon: 'pin', placeholder: 'misty-otter-42', showLabel: true, attrs: { 'data-p2p': 'server' } });
  const token = textField({ label: 'Token', icon: 'key', placeholder: 'XXXX-XXXX-XXXX', type: 'password', showLabel: true, attrs: { 'data-p2p': 'token' } });
  const alias = textField({ label: 'Alias', icon: 'user', value: readAlias(), showLabel: true, attrs: { 'data-p2p': 'alias' } });
  const route = textField({ label: 'Signal server', icon: 'signal', value: readRoute(), placeholder: 'PeerJS’s public server', showLabel: true, attrs: { 'data-p2p': 'route' } });
  const routeFold = h('details', { class: 'p2p-route' },
    h('summary', {}, 'Route'),
    route.root,
    h('p', { class: 'p2p-note' }, 'Server to connect with other peers. Leave unset to use PeerJS’s free public server.'),
    h('p', { class: 'p2p-note' }, 'You can run your own server with ', h('code', {}, 'npx peerjs --port 9000'), ' and enter ', h('code', {}, 'localhost:9000'), '.'));
  if (readRoute()) routeFold.open = true;

  let busy = false;
  // Closing the dialog while it connects calls the connection off.
  let closed = false;
  const connect = button({ label: 'Connect', icon: 'connect', cls: 'fl-btn-primary', attrs: { 'data-p2p': 'connect' } });
  const cancel = button({ label: 'Cancel', cls: 'fl-btn-outline', onClick: () => modal.close() });
  const setBusy = (on) => {
    busy = on;
    for (const input of [server.input, token.input, alias.input, route.input]) input.disabled = on;
    connect.disabled = on;
    connect.querySelector('.fl-spinner')?.remove();
    connect.querySelector('.fl-svg').hidden = on;
    if (on) connect.prepend(spinner('Connecting'));
    connect.lastChild.textContent = on ? 'Connecting…' : 'Connect';
  };

  const submit = async () => {
    if (busy) return;
    error.show(null);
    try {
      routeOptions(route.input.value);
    } catch (err) {
      error.show(err.message);
      return;
    }
    saveAlias(alias.input.value);
    saveRoute(route.input.value);
    setBusy(true);
    try {
      const { session, name, text } = await joinSession({
        serverName: server.input.value,
        token: token.input.value,
        alias: alias.input.value,
        color: randomColor(),
        route: route.input.value,
      });
      if (closed) {
        session.end();
        return;
      }
      // Joining the same server again brings its copy up to date rather than making another.
      const slug = serverSlug(server.input.value);
      let doc = (await listDocs()).find((each) => each.p2p?.role === 'guest' && each.p2p.server === slug);
      if (doc) Object.assign(doc, { value: text, name: name || doc.name, updatedAt: Date.now() });
      else doc = await createDoc({ name: name || 'Shared script', value: text });
      doc.p2p = { role: 'guest', server: slug, token: token.input.value };
      await putDoc(doc);
      session.docId = doc.id;
      modal.close();
      location.hash = `#/edit/${doc.id}`;
    } catch (err) {
      if (closed) return;
      setBusy(false);
      error.show(err.message);
    }
  };
  connect.addEventListener('click', submit);

  const form = h('form', { class: 'p2p-form', onsubmit: (event) => {
    event.preventDefault();
    submit();
  } }, error, filled, h('p', { class: 'p2p-note' }, 'Paste an invite from the host to fill everything in.'), server.root, token.root, alias.root, routeFold,
  // Enter in any field connects.
  h('button', { type: 'submit', hidden: true, tabindex: '-1', 'aria-hidden': 'true' }));

  const modal = openModal(document.body, { title: 'Connect', icon: 'connect', body: [form], actions: [cancel, connect], onClose: () => { closed = true; } });
  modal.dialog.classList.add('p2p-dialog');
  modal.dialog.addEventListener('paste', async (event) => {
    if (busy) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text.trim().startsWith('{')) return;
    event.preventDefault();
    try {
      const invite = await readInvite(text);
      if (!invite) return;
      server.input.value = invite.server;
      token.input.value = invite.token;
      route.input.value = invite.route;
      routeFold.open = !!invite.route;
      error.show(null);
      filled.show(`Filled in from the invite to ${invite.server}.`);
      connect.focus();
    } catch (err) {
      filled.show(null);
      error.show(err.message);
    }
  });
  modal.dialog.dataset.p2p = 'connect-dialog';
  server.input.focus();
  return modal;
}
