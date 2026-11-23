// A PeerJS signal server on this computer, for the P2P tests: the same thing anyone can run with
// `npx peerjs --port 4180` to keep sessions off PeerJS's public server.

import { PeerServer } from 'peer';

PeerServer({ port: 4180, path: '/' });
