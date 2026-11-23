// P2P in the editor: a button in the script's top right corner, which folds behind ⋮ on a phone,
// and the card it opens. Before a session the button is the connect mark and the card sets one
// up: a server name, a token to share as its password, your alias, and Host. In a session the
// button is everyone's badges, stacked, and the card shows the session's status, its server name
// and token to pass on, who's in, and the changes each person has made. Choosing someone shows
// when they joined and what they've changed, and the host can remove them. Leaving the script
// ends the session.

import { banner, button, icon, menuHeading, openPopover, spinner, textField } from '@flow/element/source';
import { parse } from '@flow/core';
import { h, timeAgo, toast } from '../ui.js';
import { AVATAR_CSS, avatar, avatarStack } from './avatars.js';
import { makeInvite, p2pEnabled, randomServerName, randomToken, readAlias, readRoute, routeNote, saveAlias } from './config.js';
import { currentSession, hostSession, joinSession, onSessionChange } from './session.js';

// The button's own look, inside the script's shadow root.
const WIDGET_CSS = `${AVATAR_CSS}
.p2p-trigger { gap: 6px; }
.p2p-trigger .fl-spinner { width: 0.9em; height: 0.9em; color: var(--flow-accent); }
.p2p-trigger[data-status="closed"] .p2p-stack { opacity: 0.5; }
/* Lit while its card is open, as the Document menu's icon is. */
.p2p-trigger[aria-expanded="true"], .p2p-trigger[aria-expanded="true"]:hover:not(:disabled) { background: var(--flow-accent); color: var(--flow-accent-ink); }
`;

// How long the card waits for changes to settle before drawing who's in and what's changed.
const REDRAW_MS = 250;

const STATUS = {
  connecting: 'Connecting…',
  hosting: 'Hosting',
  connected: 'Connected',
  closed: 'Ended',
};

// The invite, for pasting into Connect, which fills everything in from it.
function inviteButton(fields) {
  return button({ label: 'Copy invite', icon: 'copy', cls: 'fl-btn-outline p2p-wide', attrs: { 'data-p2p': 'copy-invite', title: 'Copy the server name, token and route, to paste into Connect' }, onClick: async () => {
    const { server, token, route } = fields();
    copy(await makeInvite({ server, token, route }), 'invite');
  } });
}

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied the ${what}`);
  } catch {
    toast(`Couldn’t copy the ${what}. Select it and copy it instead.`);
  }
}

// A field for the token: hidden until shown, with buttons to show it, copy it, and, before a
// session starts, make a new one.
function tokenField(value, { readOnly = false } = {}) {
  const field = textField({ label: 'Token', icon: 'key', value, type: 'password', readOnly, attrs: { 'data-p2p': 'token' } });
  const show = button({ label: 'Show token', icon: 'read', iconOnly: true, attrs: { 'aria-pressed': 'false' }, onClick: () => {
    const shown = field.input.type === 'password';
    field.input.type = shown ? 'text' : 'password';
    show.setAttribute('aria-pressed', String(shown));
    show.replaceChildren(icon(shown ? 'eye-off' : 'read'));
    show.title = shown ? 'Hide token' : 'Show token';
  } });
  const box = field.root.querySelector('.fl-field-box');
  if (!readOnly) {
    box.append(button({ label: 'New token', icon: 'refresh', iconOnly: true, onClick: () => { field.input.value = randomToken(); } }));
  }
  box.append(show, button({ label: 'Copy token', icon: 'copy', iconOnly: true, attrs: { 'data-p2p': 'copy-token' }, onClick: () => copy(field.input.value, 'token') }));
  return field;
}

// The server name, token and route, which an invite carries, folded away under Alias so that
// most people never need to open them.
function routing(...nodes) {
  return h('details', { class: 'p2p-fold', 'data-p2p': 'routing' }, h('summary', {}, 'Server and token'), h('div', { class: 'p2p-fold-body' }, ...nodes));
}

function statusChip(session) {
  const status = session?.status ?? 'idle';
  return h('span', { class: 'p2p-status', 'data-status': status, role: 'status' },
    status === 'connecting' ? spinner('Connecting') : h('span', { class: 'p2p-dot' }),
    STATUS[status] ?? 'Not connected');
}

// The last scene heading at or before a line, to say where a change was.
function sceneNear(parsed, line) {
  for (let i = Math.min(line, parsed.lines.length - 1); i >= 0; i--) {
    if (parsed.lines[i].type === 'scene') return parsed.lines[i].text.trim();
  }
  return null;
}

function describeChange(entry, parsed) {
  const edits = `${entry.commits} edit${entry.commits === 1 ? '' : 's'}`;
  const where = sceneNear(parsed, entry.line);
  return where ? `${edits} near ${where}` : `${edits} on line ${entry.line + 1}`;
}

/**
 * Adds P2P to the editor for `doc` while it's on in App settings. `persist()` saves the doc.
 * Returns a function that takes it away, ending any session the script is in.
 */
export function attachP2p(script, doc, { persist }) {
  let removeWidget = null;
  let trigger = null;
  let card = null;
  let detach = null;
  let stopSession = null;
  // Why the last session ended, when it wasn't by choice, such as being removed by the host.
  let lastReason = null;

  const ours = () => {
    const session = currentSession();
    return session && session.docId === doc.id ? session : null;
  };

  const drawTrigger = () => {
    if (!trigger) return;
    const session = ours();
    trigger.dataset.status = session?.status ?? 'idle';
    if (!session) {
      trigger.replaceChildren(icon('connect'));
      trigger.title = 'Connect: write in this script with others';
      trigger.setAttribute('aria-label', 'Connect');
      return;
    }
    const names = session.members.map(({ alias }) => alias).join(', ');
    trigger.replaceChildren(...[session.status === 'connecting' ? spinner('Connecting') : null, avatarStack(session.members, { first: session.self?.id })].filter(Boolean));
    trigger.title = `${STATUS[session.status]}: ${names}`;
    trigger.setAttribute('aria-label', `Connect, ${STATUS[session.status].toLowerCase()} with ${session.members.length} ${session.members.length === 1 ? 'person' : 'people'}`);
  };

  // Joins this session to the script, and watches it for the button and card.
  const bind = () => {
    const session = ours();
    if (!session || detach) return;
    detach = session.attach(script);
    lastReason = null;
    stopSession = session.subscribe(() => {
      if (session.status === 'closed' && session.reason && lastReason !== session.reason) {
        lastReason = session.reason;
        toast(session.reason);
      }
      drawTrigger();
      card?.refresh();
    });
  };

  const unbind = () => {
    detach?.();
    stopSession?.();
    detach = null;
    stopSession = null;
  };

  const stopListening = onSessionChange(() => {
    if (!ours()) unbind();
    else bind();
    drawTrigger();
    card?.refresh();
  });

  // --- The card ---

  function openCard() {
    let view = null;
    let timer = 0;
    trigger.setAttribute('aria-expanded', 'true');
    const popover = openPopover(trigger, {
      label: 'Connect',
      onClose: () => {
        clearTimeout(timer);
        trigger?.setAttribute('aria-expanded', 'false');
        card = null;
        script.focus();
      },
    });
    const show = (next) => {
      view = next;
      popover.set(view.nodes);
    };
    card = {
      refresh() {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const session = ours();
          // A session that started or ended elsewhere changes which card shows.
          if (!!session !== view.inSession) show(session ? sessionView() : setupView());
          else view.update?.();
        }, REDRAW_MS);
      },
    };
    show(ours() ? sessionView() : setupView());
    popover.card.dataset.p2p = 'card';

    // Before a session: a server name, a token and your alias, then Host.
    function setupView() {
      const error = banner({ message: lastReason, onDismiss: () => { lastReason = null; } });
      const server = textField({ label: 'Server name', icon: 'pin', value: doc.p2p?.role === 'host' ? doc.p2p.server : randomServerName(), attrs: { 'data-p2p': 'server' } });
      server.root.querySelector('.fl-field-box').append(button({ label: 'Copy server name', icon: 'copy', iconOnly: true, attrs: { 'data-p2p': 'copy-server' }, onClick: () => copy(server.input.value.trim(), 'server name') }));
      const token = tokenField(doc.p2p?.role === 'host' ? doc.p2p.token : randomToken());
      const alias = textField({ label: 'Alias', icon: 'user', value: readAlias(), attrs: { 'data-p2p': 'alias' } });
      const host = button({ label: 'Host', icon: 'connect', cls: 'fl-btn-primary p2p-wide', attrs: { 'data-p2p': 'host' } });
      const route = readRoute();
      const busy = (on, what = host) => {
        for (const control of [server.input, token.input, alias.input, host, rejoin].filter(Boolean)) control.disabled = on;
        what.querySelector('.fl-spinner')?.remove();
        if (on) what.prepend(spinner('Connecting'));
      };
      host.addEventListener('click', async () => {
        error.show(null);
        busy(true);
        saveAlias(alias.input.value);
        try {
          await hostSession({
            docId: doc.id,
            docName: () => doc.name,
            serverName: server.input.value,
            token: token.input.value,
            alias: alias.input.value,
            route,
            text: script.value,
          });
          doc.p2p = { role: 'host', server: currentSession().serverName, token: token.input.value };
          persist();
        } catch (err) {
          busy(false);
          error.show(err.message);
        }
      });
      // A script joined from someone else can join their session again.
      let rejoin = null;
      if (doc.p2p?.role === 'guest') {
        rejoin = button({ label: `Rejoin ${doc.p2p.server}`, icon: 'leave', cls: 'fl-btn-outline p2p-wide', attrs: { 'data-p2p': 'rejoin' } });
        rejoin.addEventListener('click', async () => {
          error.show(null);
          busy(true, rejoin);
          saveAlias(alias.input.value);
          try {
            const { session } = await joinSession({ serverName: doc.p2p.server, token: doc.p2p.token, alias: alias.input.value, route });
            session.docId = doc.id;
            bind();
            drawTrigger();
            card?.refresh();
          } catch (err) {
            busy(false, rejoin);
            error.show(err.message);
          }
        });
      }
      return {
        inSession: false,
        nodes: [
          h('div', { class: 'p2p-head' }, menuHeading('Connect', 'connect')),
          error,
          alias.root,
          routing(server.root, token.root, h('p', { class: 'p2p-note' }, routeNote(route))),
          inviteButton(() => ({ server: server.input.value, token: token.input.value, route })),
          host,
          rejoin,
        ],
      };
    }

    // In a session: its status and details, who's in, and what they've changed.
    function sessionView() {
      const session = ours();
      const chip = h('div', { class: 'p2p-status-row' });
      const notice = banner({ tone: 'info' });
      const server = textField({ label: 'Server name', icon: 'pin', value: session.serverName, readOnly: true, attrs: { 'data-p2p': 'server' } });
      server.root.querySelector('.fl-field-box').append(button({ label: 'Copy server name', icon: 'copy', iconOnly: true, attrs: { 'data-p2p': 'copy-server' }, onClick: () => copy(session.serverName, 'server name') }));
      const token = tokenField(session.token, { readOnly: true });
      // Fixed for the session, like the server name and token.
      const alias = textField({ label: 'Alias', icon: 'user', value: session.self?.alias ?? readAlias(), readOnly: true, attrs: { 'data-p2p': 'alias' } });
      const membersHeading = h('div', { class: 'p2p-section' });
      const members = h('div', { class: 'p2p-members', role: 'list', 'aria-label': 'Members' });
      const changes = h('ol', { class: 'p2p-changes', 'aria-label': 'Changes' });
      const actions = h('div', { class: 'p2p-actions' });

      const update = () => {
        const parsed = parse(session.text);
        chip.replaceChildren(statusChip(session));
        notice.show(session.status === 'closed' ? session.reason ?? 'The session has ended.' : null);
        if (session.self) alias.input.value = session.self.alias;
        membersHeading.replaceChildren(menuHeading(`Members · ${session.members.length}`, 'user'));
        members.replaceChildren(...session.members.map((member) => h('button', {
          type: 'button',
          class: 'p2p-member',
          role: 'listitem',
          title: member.alias,
          'data-member': member.id,
          onclick: () => show(memberView(member.id)),
        }, avatar(member, 34), h('span', { class: 'p2p-member-name' }, member.id === session.self?.id ? 'You' : member.alias))));
        changes.replaceChildren(...(session.activity.length
          ? session.activity.slice(0, 12).map((entry) => h('li', { class: 'p2p-change' },
            avatar(entry, 22),
            h('span', { class: 'p2p-change-text' },
              h('strong', {}, entry.by === session.self?.id ? 'You' : entry.alias),
              h('span', {}, describeChange(entry, parsed))),
            h('time', { class: 'p2p-when', datetime: new Date(entry.at).toISOString() }, timeAgo(entry.at))))
          : [h('li', { class: 'p2p-empty' }, 'No changes yet. Each edit shows here with who made it.')]));
        const done = button({ label: 'Done', cls: 'fl-btn-outline', onClick: () => popover.close() });
        if (session.status === 'closed') {
          actions.replaceChildren(done);
        } else {
          actions.replaceChildren(button({
            label: session.role === 'host' ? 'Stop hosting' : 'Leave',
            icon: 'leave',
            cls: 'fl-btn-outline p2p-danger',
            attrs: { 'data-p2p': 'end' },
            onClick: () => {
              session.end(null);
              popover.close();
            },
          }), done);
        }
      };
      update();
      return {
        inSession: true,
        update,
        nodes: [
          menuHeading('Connect', 'connect'),
          chip,
          notice,
          alias.root,
          routing(server.root, token.root, h('p', { class: 'p2p-note' }, routeNote(session.route))),
          session.active ? inviteButton(() => ({ server: session.serverName, token: session.token, route: session.route })) : null,
          membersHeading,
          members,
          menuHeading('Changes', 'write'),
          changes,
          actions,
        ],
      };
    }

    // One member: their badge and alias, when they joined and what they've changed, and for the
    // host, a way to remove them.
    function memberView(id) {
      const session = ours();
      const body = h('div', { class: 'p2p-detail' });
      const update = () => {
        const member = session.members.find((each) => each.id === id);
        if (!member) {
          body.replaceChildren(h('p', { class: 'p2p-note' }, 'They’ve left the session.'));
          return;
        }
        const { commits, last } = session.contributions(id);
        const you = member.id === session.self?.id;
        body.replaceChildren(...[
          avatar(member, 72),
          h('strong', { class: 'p2p-detail-name' }, member.alias),
          h('span', { class: 'p2p-note' }, [member.host ? 'Host' : 'Guest', you ? 'you' : null].filter(Boolean).join(' · ')),
          h('span', {}, `Connected ${new Date(member.since).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`),
          h('span', { class: 'p2p-note' }, commits ? `${commits} edit${commits === 1 ? '' : 's'}, the last ${timeAgo(last)}` : 'No edits yet'),
          session.role === 'host' && !you && session.active
            ? button({ label: 'Kick', icon: 'user-remove', cls: 'fl-btn-outline p2p-danger p2p-wide', attrs: { 'data-p2p': 'kick' }, onClick: () => {
              session.kick(id);
              toast(`Removed ${member.alias}`);
              show(sessionView());
            } })
            : null,
        ].filter(Boolean));
      };
      update();
      // A small back button inside the banner, where its icon would be.
      const heading = menuHeading('Member');
      heading.prepend(button({ label: 'Back', icon: 'chevron-left', iconOnly: true, cls: 'p2p-back', attrs: { 'data-p2p': 'back' }, onClick: () => show(sessionView()) }));
      return {
        inSession: true,
        update,
        nodes: [heading, body],
      };
    }
  }

  // --- The button ---

  const addWidget = () => {
    if (removeWidget) return;
    trigger = button({ label: 'Connect', icon: 'connect', iconOnly: true, cls: 'p2p-trigger', attrs: { 'data-p2p': 'trigger', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, onClick: () => openCard() });
    removeWidget = script.addWidget({ node: trigger, place: 'top-end', label: 'Connect', cls: 'p2p-widget', css: WIDGET_CSS });
    drawTrigger();
  };
  const removeWidgetNow = () => {
    removeWidget?.();
    removeWidget = null;
    trigger = null;
  };

  const onSetting = () => {
    if (p2pEnabled()) addWidget();
    else {
      removeWidgetNow();
      ours()?.end();
    }
  };
  window.addEventListener('flow-p2p', onSetting);
  onSetting();
  bind();

  return () => {
    window.removeEventListener('flow-p2p', onSetting);
    stopListening();
    const session = ours();
    if (session?.active) {
      session.end(null);
      toast(session.role === 'host' ? 'Stopped hosting' : 'Left the session');
    }
    unbind();
    removeWidgetNow();
  };
}
