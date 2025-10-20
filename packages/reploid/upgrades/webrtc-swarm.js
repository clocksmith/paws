// @blueprint 0x00003E - Implements WebRTC swarm transport.
// WebRTC Swarm Module for REPLOID
// Enables peer-to-peer communication between multiple agent instances

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

    // Swarm configuration
    const CONFIG = {
      signalingServer: 'ws://localhost:8000/signaling', // WebSocket signaling server
      roomId: 'reploid-swarm-default', // Default room ID
      reconnectInterval: 5000, // Reconnect interval in ms
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
        // TURN servers can be added here:
        // { urls: 'turn:turnserver.example.com:3478', username: 'user', credential: 'pass' }
      ],
      channelOptions: {
        ordered: true,
        maxRetransmits: 3
      }
    };

    // Swarm state
    let peerId = null;
    let peers = new Map();
    let signalingWs = null;
    let signalingConnected = false;
    let reconnectTimer = null;
    let messageHandlers = new Map();
    let swarmMetadata = {
      capabilities: [],
      goals: [],
      knowledge: []
    };
    
    // Initialize swarm
    const initialize = async () => {
      logger.info('[WebRTCSwarm] Initializing swarm module');

      // Generate unique peer ID
      peerId = 'reploid-' + Utils.generateId();
      logger.info(`[WebRTCSwarm] Local peer ID: ${peerId}`);

      // Connect to signaling server
      connectToSignalingServer();

      // Set up periodic heartbeat
      setInterval(sendHeartbeat, 30000);

      logger.info('[WebRTCSwarm] Swarm initialized');
    };

    // Connect to WebSocket signaling server
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

        // Attempt to reconnect
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            connectToSignalingServer();
          }, CONFIG.reconnectInterval);
        }
      }
    };

    // Send message through signaling server
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
    
    // Announce presence to other peers
    const announcePresence = () => {
      logger.debug('[WebRTCSwarm] Announcing presence to swarm');

      sendSignalingMessage({
        type: 'announce',
        peerId,
        roomId: CONFIG.roomId,
        metadata: swarmMetadata
      });
    };

    // Handle signaling messages from server
    const handleSignalingMessage = async (message) => {
      const { type } = message;

      switch (type) {
        case 'welcome':
          logger.debug('[WebRTCSwarm] Received welcome from signaling server');
          break;

        case 'joined':
          logger.info(`[WebRTCSwarm] Joined room ${message.roomId}`);
          // Connect to existing peers
          if (message.peers && message.peers.length > 0) {
            logger.info(`[WebRTCSwarm] Found ${message.peers.length} existing peers`);
            message.peers.forEach(remotePeerId => {
              connectToPeer(remotePeerId, {});
            });
          }
          break;

        case 'peer-joined':
          // New peer joined, they will initiate connection
          logger.info(`[WebRTCSwarm] Peer ${message.peerId} joined room`);
          break;

        case 'peer-left':
          handlePeerLeft(message.peerId);
          break;

        case 'peer-announced':
          handlePeerAnnouncement(message.peerId, message.metadata);
          break;

        case 'offer':
          await handleOffer(message.peerId, message.offer);
          break;

        case 'answer':
          await handleAnswer(message.peerId, message.answer);
          break;

        case 'ice-candidate':
          await handleIceCandidate(message.peerId, message.candidate);
          break;

        case 'broadcast':
          await handlePeerMessage(message.peerId, message.data);
          break;

        case 'error':
          logger.error(`[WebRTCSwarm] Signaling error: ${message.error}`);
          break;

        case 'server-shutdown':
          logger.warn('[WebRTCSwarm] Signaling server is shutting down');
          break;

        default:
          logger.warn(`[WebRTCSwarm] Unknown signaling message type: ${type}`);
      }
    };

    // Handle peer leaving
    const handlePeerLeft = (remotePeerId) => {
      logger.info(`[WebRTCSwarm] Peer ${remotePeerId} left`);

      const peer = peers.get(remotePeerId);
      if (peer) {
        if (peer.connection) {
          peer.connection.close();
        }
        peers.delete(remotePeerId);
      }
    };
    
    // Handle new peer announcement
    const handlePeerAnnouncement = async (remotePeerId, metadata) => {
      logger.info(`[WebRTCSwarm] Discovered peer: ${remotePeerId}`);
      
      if (!peers.has(remotePeerId)) {
        // Initiate connection to new peer
        await connectToPeer(remotePeerId, metadata);
      }
    };
    
    // Connect to a peer
    const connectToPeer = async (remotePeerId, metadata) => {
      logger.info(`[WebRTCSwarm] Connecting to peer: ${remotePeerId}`);
      
      const peerConnection = new RTCPeerConnection(CONFIG);
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
    
    // Handle incoming offer
    const handleOffer = async (remotePeerId, offer) => {
      logger.info(`[WebRTCSwarm] Received offer from ${remotePeerId}`);
      
      const peerConnection = new RTCPeerConnection(CONFIG);
      
      const peer = {
        id: remotePeerId,
        connection: peerConnection,
        dataChannel: null,
        metadata: {},
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
    
    // Handle incoming answer
    const handleAnswer = async (remotePeerId, answer) => {
      logger.debug(`[WebRTCSwarm] Received answer from ${remotePeerId}`);
      
      const peer = peers.get(remotePeerId);
      if (peer) {
        await peer.connection.setRemoteDescription(answer);
      }
    };
    
    // Handle ICE candidate
    const handleIceCandidate = async (remotePeerId, candidate) => {
      const peer = peers.get(remotePeerId);
      if (peer) {
        await peer.connection.addIceCandidate(candidate);
      }
    };
    
    // Handle messages from peers
    const handlePeerMessage = async (remotePeerId, message) => {
      logger.debug(`[WebRTCSwarm] Message from ${remotePeerId}:`, message.type);
      
      const peer = peers.get(remotePeerId);
      if (peer) {
        peer.lastSeen = Date.now();
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
          case 'sync-response':
            await handleSyncResponse(remotePeerId, message.data);
            break;
          case 'task-delegation':
            await handleTaskDelegation(remotePeerId, message.task);
            break;
          case 'knowledge-share':
            await handleKnowledgeShare(remotePeerId, message.knowledge);
            break;
          case 'consensus-request':
            await handleConsensusRequest(remotePeerId, message.proposal);
            break;
        }
      }
    };
    
    // Handle sync request from peer
    const handleSyncRequest = async (remotePeerId) => {
      logger.info(`[WebRTCSwarm] Sync request from ${remotePeerId}`);
      
      const state = StateManager.getState();
      const artifacts = await StateManager.getAllArtifactMetadata();
      
      sendToPeer(remotePeerId, {
        type: 'sync-response',
        data: {
          state: {
            totalCycles: state.totalCycles,
            currentGoal: state.currentGoal
          },
          artifacts: artifacts.map(a => ({
            id: a.id,
            type: a.type,
            lastModified: a.lastModified
          })),
          capabilities: swarmMetadata.capabilities
        }
      });
    };
    
    // Handle sync response from peer
    const handleSyncResponse = async (remotePeerId, data) => {
      logger.info(`[WebRTCSwarm] Sync response from ${remotePeerId}`);
      
      const peer = peers.get(remotePeerId);
      if (peer) {
        peer.metadata = { ...peer.metadata, ...data };
      }
      
      // Check for interesting artifacts or capabilities
      if (data.artifacts) {
        await evaluateSharedKnowledge(remotePeerId, data.artifacts);
      }
    };
    
    // Handle task delegation from peer
    const handleTaskDelegation = async (remotePeerId, task) => {
      logger.info(`[WebRTCSwarm] Task delegation from ${remotePeerId}:`, task.name);
      
      // Evaluate if we can handle this task
      const canHandle = await evaluateTaskCapability(task);
      
      if (canHandle) {
        // Accept task and execute
        sendToPeer(remotePeerId, {
          type: 'task-accepted',
          taskId: task.id
        });
        
        const result = await executeTask(task);
        
        sendToPeer(remotePeerId, {
          type: 'task-complete',
          taskId: task.id,
          result
        });
      } else {
        // Decline task
        sendToPeer(remotePeerId, {
          type: 'task-declined',
          taskId: task.id,
          reason: 'Insufficient capabilities'
        });
      }
    };
    
    // Handle knowledge sharing from peer
    const handleKnowledgeShare = async (remotePeerId, knowledge) => {
      logger.info(`[WebRTCSwarm] Knowledge share from ${remotePeerId}`);
      
      // Evaluate and potentially integrate shared knowledge
      if (knowledge.type === 'artifact') {
        const shouldIntegrate = await evaluateArtifact(knowledge.content);
        
        if (shouldIntegrate) {
          await StateManager.createArtifact(
            knowledge.id,
            knowledge.artifactType,
            knowledge.content,
            `Shared from peer ${remotePeerId}`
          );
          
          logger.info(`[WebRTCSwarm] Integrated artifact: ${knowledge.id}`);
        }
      }
    };
    
    // Handle consensus request from peer
    const handleConsensusRequest = async (remotePeerId, proposal) => {
      logger.info(`[WebRTCSwarm] Consensus request from ${remotePeerId}:`, proposal.type);
      
      // Evaluate proposal
      const vote = await evaluateProposal(proposal);
      
      sendToPeer(remotePeerId, {
        type: 'consensus-vote',
        proposalId: proposal.id,
        vote,
        peerId
      });
    };
    
    // Send message to specific peer
    const sendToPeer = (remotePeerId, message) => {
      const peer = peers.get(remotePeerId);
      
      if (peer && peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
        return true;
      }
      
      logger.warn(`[WebRTCSwarm] Cannot send to ${remotePeerId} - not connected`);
      return false;
    };
    
    // Broadcast message to all connected peers
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
    
    // Delegate task to swarm
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
    
    // Share knowledge with swarm
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
    
    // Request consensus from swarm
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
    
    // Find peer capable of handling task
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
    
    // Evaluate if we can handle a task
    const evaluateTaskCapability = async (task) => {
      // Check if we have required capabilities
      if (task.requirements) {
        return task.requirements.every(req => 
          swarmMetadata.capabilities.includes(req)
        );
      }
      return true;
    };
    
    // Execute delegated task
    const executeTask = async (task) => {
      logger.info(`[WebRTCSwarm] Executing delegated task: ${task.name}`);
      
      // This would interface with the tool runner
      // For now, return a placeholder
      return {
        success: true,
        taskId: task.id,
        result: `Task ${task.name} completed`,
        executor: peerId
      };
    };
    
    // Evaluate shared knowledge
    const evaluateSharedKnowledge = async (remotePeerId, artifacts) => {
      // Check for artifacts we don't have
      const localArtifacts = await StateManager.getAllArtifactMetadata();
      const localIds = new Set(localArtifacts.map(a => a.id));
      
      const missing = artifacts.filter(a => !localIds.has(a.id));
      
      if (missing.length > 0) {
        logger.info(`[WebRTCSwarm] Found ${missing.length} new artifacts from ${remotePeerId}`);
        
        // Request interesting artifacts
        missing.slice(0, 5).forEach(artifact => {
          sendToPeer(remotePeerId, {
            type: 'artifact-request',
            artifactId: artifact.id
          });
        });
      }
    };
    
    // Evaluate artifact for integration
    const evaluateArtifact = async (content) => {
      // Basic safety check - could be enhanced
      if (content.includes('eval(') || content.includes('Function(')) {
        logger.warn('[WebRTCSwarm] Rejected potentially unsafe artifact');
        return false;
      }
      return true;
    };
    
    // Evaluate proposal for consensus
    const evaluateProposal = async (proposal) => {
      // Basic evaluation logic - could be enhanced
      switch (proposal.type) {
        case 'goal-change':
          // Accept goal changes that align with current objectives
          return true;
        case 'code-modification':
          // Evaluate code safety
          return !proposal.content.includes('eval(');
        default:
          return false;
      }
    };
    
    // Send heartbeat to maintain connections
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
    
    // Update peer status
    const updatePeerStatus = (remotePeerId, status) => {
      const peer = peers.get(remotePeerId);
      if (peer) {
        peer.lastSeen = Date.now();
        if (status) peer.status = status;
      }
    };
    
    // Register custom message handler
    const registerMessageHandler = (messageType, handler) => {
      messageHandlers.set(messageType, handler);
      logger.debug(`[WebRTCSwarm] Registered handler for: ${messageType}`);
    };
    
    // Update local capabilities
    const updateCapabilities = (capabilities) => {
      swarmMetadata.capabilities = capabilities;
      announcePresence();
    };
    
    // Get swarm statistics
    const getStats = () => {
      const connectedPeers = Array.from(peers.values())
        .filter(p => p.status === 'connected');
      
      return {
        peerId,
        totalPeers: peers.size,
        connectedPeers: connectedPeers.length,
        peers: Array.from(peers.entries()).map(([id, peer]) => ({
          id,
          status: peer.status,
          lastSeen: peer.lastSeen,
          capabilities: peer.metadata.capabilities || []
        }))
      };
    };
    
    // Disconnect from swarm
    const disconnect = () => {
      logger.info('[WebRTCSwarm] Disconnecting from swarm');

      // Send leave message
      sendSignalingMessage({
        type: 'leave',
        peerId,
        roomId: CONFIG.roomId
      });

      // Close all peer connections
      peers.forEach(peer => {
        peer.connection.close();
      });
      peers.clear();

      // Clear reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // Close WebSocket connection
      if (signalingWs) {
        signalingWs.close();
        signalingWs = null;
      }

      signalingConnected = false;

      logger.info('[WebRTCSwarm] Disconnected');
    };
    
    // Initialize on module load
    initialize();
    
    // Configure signaling server
    const configureSignaling = (options) => {
      if (options.signalingServer) {
        CONFIG.signalingServer = options.signalingServer;
      }
      if (options.roomId) {
        CONFIG.roomId = options.roomId;
      }
      if (options.iceServers) {
        CONFIG.iceServers = options.iceServers;
      }

      logger.info('[WebRTCSwarm] Signaling configuration updated');

      // Reconnect with new settings
      if (signalingConnected) {
        disconnect();
        connectToSignalingServer();
      }
    };

    // Get signaling connection status
    const getSignalingStatus = () => {
      return {
        connected: signalingConnected,
        server: CONFIG.signalingServer,
        roomId: CONFIG.roomId,
        peerId
      };
    };

    // Track bandwidth and message statistics
    const bandwidthStats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      startTime: Date.now(),
      recentActivity: []
    };

    // Wrap sendToPeer to track stats
    const originalSendToPeer = sendToPeer;
    const trackedSendToPeer = (remotePeerId, message) => {
      const result = originalSendToPeer(remotePeerId, message);
      if (result) {
        const messageSize = JSON.stringify(message).length;
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
      }
      return result;
    };

    // Track received messages
    const trackReceivedMessage = (remotePeerId, message) => {
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
    };

    // Calculate current bandwidth
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

    // Web Component Widget (INSIDE factory closure to access state)
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
          // Auto-refresh every 2 seconds for real-time bandwidth
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
          const uptimeMinutes = Math.floor(uptimeSeconds / 60);
          const uptimeHours = Math.floor(uptimeMinutes / 60);

          return `
            <div class="widget-panel-content">
              <!-- Connection Status -->
              <div class="connection-status">
                <div class="status-row">
                  <span class="status-label">Signaling Server:</span>
                  <span class="status-value ${signalingConnected ? 'connected' : 'disconnected'}">
                    ${signalingConnected ? '✓ Connected' : '✗ Disconnected'}
                  </span>
                </div>
                <div class="status-row">
                  <span class="status-label">Room ID:</span>
                  <span class="status-value">${CONFIG.roomId}</span>
                </div>
                <div class="status-row">
                  <span class="status-label">Peer ID:</span>
                  <span class="status-value">${peerId}</span>
                </div>
                <div class="status-row">
                  <span class="status-label">Uptime:</span>
                  <span class="status-value">${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s</span>
                </div>
              </div>

              <!-- Bandwidth Stats -->
              <div class="bandwidth-section">
                <h4>Bandwidth</h4>
                <div class="bandwidth-stats">
                  <div class="bandwidth-item">
                    <span class="bandwidth-label">↑ Upload:</span>
                    <span class="bandwidth-value">${bandwidth.sent} KB/s</span>
                  </div>
                  <div class="bandwidth-item">
                    <span class="bandwidth-label">↓ Download:</span>
                    <span class="bandwidth-value">${bandwidth.received} KB/s</span>
                  </div>
                  <div class="bandwidth-item total">
                    <span class="bandwidth-label">Total:</span>
                    <span class="bandwidth-value">${bandwidth.total} KB/s</span>
                  </div>
                </div>
              </div>

              <!-- Message Stats -->
              <div class="message-stats">
                <h4>Message Statistics</h4>
                <div class="stats-grid">
                  <div class="stat-item">
                    <div class="stat-number">${bandwidthStats.messagesSent}</div>
                    <div class="stat-name">Sent</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-number">${bandwidthStats.messagesReceived}</div>
                    <div class="stat-name">Received</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-number">${Math.round(bandwidthStats.bytesSent / 1024)} KB</div>
                    <div class="stat-name">Data Sent</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-number">${Math.round(bandwidthStats.bytesReceived / 1024)} KB</div>
                    <div class="stat-name">Data Received</div>
                  </div>
                </div>
              </div>

              <!-- Connected Peers -->
              <div class="peers-section">
                <h4>Connected Peers (${stats.connectedPeers})</h4>
                ${stats.peers.length === 0 ? `
                  <div class="no-peers">No peers connected</div>
                ` : `
                  <div class="peer-list">
                    ${stats.peers.map(peer => {
                      const timeSinceLastSeen = Math.floor((Date.now() - peer.lastSeen) / 1000);
                      return `
                        <div class="peer-item ${peer.status}">
                          <div class="peer-header">
                            <span class="peer-icon">${peer.status === 'connected' ? '○' : '○'}</span>
                            <span class="peer-id">${peer.id.substring(0, 12)}...</span>
                            <span class="peer-status">${peer.status}</span>
                          </div>
                          <div class="peer-details">
                            <span class="peer-detail">Last seen: ${timeSinceLastSeen}s ago</span>
                            ${peer.capabilities.length > 0 ? `
                              <span class="peer-detail">Capabilities: ${peer.capabilities.join(', ')}</span>
                            ` : ''}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>

              <!-- Recent Activity -->
              ${bandwidthStats.recentActivity.length > 0 ? `
                <div class="activity-section">
                  <h4>Recent Activity</h4>
                  <div class="activity-list">
                    ${bandwidthStats.recentActivity.slice(0, 10).map(activity => `
                      <div class="activity-item ${activity.type}">
                        <span class="activity-icon">${activity.type === 'sent' ? '↑' : '↓'}</span>
                        <span class="activity-type">${activity.messageType}</span>
                        <span class="activity-peer">${activity.peer.substring(0, 8)}...</span>
                        <span class="activity-time">${formatActivityTime(activity.timestamp)}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Control Buttons -->
              <div style="display: grid; grid-template-columns: repeat(${signalingConnected ? '2' : '1'}, 1fr); gap: 8px; margin-top: 16px;">
                ${!signalingConnected ? `
                  <button class="reconnect-btn" style="padding: 10px; background: #0c0; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
                    ↻ Reconnect
                  </button>
                ` : ''}
                ${signalingConnected ? `
                  <button class="disconnect-btn" style="padding: 10px; background: #f00; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
                    ⏹️ Disconnect
                  </button>
                  <button class="announce-btn" style="padding: 10px; background: #f90; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
                    ⚠ Announce Presence
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }

        render() {
          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                font-family: system-ui, -apple-system, sans-serif;
                color: #ccc;
              }

              .widget-content {
                background: rgba(255,255,255,0.03);
                border-radius: 8px;
                padding: 16px;
              }

              h4 {
                margin: 16px 0 8px 0;
                font-size: 0.95em;
                color: #aaa;
              }

              button {
                transition: all 0.2s ease;
              }

              .reconnect-btn:hover {
                background: #0e0 !important;
                transform: translateY(-1px);
              }

              .disconnect-btn:hover {
                background: #ff3333 !important;
                transform: translateY(-1px);
              }

              .announce-btn:hover {
                background: #fa0 !important;
                transform: translateY(-1px);
              }

              button:active {
                transform: translateY(0);
              }
            </style>

            <div class="widget-content">
              ${this.renderPanel()}
            </div>
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

    // Define custom element
    if (!customElements.get('webrtc-swarm-widget')) {
      customElements.define('webrtc-swarm-widget', WebRTCSwarmWidget);
    }

    const widget = {
      element: 'webrtc-swarm-widget',
      displayName: 'WebRTC Swarm',
      icon: '♁',
      category: 'communication',
      order: 40,
      updateInterval: 2000
    };

    // Helper function
    function formatActivityTime(timestamp) {
      const now = Date.now();
      const diff = now - timestamp;
      const seconds = Math.floor(diff / 1000);

      if (seconds < 1) return 'just now';
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      return new Date(timestamp).toLocaleTimeString();
    }

    // Return public API
    return {
      api: {
        getPeerId: () => peerId,
        getStats,
        sendToPeer: trackedSendToPeer,
        broadcast,
        delegateTask,
        shareKnowledge,
        requestConsensus,
        registerMessageHandler,
        updateCapabilities,
        configureSignaling,
        getSignalingStatus,
        disconnect,
        getBandwidthStats: () => ({ ...bandwidthStats }),
        getCurrentBandwidth
      },
      widget
    };
  }
};

// Legacy compatibility wrapper
const WebRTCSwarmModule = (logger, Utils, StateManager) => {
  const instance = WebRTCSwarm.factory({ logger, Utils, StateManager });
  return instance.api;
};

// Export both formats
export default WebRTCSwarm;