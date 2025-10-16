# Blueprint 0x000044: WebRTC Swarm Transport

**Objective:** Establish the signalling, connection, and messaging model for peer-to-peer coordination across REPLOID instances.

**Target Upgrade:** WRTC (`webrtc-swarm.js`)

**Prerequisites:** 0x00003A (Swarm Orchestration), 0x000043 (Browser API Integration), signalling server deployment

**Affected Artifacts:** `/upgrades/webrtc-swarm.js`, `/upgrades/swarm-orchestrator.js`, `/styles/dashboard.css`

---

### 1. The Strategic Imperative
Peer-to-peer connectivity unlocks distributed cognition without centralized bottlenecks. The transport layer must:
- Reliably connect agents through WebRTC.
- Provide secure, structured channels for task delegation and knowledge exchange.
- Handle churn and reconnections gracefully.

### 2. Architectural Overview
`WebRTCSwarm` handles signalling (WebSocket) and per-peer WebRTC data channels.

```javascript
const SwarmTransport = await ModuleLoader.getModule('WebRTCSwarm');
const stats = SwarmTransport.api.getStats();
```

Key components:
- **Configuration**
  - Default signalling server `ws://localhost:8000/signaling` (configurable).
  - ICE servers preloaded with Google STUN; TURN optional.
  - Data channels created with ordered delivery and limited retransmits.
- **Lifecycle**
  - `initialize()` generates peerId, connects to signalling, joins room, sets heartbeat.
  - Reconnect timer triggered on signalling disconnect.
  - `configureSignaling()` updates server/room/ICE at runtime (reconnects).
- **Signalling Flow**
  - Message types: `join`, `offer`, `answer`, `ice-candidate`, `peer-joined`, `peer-left`, `announce`, `broadcast`, `error`.
  - `connectToPeer()` creates RTCPeerConnection, data channel, sends offer.
  - Incoming offers create answer; ICE candidates forwarded bi-directionally.
  - `sendSignalingMessage()` ensures ready state; logs failures.
- **Peer Management**
  - `peers` map tracks connection, data channel, metadata, status, lastSeen.
  - Heartbeat prunes peers inactive >60s.
  - `updateCapabilities()` stores local capability metadata and announces presence.
- **Messaging**
  - `sendToPeer(id, payload)` / `broadcast(payload)` serialise JSON to data channel.
  - `registerMessageHandler(type, handler)` allows Swarm Orchestrator to hook custom protocols.
  - Built-in handlers: sync, task delegation, knowledge sharing, consensus votes.
- **High-level APIs**
  - `delegateTask`, `shareKnowledge`, `requestConsensus`, `getStats`, `getSignalingStatus`, `disconnect`.

### 3. Implementation Pathway
1. **Signalling Server**
   - Deploy WebSocket server that routes messages (room join, offer, answer, ICE).
   - Harden against unauthorized access (authentication TBD, maybe API key).
2. **Security + Safety**
   - Gate enabling Swarm behind user toggle (default off) and warn about network exposure.
   - Validate incoming payloads; reject code with `eval` etc. (already partially handled by `evaluateArtifact`).
   - Consider encrypted channels (DTLS/SRTP handled by WebRTC).
3. **Integration with Swarm Orchestrator**
   - Update capability metadata when upgrades change (Pyodide ready, local LLM).
   - Route messages via `SwarmOrchestrator.registerMessageHandler`.
4. **Resilience**
   - Keep reconnect interval adjustable; log reconnection attempts.
   - On reconnect, rejoin room and renegotiate peers.
5. **Observability**
   - Emit events or integrate with metrics to display connection status, peer counts, tasks delegated.
   - Provide UI surfaces to inspect peer metadata.

### 4. Verification Checklist
- [ ] New peer join triggers offer/answer exchange and data channel open.
- [ ] Broadcast sends to all connected peers; sendToPeer returns false when channel closed.
- [ ] Heartbeat removes stale peers and attempts reconnection when signaling drops.
- [ ] `delegateTask` resolves or times out; message handlers clean up after completion.
- [ ] `configureSignaling` updates config and reconnects without page reload.

### 5. Extension Opportunities
- Add TURN configuration UI for NAT traversal.
- Integrate authentication tokens into signalling handshake.
- Support file chunk transfer over data channels for artifact sync.
- Provide metrics for bandwidth/latency per peer.

Maintain this blueprint alongside transport protocol changes or new message types.
