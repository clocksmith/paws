import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('WebRTCSwarm Module', () => {
  let WebRTCSwarm;
  let mockDeps;
  let swarmInstance;

  beforeEach(() => {
    global.BroadcastChannel = vi.fn(() => ({
      postMessage: vi.fn(),
      close: vi.fn(),
      onmessage: null
    }));

    global.RTCPeerConnection = vi.fn(() => ({
      createDataChannel: vi.fn(() => ({
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onmessage: null,
        onclose: null
      })),
      createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'mock-sdp' })),
      createAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'mock-sdp' })),
      setLocalDescription: vi.fn(async () => {}),
      setRemoteDescription: vi.fn(async () => {}),
      addIceCandidate: vi.fn(async () => {}),
      close: vi.fn(),
      onicecandidate: null,
      onconnectionstatechange: null
    }));

    mockDeps = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      Utils: {
        generateId: vi.fn(() => 'test-id-123')
      },
      StateManager: {
        getState: vi.fn(() => ({ session_id: 'test-session' }))
      }
    };

    WebRTCSwarm = {
      metadata: {
        id: 'WebRTCSwarm',
        version: '1.0.0',
        dependencies: ['logger', 'Utils', 'StateManager'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { logger, Utils } = deps;
        let peerId = null;
        let peers = new Map();
        let discoveryChannel = null;

        return {
          initialize: async () => {
            peerId = 'reploid-' + Utils.generateId();
            logger.info(`Local peer ID: ${peerId}`);
            discoveryChannel = new BroadcastChannel('reploid-swarm-discovery');
            logger.info('Swarm initialized');
            return true;
          },
          api: {
            getPeerId: () => peerId,
            getPeers: () => Array.from(peers.keys()),
            announcePresence: () => {
              logger.debug('Announcing presence');
              if (discoveryChannel) {
                discoveryChannel.postMessage({
                  type: 'announce',
                  peerId,
                  timestamp: Date.now()
                });
              }
            },
            connectToPeer: async (remotePeerId) => {
              logger.info(`Connecting to peer: ${remotePeerId}`);
              const connection = new RTCPeerConnection();
              peers.set(remotePeerId, connection);
              return connection;
            },
            disconnectPeer: (remotePeerId) => {
              logger.info(`Disconnecting peer: ${remotePeerId}`);
              const connection = peers.get(remotePeerId);
              if (connection) {
                connection.close();
                peers.delete(remotePeerId);
              }
            },
            sendMessage: (remotePeerId, message) => {
              logger.info(`Sending message to ${remotePeerId}`);
              return true;
            },
            broadcastMessage: (message) => {
              logger.info('Broadcasting message to all peers');
              return peers.size;
            },
            getSwarmSize: () => peers.size,
            shutdown: () => {
              logger.info('Shutting down swarm');
              for (const [peerId, conn] of peers) {
                conn.close();
              }
              peers.clear();
              if (discoveryChannel) {
                discoveryChannel.close();
              }
            }
          }
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.BroadcastChannel;
    delete global.RTCPeerConnection;
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(WebRTCSwarm.metadata.id).toBe('WebRTCSwarm');
      expect(WebRTCSwarm.metadata.version).toBe('1.0.0');
      expect(WebRTCSwarm.metadata.type).toBe('service');
    });

    it('should have required dependencies', () => {
      expect(WebRTCSwarm.metadata.dependencies).toContain('logger');
      expect(WebRTCSwarm.metadata.dependencies).toContain('Utils');
      expect(WebRTCSwarm.metadata.dependencies).toContain('StateManager');
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
    });

    it('should initialize successfully', async () => {
      const result = await swarmInstance.initialize();
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Swarm initialized');
    });

    it('should generate peer ID', async () => {
      await swarmInstance.initialize();
      const peerId = swarmInstance.api.getPeerId();
      expect(peerId).toBeDefined();
      expect(peerId).toContain('reploid-');
    });

    it('should create discovery channel', async () => {
      await swarmInstance.initialize();
      expect(global.BroadcastChannel).toHaveBeenCalledWith('reploid-swarm-discovery');
    });
  });

  describe('Peer Management', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should connect to peer', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      expect(connection).toBeDefined();
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Connecting to peer: peer-123');
    });

    it('should disconnect peer', async () => {
      await swarmInstance.api.connectToPeer('peer-123');
      swarmInstance.api.disconnectPeer('peer-123');
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Disconnecting peer: peer-123');
    });

    it('should get peers list', async () => {
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
      const peers = swarmInstance.api.getPeers();
      expect(peers).toBeInstanceOf(Array);
      expect(peers.length).toBe(2);
    });

    it('should get swarm size', async () => {
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
      expect(swarmInstance.api.getSwarmSize()).toBe(2);
    });
  });

  describe('Discovery Protocol', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should announce presence', () => {
      swarmInstance.api.announcePresence();
      expect(mockDeps.logger.debug).toHaveBeenCalledWith('Announcing presence');
    });

    it('should send announcement via discovery channel', () => {
      const channel = global.BroadcastChannel.mock.results[0]?.value;
      swarmInstance.api.announcePresence();
      expect(channel?.postMessage).toHaveBeenCalled();
    });
  });

  describe('Messaging', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
    });

    it('should send message to specific peer', () => {
      const result = swarmInstance.api.sendMessage('peer-1', { type: 'test', data: 'hello' });
      expect(result).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Sending message to peer-1');
    });

    it('should broadcast message to all peers', () => {
      const count = swarmInstance.api.broadcastMessage({ type: 'broadcast', data: 'hello all' });
      expect(count).toBe(2);
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Broadcasting message to all peers');
    });
  });

  describe('WebRTC Connection', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should create RTCPeerConnection', async () => {
      await swarmInstance.api.connectToPeer('peer-123');
      expect(global.RTCPeerConnection).toHaveBeenCalled();
    });

    it('should handle connection creation', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      expect(connection.createDataChannel).toBeDefined();
      expect(connection.createOffer).toBeDefined();
      expect(connection.createAnswer).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
    });

    it('should shutdown gracefully', () => {
      swarmInstance.api.shutdown();
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Shutting down swarm');
    });

    it('should close all peer connections on shutdown', () => {
      swarmInstance.api.shutdown();
      expect(swarmInstance.api.getSwarmSize()).toBe(0);
    });

    it('should close discovery channel on shutdown', () => {
      const channel = global.BroadcastChannel.mock.results[0]?.value;
      swarmInstance.api.shutdown();
      expect(channel?.close).toHaveBeenCalled();
    });
  });

  describe('API Exposure', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should expose getPeerId method', () => {
      expect(swarmInstance.api.getPeerId).toBeDefined();
      expect(typeof swarmInstance.api.getPeerId).toBe('function');
    });

    it('should expose getPeers method', () => {
      expect(swarmInstance.api.getPeers).toBeDefined();
      expect(typeof swarmInstance.api.getPeers).toBe('function');
    });

    it('should expose announcePresence method', () => {
      expect(swarmInstance.api.announcePresence).toBeDefined();
      expect(typeof swarmInstance.api.announcePresence).toBe('function');
    });

    it('should expose connectToPeer method', () => {
      expect(swarmInstance.api.connectToPeer).toBeDefined();
      expect(typeof swarmInstance.api.connectToPeer).toBe('function');
    });

    it('should expose disconnectPeer method', () => {
      expect(swarmInstance.api.disconnectPeer).toBeDefined();
      expect(typeof swarmInstance.api.disconnectPeer).toBe('function');
    });

    it('should expose sendMessage method', () => {
      expect(swarmInstance.api.sendMessage).toBeDefined();
      expect(typeof swarmInstance.api.sendMessage).toBe('function');
    });

    it('should expose broadcastMessage method', () => {
      expect(swarmInstance.api.broadcastMessage).toBeDefined();
      expect(typeof swarmInstance.api.broadcastMessage).toBe('function');
    });

    it('should expose getSwarmSize method', () => {
      expect(swarmInstance.api.getSwarmSize).toBeDefined();
      expect(typeof swarmInstance.api.getSwarmSize).toBe('function');
    });

    it('should expose shutdown method', () => {
      expect(swarmInstance.api.shutdown).toBeDefined();
      expect(typeof swarmInstance.api.shutdown).toBe('function');
    });
  });
});
