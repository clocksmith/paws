# Blueprint 0x000044: WebRTC Swarm Transport

**Objective:** Establish the signalling, connection, and messaging model for peer-to-peer coordination across REPLOID instances.

**Target Upgrade:** WRTS (`webrtc-swarm.js`)

**Prerequisites:** 0x00003A (Swarm Orchestration), 0x000043 (Browser API Integration), signalling server deployment

**Affected Artifacts:** `/upgrades/webrtc-swarm.js`, `/upgrades/webrtc-coordinator.js`, `/styles/dashboard.css`

---

### 1. The Strategic Imperative
Peer-to-peer connectivity unlocks distributed cognition without centralized bottlenecks. The transport layer must:
- Reliably connect agents through WebRTC.
- Provide secure, structured channels for task delegation and knowledge exchange.
- Handle churn and reconnections gracefully.

### 2. Architectural Overview

The WebRTCSwarm module provides peer-to-peer transport layer via WebRTC with real-time bandwidth monitoring through a Web Component widget. It handles WebSocket signalling and per-peer WebRTC data channels for distributed agent coordination.

**Module Architecture:**
```javascript
const WebRTCSwarm = {
  metadata: {
    id: 'WebRTCSwarm',
    version: '1.0.0',
    dependencies: ['Utils', 'StateManager'],
    async: false,
    type: 'service'
  },
  factory: (deps) => {
    const { Utils, StateManager } = deps;
    const { logger } = Utils;

    // Internal state (accessible to widget via closure)
    const CONFIG = {
      signalingServer: 'ws://localhost:8000/signaling',
      roomId: 'reploid-swarm-default',
      reconnectInterval: 5000,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      channelOptions: { ordered: true, maxRetransmits: 3 }
    };

    let peerId = null;
    let peers = new Map(); // Map<peerId, {connection, dataChannel, metadata, status, lastSeen}>
    let signalingWs = null;
    let signalingConnected = false;
    let reconnectTimer = null;
    let messageHandlers = new Map();
    let swarmMetadata = { capabilities: [], goals: [], knowledge: [] };

    // Bandwidth tracking
    const bandwidthStats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      startTime: Date.now(),
      recentActivity: []
    };

    // Core transport functions
    const initialize = async () => {
      peerId = 'reploid-' + Utils.generateId();
      connectToSignalingServer();
      setInterval(sendHeartbeat, 30000);
    };

    const sendToPeer = (remotePeerId, message) => {
      // Send JSON message via data channel
    };

    const broadcast = (message) => {
      // Send to all connected peers
    };

    const delegateTask = async (task) => {
      // Find capable peer and delegate
    };

    // Web Component Widget (defined inside factory to access closure state)
    class WebRTCSwarmWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      getStatus() {
        const connectedPeers = Array.from(peers.values()).filter(p => p.status === 'connected').length;
        const bandwidth = getCurrentBandwidth();
        return {
          state: !signalingConnected ? 'error' : (connectedPeers > 0 ? 'active' : 'idle'),
          primaryMetric: `${connectedPeers} peers`,
          secondaryMetric: bandwidth.total > 0 ? `${bandwidth.total} KB/s` : 'Idle',
          lastActivity: bandwidthStats.recentActivity.length > 0 ? bandwidthStats.recentActivity[0].timestamp : null
        };
      }

      render() {
        this.shadowRoot.innerHTML = `<style>...</style>${this.renderPanel()}`;
      }
    }

    customElements.define('webrtc-swarm-widget', WebRTCSwarmWidget);

    return {
      api: {
        getPeerId: () => peerId,
        getStats,
        sendToPeer,
        broadcast,
        delegateTask,
        shareKnowledge,
        requestConsensus,
        registerMessageHandler,
        updateCapabilities,
        configureSignaling,
        getSignalingStatus,
        disconnect,
        getBandwidthStats,
        getCurrentBandwidth
      },
      widget: {
        element: 'webrtc-swarm-widget',
        displayName: 'WebRTC Swarm',
        icon: '♁',
        category: 'communication',
        updateInterval: 2000
      }
    };
  }
};
```

**Core Transport Features:**

- **Signalling Flow**
  - WebSocket connection to signalling server (`ws://localhost:8000/signaling` by default)
  - Message types: `join`, `offer`, `answer`, `ice-candidate`, `peer-joined`, `peer-left`, `announce`, `broadcast`, `error`
  - `connectToSignalingServer()`: Establishes WebSocket, handles reconnection with backoff
  - `sendSignalingMessage(message)`: Sends JSON messages, validates WebSocket ready state
  - Auto-reconnect with configurable interval (5000ms default)

- **Peer Connection Management**
  - `connectToPeer(remotePeerId, metadata)`: Creates RTCPeerConnection, data channel, sends WebRTC offer
  - `handleOffer(remotePeerId, offer)`: Receives offer, creates answer, establishes connection
  - `handleIceCandidate(remotePeerId, candidate)`: Forwards ICE candidates bidirectionally
  - Peers tracked in Map with: connection, dataChannel, metadata, status, lastSeen
  - Heartbeat mechanism prunes inactive peers (>60s)

- **Data Channel Messaging**
  - `sendToPeer(id, payload)`: Sends JSON-serialized message to specific peer
  - `broadcast(payload)`: Sends to all connected peers, returns count sent
  - `registerMessageHandler(type, handler)`: Allows custom message routing
  - Built-in handlers: `sync-request`, `task-delegation`, `knowledge-share`, `consensus-request`
  - Message tracking for bandwidth statistics

- **High-level Coordination APIs**
  - `delegateTask(task)`: Finds capable peer based on requirements, sends task, awaits result with timeout (60s)
  - `shareKnowledge(artifactId)`: Broadcasts artifact to swarm
  - `requestConsensus(proposal, timeout)`: Collects votes from peers, resolves with majority decision
  - `updateCapabilities(capabilities)`: Updates local metadata, announces presence to swarm

- **Configuration & Lifecycle**
  - `configureSignaling(options)`: Updates server/room/ICE settings, triggers reconnect
  - `getSignalingStatus()`: Returns connection status, server, roomId, peerId
  - `disconnect()`: Sends leave message, closes all peer connections, cleans up WebSocket
  - `initialize()`: Generates unique peerId, connects to signalling, joins room, starts heartbeat

- **Bandwidth Tracking & Statistics**
  - Tracks: messagesSent, messagesReceived, bytesSent, bytesReceived
  - `recentActivity` array: Last 50 sent/received messages with type, size, timestamp
  - `getCurrentBandwidth()`: Calculates KB/s over 10-second window for upload/download
  - `getBandwidthStats()`: Returns complete statistics object
  - Real-time monitoring for network activity visualization

**Web Component Widget Features:**

The `WebRTCSwarmWidget` provides comprehensive transport monitoring and control:
- **Connection Status Panel**: Signalling server status (connected/disconnected), room ID, peer ID, uptime display
- **Bandwidth Monitor**: Real-time upload/download speeds (KB/s), total bandwidth display with 10-second window
- **Message Statistics Grid**: 4-column display showing messages sent/received, data sent/received in KB
- **Connected Peers List**: Scrollable peer list with IDs (truncated), status, last seen time, capabilities
- **Recent Activity Log**: Last 10 messages (sent/received) with type, peer, timestamp
- **Interactive Controls**: Reconnect button when disconnected, Disconnect/Announce Presence when connected
- **Auto-refresh**: Updates every 2 seconds for real-time bandwidth and peer status
- **Visual Feedback**: Color-coded status (green for connected, red for disconnected), activity indicators
- **Dashboard Integration**: `getStatus()` provides summary metrics with current bandwidth

### 3. Implementation Pathway

**Step 1: Module Registration**
```javascript
// In config.json, ensure WebRTCSwarm is registered with dependencies
{
  "modules": {
    "WebRTCSwarm": {
      "dependencies": ["Utils", "StateManager"],
      "enabled": true,
      "async": false
    }
  }
}
```

**Step 2: Factory Function Implementation**

The factory receives dependencies and creates transport logic:
```javascript
factory: (deps) => {
  const { Utils, StateManager } = deps;
  const { logger } = Utils;

  // Configuration
  const CONFIG = {
    signalingServer: 'ws://localhost:8000/signaling',
    roomId: 'reploid-swarm-default',
    reconnectInterval: 5000,
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    channelOptions: { ordered: true, maxRetransmits: 3 }
  };

  // Internal state (accessible to widget via closure)
  let peerId = null;
  let peers = new Map();
  let signalingWs = null;
  let signalingConnected = false;
  let reconnectTimer = null;
  let messageHandlers = new Map();
  let swarmMetadata = { capabilities: [], goals: [], knowledge: [] };

  const bandwidthStats = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    startTime: Date.now(),
    recentActivity: []
  };

  // Initialize on module load
  initialize();

  // Web Component defined here to access closure variables
  class WebRTCSwarmWidget extends HTMLElement { /*...*/ }
  customElements.define('webrtc-swarm-widget', WebRTCSwarmWidget);

  return { api, widget };
}
```

**Step 3: Signalling Server Connection**

Implement WebSocket connection with auto-reconnect:
```javascript
const connectToSignalingServer = () => {
  if (signalingWs) {
    signalingWs.close();
  }

  logger.info(`[WebRTCSwarm] Connecting to signaling server: ${CONFIG.signalingServer}`);

  try {
    signalingWs = new WebSocket(CONFIG.signalingServer);

    signalingWs.onopen = () => {
      logger.info('[WebRTCSwarm] Connected to signaling server');
      signalingConnected = true;

      // Clear reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // Join room
      sendSignalingMessage({
        type: 'join',
        peerId,
        roomId: CONFIG.roomId,
        metadata: swarmMetadata
      });
    };

    signalingWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleSignalingMessage(message);
      } catch (error) {
        logger.error('[WebRTCSwarm] Failed to parse signaling message:', error);
      }
    };

    signalingWs.onerror = (error) => {
      logger.error('[WebRTCSwarm] Signaling WebSocket error:', error);
    };

    signalingWs.onclose = () => {
      logger.warn('[WebRTCSwarm] Disconnected from signaling server');
      signalingConnected = false;

      // Attempt to reconnect
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          logger.info('[WebRTCSwarm] Attempting to reconnect to signaling server');
          connectToSignalingServer();
        }, CONFIG.reconnectInterval);
      }
    };
  } catch (error) {
    logger.error('[WebRTCSwarm] Failed to create WebSocket connection:', error);
    // Schedule reconnect
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        connectToSignalingServer();
      }, CONFIG.reconnectInterval);
    }
  }
};

const sendSignalingMessage = (message) => {
  if (!signalingWs || signalingWs.readyState !== WebSocket.OPEN) {
    logger.warn('[WebRTCSwarm] Cannot send signaling message: not connected');
    return false;
  }

  try {
    signalingWs.send(JSON.stringify(message));
    return true;
  } catch (error) {
    logger.error('[WebRTCSwarm] Failed to send signaling message:', error);
    return false;
  }
};
```

**Step 4: WebRTC Peer Connection Setup**

Implement peer-to-peer connection establishment:
```javascript
const connectToPeer = async (remotePeerId, metadata) => {
  logger.info(`[WebRTCSwarm] Connecting to peer: ${remotePeerId}`);

  const peerConnection = new RTCPeerConnection({
    iceServers: CONFIG.iceServers
  });

  const dataChannel = peerConnection.createDataChannel('reploid-data', CONFIG.channelOptions);

  const peer = {
    id: remotePeerId,
    connection: peerConnection,
    dataChannel,
    metadata,
    status: 'connecting',
    lastSeen: Date.now()
  };

  peers.set(remotePeerId, peer);

  // Set up connection handlers
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignalingMessage({
        type: 'ice-candidate',
        peerId,
        targetPeer: remotePeerId,
        candidate: event.candidate
      });
    }
  };

  dataChannel.onopen = () => {
    logger.info(`[WebRTCSwarm] Data channel opened with ${remotePeerId}`);
    peer.status = 'connected';
    sendToPeer(remotePeerId, { type: 'sync-request' });
  };

  dataChannel.onmessage = (event) => {
    handlePeerMessage(remotePeerId, JSON.parse(event.data));
  };

  dataChannel.onerror = (error) => {
    logger.error(`[WebRTCSwarm] Data channel error with ${remotePeerId}:`, error);
  };

  // Create and send offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  sendSignalingMessage({
    type: 'offer',
    peerId,
    targetPeer: remotePeerId,
    offer
  });
};

const handleOffer = async (remotePeerId, offer) => {
  logger.info(`[WebRTCSwarm] Received offer from ${remotePeerId}`);

  const peerConnection = new RTCPeerConnection({
    iceServers: CONFIG.iceServers
  });

  const peer = {
    id: remotePeerId,
    connection: peerConnection,
    dataChannel: null,
    metadata: {},
    status: 'connecting',
    lastSeen: Date.now()
  };

  peers.set(remotePeerId, peer);

  // Set up ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignalingMessage({
        type: 'ice-candidate',
        peerId,
        targetPeer: remotePeerId,
        candidate: event.candidate
      });
    }
  };

  // Wait for incoming data channel
  peerConnection.ondatachannel = (event) => {
    peer.dataChannel = event.channel;

    event.channel.onopen = () => {
      logger.info(`[WebRTCSwarm] Data channel opened with ${remotePeerId}`);
      peer.status = 'connected';
    };

    event.channel.onmessage = (event) => {
      handlePeerMessage(remotePeerId, JSON.parse(event.data));
    };
  };

  // Set remote description and create answer
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  sendSignalingMessage({
    type: 'answer',
    peerId,
    targetPeer: remotePeerId,
    answer
  });
};

const handleIceCandidate = async (remotePeerId, candidate) => {
  const peer = peers.get(remotePeerId);
  if (peer) {
    await peer.connection.addIceCandidate(candidate);
  }
};
```

**Step 5: Data Channel Messaging**

Implement peer-to-peer messaging with bandwidth tracking:
```javascript
const sendToPeer = (remotePeerId, message) => {
  const peer = peers.get(remotePeerId);

  if (peer && peer.dataChannel && peer.dataChannel.readyState === 'open') {
    const messageStr = JSON.stringify(message);
    peer.dataChannel.send(messageStr);

    // Track bandwidth
    const messageSize = messageStr.length;
    bandwidthStats.messagesSent++;
    bandwidthStats.bytesSent += messageSize;
    bandwidthStats.recentActivity.unshift({
      type: 'sent',
      peer: remotePeerId,
      messageType: message.type,
      size: messageSize,
      timestamp: Date.now()
    });

    // Keep last 50 activities
    if (bandwidthStats.recentActivity.length > 50) {
      bandwidthStats.recentActivity = bandwidthStats.recentActivity.slice(0, 50);
    }

    return true;
  }

  logger.warn(`[WebRTCSwarm] Cannot send to ${remotePeerId} - not connected`);
  return false;
};

const broadcast = (message) => {
  let sent = 0;

  peers.forEach((peer, peerId) => {
    if (sendToPeer(peerId, message)) {
      sent++;
    }
  });

  logger.debug(`[WebRTCSwarm] Broadcast sent to ${sent} peers`);
  return sent;
};

const registerMessageHandler = (messageType, handler) => {
  messageHandlers.set(messageType, handler);
  logger.debug(`[WebRTCSwarm] Registered handler for: ${messageType}`);
};

const handlePeerMessage = async (remotePeerId, message) => {
  logger.debug(`[WebRTCSwarm] Message from ${remotePeerId}:`, message.type);

  const peer = peers.get(remotePeerId);
  if (peer) {
    peer.lastSeen = Date.now();
  }

  // Track received message
  const messageSize = JSON.stringify(message).length;
  bandwidthStats.messagesReceived++;
  bandwidthStats.bytesReceived += messageSize;
  bandwidthStats.recentActivity.unshift({
    type: 'received',
    peer: remotePeerId,
    messageType: message.type,
    size: messageSize,
    timestamp: Date.now()
  });

  if (bandwidthStats.recentActivity.length > 50) {
    bandwidthStats.recentActivity = bandwidthStats.recentActivity.slice(0, 50);
  }

  // Route message to appropriate handler
  const handler = messageHandlers.get(message.type);
  if (handler) {
    await handler(remotePeerId, message);
  } else {
    // Default handlers for common message types
    switch (message.type) {
      case 'sync-request':
        await handleSyncRequest(remotePeerId);
        break;
      // ... more default handlers
    }
  }
};
```

**Step 6: High-level Coordination APIs**

Implement task delegation, knowledge sharing, and consensus:
```javascript
const delegateTask = async (task) => {
  logger.info(`[WebRTCSwarm] Delegating task: ${task.name}`);

  const taskWithId = {
    ...task,
    id: Utils.generateId(),
    delegator: peerId,
    timestamp: Date.now()
  };

  // Find capable peer
  const capablePeer = findCapablePeer(task.requirements);

  if (capablePeer) {
    sendToPeer(capablePeer, {
      type: 'task-delegation',
      task: taskWithId
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Task delegation timeout'));
      }, 60000);

      messageHandlers.set(`task-complete-${taskWithId.id}`, (remotePeerId, message) => {
        clearTimeout(timeout);
        resolve(message.result);
      });
    });
  } else {
    throw new Error('No capable peer found for task');
  }
};

const shareKnowledge = async (artifactId) => {
  const artifact = await StateManager.getArtifactMetadata(artifactId);
  const content = await StateManager.getArtifactContent(artifactId);

  if (!artifact || !content) {
    throw new Error(`Artifact not found: ${artifactId}`);
  }

  const shared = broadcast({
    type: 'knowledge-share',
    knowledge: {
      type: 'artifact',
      id: artifactId,
      artifactType: artifact.type,
      content,
      sharedBy: peerId,
      timestamp: Date.now()
    }
  });

  logger.info(`[WebRTCSwarm] Shared ${artifactId} with ${shared} peers`);
  return shared;
};

const requestConsensus = async (proposal, timeout = 30000) => {
  logger.info(`[WebRTCSwarm] Requesting consensus for: ${proposal.type}`);

  const proposalWithId = {
    ...proposal,
    id: Utils.generateId(),
    proposer: peerId,
    timestamp: Date.now()
  };

  broadcast({
    type: 'consensus-request',
    proposal: proposalWithId
  });

  // Collect votes
  return new Promise((resolve) => {
    const votes = new Map();
    votes.set(peerId, true); // Self vote

    const checkConsensus = () => {
      const totalPeers = peers.size + 1;
      const yesVotes = Array.from(votes.values()).filter(v => v).length;
      const noVotes = Array.from(votes.values()).filter(v => !v).length;

      if (yesVotes > totalPeers / 2) {
        resolve({ consensus: true, votes: Object.fromEntries(votes) });
      } else if (noVotes >= totalPeers / 2) {
        resolve({ consensus: false, votes: Object.fromEntries(votes) });
      }
    };

    messageHandlers.set(`consensus-vote-${proposalWithId.id}`, (remotePeerId, message) => {
      votes.set(message.peerId, message.vote);
      checkConsensus();
    });

    setTimeout(() => {
      resolve({ consensus: false, votes: Object.fromEntries(votes), timeout: true });
    }, timeout);
  });
};

const findCapablePeer = (requirements) => {
  for (const [peerId, peer] of peers) {
    if (peer.status === 'connected' && peer.metadata.capabilities) {
      const capable = requirements.every(req =>
        peer.metadata.capabilities.includes(req)
      );

      if (capable) return peerId;
    }
  }
  return null;
};
```

**Step 7: Bandwidth Monitoring**

Implement real-time bandwidth calculation:
```javascript
const getCurrentBandwidth = () => {
  const now = Date.now();
  const windowMs = 10000; // 10 second window
  const recentActivity = bandwidthStats.recentActivity.filter(
    a => now - a.timestamp < windowMs
  );

  const sent = recentActivity.filter(a => a.type === 'sent').reduce((sum, a) => sum + a.size, 0);
  const received = recentActivity.filter(a => a.type === 'received').reduce((sum, a) => sum + a.size, 0);

  // Convert to KB/s
  const sentKBps = Math.round((sent / windowMs) * 1000 / 1024 * 10) / 10;
  const receivedKBps = Math.round((received / windowMs) * 1000 / 1024 * 10) / 10;
  const totalKBps = Math.round((sentKBps + receivedKBps) * 10) / 10;

  return { sent: sentKBps, received: receivedKBps, total: totalKBps };
};

const getBandwidthStats = () => ({ ...bandwidthStats });

const sendHeartbeat = () => {
  sendSignalingMessage({
    type: 'heartbeat',
    peerId,
    roomId: CONFIG.roomId
  });

  // Check for stale peers
  const now = Date.now();
  peers.forEach((peer, peerId) => {
    if (now - peer.lastSeen > 60000) {
      logger.warn(`[WebRTCSwarm] Peer ${peerId} is stale, removing`);
      peer.connection.close();
      peers.delete(peerId);
    }
  });
};
```

**Step 8: Web Component Widget**

The widget provides real-time transport monitoring:
```javascript
class WebRTCSwarmWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const connectedPeers = Array.from(peers.values()).filter(p => p.status === 'connected').length;
    const bandwidth = getCurrentBandwidth();

    let state = 'disabled';
    if (!signalingConnected) state = 'error';
    else if (connectedPeers > 0) state = 'active';
    else state = 'idle';

    return {
      state,
      primaryMetric: `${connectedPeers} peer${connectedPeers !== 1 ? 's' : ''}`,
      secondaryMetric: bandwidth.total > 0 ? `${bandwidth.total} KB/s` : 'Idle',
      lastActivity: bandwidthStats.recentActivity.length > 0 ? bandwidthStats.recentActivity[0].timestamp : null,
      message: !signalingConnected ? 'Not connected to signaling server' : null
    };
  }

  renderPanel() {
    const stats = getStats();
    const bandwidth = getCurrentBandwidth();
    const uptimeSeconds = Math.floor((Date.now() - bandwidthStats.startTime) / 1000);

    return `
      <div class="widget-panel-content">
        <!-- Connection Status -->
        <div class="connection-status">
          <div>Signaling: ${signalingConnected ? '✓ Connected' : '✗ Disconnected'}</div>
          <div>Room: ${CONFIG.roomId}</div>
          <div>Peer ID: ${peerId}</div>
          <div>Uptime: ${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m</div>
        </div>

        <!-- Bandwidth Stats -->
        <div class="bandwidth-section">
          <h4>Bandwidth</h4>
          <div>↑ Upload: ${bandwidth.sent} KB/s</div>
          <div>↓ Download: ${bandwidth.received} KB/s</div>
          <div>Total: ${bandwidth.total} KB/s</div>
        </div>

        <!-- Message Statistics -->
        <div class="message-stats">
          <h4>Message Statistics</h4>
          <div>Sent: ${bandwidthStats.messagesSent}</div>
          <div>Received: ${bandwidthStats.messagesReceived}</div>
          <div>Data Sent: ${Math.round(bandwidthStats.bytesSent / 1024)} KB</div>
          <div>Data Received: ${Math.round(bandwidthStats.bytesReceived / 1024)} KB</div>
        </div>

        <!-- Connected Peers -->
        <div class="peers-section">
          <h4>Connected Peers (${stats.connectedPeers})</h4>
          ${stats.peers.length === 0 ? `
            <div class="no-peers">No peers connected</div>
          ` : `
            <div class="peer-list">
              ${stats.peers.map(peer => `
                <div class="peer-item ${peer.status}">
                  <div>${peer.id.substring(0, 12)}...</div>
                  <div>Status: ${peer.status}</div>
                  <div>Last seen: ${Math.floor((Date.now() - peer.lastSeen) / 1000)}s ago</div>
                  ${peer.capabilities.length > 0 ? `<div>Caps: ${peer.capabilities.join(', ')}</div>` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Recent Activity -->
        ${bandwidthStats.recentActivity.length > 0 ? `
          <div class="activity-section">
            <h4>Recent Activity</h4>
            ${bandwidthStats.recentActivity.slice(0, 10).map(activity => `
              <div class="activity-item ${activity.type}">
                ${activity.type === 'sent' ? '↑' : '↓'} ${activity.messageType} - ${activity.peer.substring(0, 8)}...
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Control Buttons -->
        <div style="display: grid; grid-template-columns: ${signalingConnected ? '2' : '1'}fr; gap: 8px; margin-top: 16px;">
          ${!signalingConnected ? `
            <button class="reconnect-btn">↻ Reconnect</button>
          ` : ''}
          ${signalingConnected ? `
            <button class="disconnect-btn">⏹️ Disconnect</button>
            <button class="announce-btn">⚠ Announce Presence</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-content">${this.renderPanel()}</div>
    `;

    // Wire up buttons
    const reconnectBtn = this.shadowRoot.querySelector('.reconnect-btn');
    if (reconnectBtn) {
      reconnectBtn.addEventListener('click', () => {
        connectToSignalingServer();
        this.render();
      });
    }

    const disconnectBtn = this.shadowRoot.querySelector('.disconnect-btn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        disconnect();
        this.render();
      });
    }

    const announceBtn = this.shadowRoot.querySelector('.announce-btn');
    if (announceBtn) {
      announceBtn.addEventListener('click', () => {
        announcePresence();
      });
    }
  }
}
```

**Step 9: Integration Points**

1. **Signalling Server Deployment**:
   - Deploy WebSocket server that routes messages (room join, offer, answer, ICE)
   - Implement authentication (API key, session tokens)
   - Configure CORS and security headers

2. **Integration with WebRTCCoordinator**:
   - WebRTCCoordinator calls `updateCapabilities()` when local features change
   - Routes task delegation, knowledge sharing via registered message handlers
   - Uses `delegateTask`, `shareKnowledge`, `requestConsensus` APIs

3. **Dashboard Integration**:
   - Widget automatically integrates with module dashboard system
   - Provides `getStatus()` method for dashboard summary view
   - Updates every 2 seconds via `updateInterval: 2000`

4. **Security Considerations**:
   - Gate enabling Swarm behind user toggle (default off)
   - Warn about network exposure when enabling
   - Validate incoming payloads; reject code with `eval()`
   - Use DTLS/SRTP encryption (handled by WebRTC)
   - Limit file access to safe prefixes when executing remote requests

5. **Resilience & Observability**:
   - Adjustable reconnect interval; log reconnection attempts
   - On reconnect, rejoin room and renegotiate peers
   - Emit events for connection status, peer counts, tasks delegated
   - Provide UI surfaces to inspect peer metadata and capabilities

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
