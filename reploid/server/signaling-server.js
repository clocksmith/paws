#!/usr/bin/env node

/**
 * WebRTC Signaling Server for PAWS/REPLOID Swarm
 *
 * Enables peer-to-peer WebRTC connections across different origins
 * by providing a centralized signaling channel via WebSockets.
 *
 * Features:
 * - WebSocket-based signaling (replaces BroadcastChannel)
 * - Room-based peer discovery
 * - Automatic peer cleanup on disconnect
 * - Heartbeat monitoring
 * - CORS-aware for cross-origin support
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

class SignalingServer extends EventEmitter {
  constructor(server, options = {}) {
    super();

    this.options = {
      path: options.path || '/signaling',
      heartbeatInterval: options.heartbeatInterval || 30000,
      peerTimeout: options.peerTimeout || 60000,
      ...options
    };

    // WebSocket server
    this.wss = new WebSocketServer({
      server,
      path: this.options.path
    });

    // Room management
    this.rooms = new Map(); // roomId -> Set<peerId>
    this.peers = new Map(); // peerId -> { ws, metadata, lastSeen, roomId }

    // Setup WebSocket handlers
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    // Setup heartbeat monitoring
    this.startHeartbeatMonitor();

    console.log(`[SignalingServer] WebRTC signaling server started on ${this.options.path}`);
  }

  handleConnection(ws, req) {
    console.log(`[SignalingServer] New connection from ${req.socket.remoteAddress}`);

    let peerId = null;
    let roomId = null;

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message, { peerId, roomId });

        // Update peerId and roomId if they changed
        if (message.type === 'join') {
          peerId = message.peerId;
          roomId = message.roomId;
        }
      } catch (error) {
        console.error('[SignalingServer] Failed to parse message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      if (peerId) {
        console.log(`[SignalingServer] Peer ${peerId} disconnected`);
        this.removePeer(peerId, roomId);
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[SignalingServer] WebSocket error for peer ${peerId}:`, error);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'welcome',
      timestamp: Date.now()
    });
  }

  handleMessage(ws, message, context) {
    const { type } = message;

    switch (type) {
      case 'join':
        this.handleJoin(ws, message);
        break;

      case 'leave':
        this.handleLeave(message);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.handleSignaling(message);
        break;

      case 'announce':
        this.handleAnnounce(message);
        break;

      case 'heartbeat':
        this.handleHeartbeat(message);
        break;

      case 'broadcast':
        this.handleBroadcast(message);
        break;

      default:
        console.warn(`[SignalingServer] Unknown message type: ${type}`);
    }
  }

  handleJoin(ws, message) {
    const { peerId, roomId, metadata } = message;

    if (!peerId || !roomId) {
      return this.sendError(ws, 'Missing peerId or roomId');
    }

    console.log(`[SignalingServer] Peer ${peerId} joining room ${roomId}`);

    // Remove peer from old room if exists
    if (this.peers.has(peerId)) {
      const oldPeer = this.peers.get(peerId);
      this.removePeerFromRoom(peerId, oldPeer.roomId);
    }

    // Add peer to new room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(peerId);

    // Store peer info
    this.peers.set(peerId, {
      ws,
      metadata: metadata || {},
      lastSeen: Date.now(),
      roomId
    });

    // Notify peer of successful join
    this.sendMessage(ws, {
      type: 'joined',
      peerId,
      roomId,
      peers: Array.from(this.rooms.get(roomId)).filter(id => id !== peerId)
    });

    // Notify other peers in room
    this.broadcastToRoom(roomId, {
      type: 'peer-joined',
      peerId,
      metadata
    }, peerId);

    this.emit('peer-joined', { peerId, roomId, metadata });
  }

  handleLeave(message) {
    const { peerId, roomId } = message;

    if (!peerId || !roomId) {
      return;
    }

    console.log(`[SignalingServer] Peer ${peerId} leaving room ${roomId}`);
    this.removePeer(peerId, roomId);
  }

  handleSignaling(message) {
    const { targetPeer, peerId } = message;

    if (!targetPeer) {
      console.warn('[SignalingServer] Signaling message missing targetPeer');
      return;
    }

    const peer = this.peers.get(targetPeer);
    if (!peer) {
      console.warn(`[SignalingServer] Target peer ${targetPeer} not found`);
      return;
    }

    // Forward signaling message to target peer
    this.sendMessage(peer.ws, message);

    // Update sender's last seen
    if (peerId && this.peers.has(peerId)) {
      this.peers.get(peerId).lastSeen = Date.now();
    }
  }

  handleAnnounce(message) {
    const { peerId, roomId, metadata } = message;

    if (!peerId || !roomId) {
      return;
    }

    // Update peer metadata
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.metadata = { ...peer.metadata, ...metadata };
      peer.lastSeen = Date.now();

      // Broadcast announcement to room
      this.broadcastToRoom(roomId, {
        type: 'peer-announced',
        peerId,
        metadata: peer.metadata
      }, peerId);
    }
  }

  handleHeartbeat(message) {
    const { peerId } = message;

    if (!peerId) {
      return;
    }

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
    }
  }

  handleBroadcast(message) {
    const { peerId, roomId, data } = message;

    if (!peerId || !roomId || !data) {
      return;
    }

    // Broadcast message to all peers in room except sender
    this.broadcastToRoom(roomId, {
      type: 'broadcast',
      peerId,
      data
    }, peerId);
  }

  removePeer(peerId, roomId) {
    const peer = this.peers.get(peerId);

    if (peer) {
      // Remove from room
      this.removePeerFromRoom(peerId, roomId || peer.roomId);

      // Remove peer entry
      this.peers.delete(peerId);

      this.emit('peer-left', { peerId, roomId: roomId || peer.roomId });
    }
  }

  removePeerFromRoom(peerId, roomId) {
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(peerId);

      // Notify other peers
      this.broadcastToRoom(roomId, {
        type: 'peer-left',
        peerId
      });

      // Clean up empty rooms
      if (room.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[SignalingServer] Room ${roomId} is now empty, removed`);
      }
    }
  }

  broadcastToRoom(roomId, message, excludePeerId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    let sent = 0;
    room.forEach(peerId => {
      if (peerId !== excludePeerId) {
        const peer = this.peers.get(peerId);
        if (peer && peer.ws.readyState === WebSocket.OPEN) {
          this.sendMessage(peer.ws, message);
          sent++;
        }
      }
    });

    return sent;
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[SignalingServer] Failed to send message:', error);
      }
    }
  }

  sendError(ws, errorMessage) {
    this.sendMessage(ws, {
      type: 'error',
      error: errorMessage,
      timestamp: Date.now()
    });
  }

  startHeartbeatMonitor() {
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = now - this.options.peerTimeout;

      // Find and remove stale peers
      const stalePeers = [];
      this.peers.forEach((peer, peerId) => {
        if (peer.lastSeen < staleThreshold) {
          stalePeers.push({ peerId, roomId: peer.roomId });
        }
      });

      stalePeers.forEach(({ peerId, roomId }) => {
        console.log(`[SignalingServer] Peer ${peerId} is stale, removing`);
        this.removePeer(peerId, roomId);
      });

      if (stalePeers.length > 0) {
        console.log(`[SignalingServer] Removed ${stalePeers.length} stale peers`);
      }
    }, this.options.heartbeatInterval);
  }

  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalPeers: this.peers.size,
      rooms: Array.from(this.rooms.entries()).map(([roomId, peers]) => ({
        roomId,
        peerCount: peers.size,
        peers: Array.from(peers)
      }))
    };
  }

  close() {
    console.log('[SignalingServer] Shutting down signaling server');

    // Notify all peers
    this.peers.forEach(peer => {
      this.sendMessage(peer.ws, {
        type: 'server-shutdown'
      });
      peer.ws.close();
    });

    // Close WebSocket server
    this.wss.close();

    // Clear data structures
    this.rooms.clear();
    this.peers.clear();
  }
}

export default SignalingServer;
