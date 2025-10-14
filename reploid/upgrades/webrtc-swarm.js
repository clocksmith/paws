// WebRTC Swarm Module for REPLOID
// Enables peer-to-peer communication between multiple agent instances

const WebRTCSwarm = {
  metadata: {
    id: 'WebRTCSwarm',
    version: '1.0.0',
    dependencies: ['logger', 'Utils', 'StateManager'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { logger, Utils, StateManager } = deps;
    
    // Swarm configuration
    const CONFIG = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      channelOptions: {
        ordered: true,
        maxRetransmits: 3
      }
    };
    
    // Swarm state
    let peerId = null;
    let peers = new Map();
    let discoveryChannel = null;
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
      
      // Set up discovery channel (using BroadcastChannel as signaling)
      discoveryChannel = new BroadcastChannel('reploid-swarm-discovery');
      discoveryChannel.onmessage = handleDiscoveryMessage;
      
      // Announce presence
      announcePresence();
      
      // Set up periodic heartbeat
      setInterval(sendHeartbeat, 30000);
      
      logger.info('[WebRTCSwarm] Swarm initialized');
    };
    
    // Announce presence to other peers
    const announcePresence = () => {
      logger.debug('[WebRTCSwarm] Announcing presence to swarm');
      
      discoveryChannel.postMessage({
        type: 'announce',
        peerId,
        metadata: swarmMetadata,
        timestamp: Date.now()
      });
    };
    
    // Handle discovery messages
    const handleDiscoveryMessage = async (event) => {
      const { type, peerId: remotePeerId, metadata, offer, answer, candidate } = event.data;
      
      if (remotePeerId === peerId) return; // Ignore own messages
      
      switch (type) {
        case 'announce':
          await handlePeerAnnouncement(remotePeerId, metadata);
          break;
        case 'offer':
          await handleOffer(remotePeerId, offer);
          break;
        case 'answer':
          await handleAnswer(remotePeerId, answer);
          break;
        case 'ice-candidate':
          await handleIceCandidate(remotePeerId, candidate);
          break;
        case 'heartbeat':
          updatePeerStatus(remotePeerId, 'alive');
          break;
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
          discoveryChannel.postMessage({
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
      
      discoveryChannel.postMessage({
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
          discoveryChannel.postMessage({
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
      
      discoveryChannel.postMessage({
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
      discoveryChannel.postMessage({
        type: 'heartbeat',
        peerId,
        timestamp: Date.now()
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
      
      // Close all peer connections
      peers.forEach(peer => {
        peer.connection.close();
      });
      peers.clear();
      
      // Close discovery channel
      if (discoveryChannel) {
        discoveryChannel.close();
      }
      
      logger.info('[WebRTCSwarm] Disconnected');
    };
    
    // Initialize on module load
    initialize();
    
    // Public API
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
        disconnect
      }
    };
  }
};

// Legacy compatibility wrapper
const WebRTCSwarmModule = (logger, Utils, StateManager) => {
  const instance = WebRTCSwarm.factory({ logger, Utils, StateManager });
  return instance.api;
};

// Export both formats
WebRTCSwarm;
WebRTCSwarmModule;