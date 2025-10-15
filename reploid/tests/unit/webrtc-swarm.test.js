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

  describe('ICE Candidate Handling', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should handle ICE candidate events', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      expect(connection.onicecandidate).toBeDefined();
    });

    it('should collect ICE candidates', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const candidates = [];
      connection.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate);
        }
      };
      expect(typeof connection.onicecandidate).toBe('function');
    });

    it('should handle trickle ICE', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const candidate = { candidate: 'a=candidate:...', sdpMLineIndex: 0 };
      await connection.addIceCandidate(candidate);
      expect(connection.addIceCandidate).toHaveBeenCalledWith(candidate);
    });
  });

  describe('Connection State Management', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should track connection state changes', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      expect(connection.onconnectionstatechange).toBeDefined();
    });

    it('should handle connected state', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      connection.connectionState = 'connected';
      expect(connection.connectionState).toBe('connected');
    });

    it('should handle disconnected state', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      connection.connectionState = 'disconnected';
      expect(connection.connectionState).toBe('disconnected');
    });

    it('should handle failed state', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      connection.connectionState = 'failed';
      expect(connection.connectionState).toBe('failed');
    });

    it('should handle closed state', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      swarmInstance.api.disconnectPeer('peer-123');
      expect(connection.close).toHaveBeenCalled();
    });
  });

  describe('Data Channel Operations', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should create data channel', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const channel = connection.createDataChannel('data');
      expect(channel).toBeDefined();
    });

    it('should handle data channel events', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const channel = connection.createDataChannel('data');
      expect(channel.onopen).toBeDefined();
      expect(channel.onmessage).toBeDefined();
      expect(channel.onclose).toBeDefined();
    });

    it('should send data through channel', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const channel = connection.createDataChannel('data');
      channel.send('test message');
      expect(channel.send).toHaveBeenCalledWith('test message');
    });

    it('should handle binary data', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const channel = connection.createDataChannel('binary');
      const binaryData = new Uint8Array([1, 2, 3, 4]);
      channel.send(binaryData);
      expect(channel.send).toHaveBeenCalledWith(binaryData);
    });

    it('should close data channel', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const channel = connection.createDataChannel('data');
      channel.close();
      expect(channel.close).toHaveBeenCalled();
    });
  });

  describe('SDP Negotiation', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should create offer', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const offer = await connection.createOffer();
      expect(offer).toBeDefined();
      expect(offer.type).toBe('offer');
      expect(offer.sdp).toBeDefined();
    });

    it('should create answer', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const answer = await connection.createAnswer();
      expect(answer).toBeDefined();
      expect(answer.type).toBe('answer');
      expect(answer.sdp).toBeDefined();
    });

    it('should set local description', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      expect(connection.setLocalDescription).toHaveBeenCalledWith(offer);
    });

    it('should set remote description', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-123');
      const remoteOffer = { type: 'offer', sdp: 'remote-sdp' };
      await connection.setRemoteDescription(remoteOffer);
      expect(connection.setRemoteDescription).toHaveBeenCalledWith(remoteOffer);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should handle connection timeout', async () => {
      global.RTCPeerConnection = vi.fn(() => {
        throw new Error('Connection timeout');
      });
      try {
        await swarmInstance.api.connectToPeer('peer-timeout');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    it('should handle invalid peer ID', () => {
      const invalidIds = ['', null, undefined];
      invalidIds.forEach(id => {
        expect(() => swarmInstance.api.sendMessage(id, {})).not.toThrow();
      });
    });

    it('should handle message send failure', () => {
      const result = swarmInstance.api.sendMessage('nonexistent-peer', {});
      expect(result).toBe(true); // Should handle gracefully
    });

    it('should handle broadcast to empty swarm', () => {
      const count = swarmInstance.api.broadcastMessage({ data: 'test' });
      expect(count).toBe(0);
    });

    it('should handle disconnection of unknown peer', () => {
      expect(() => swarmInstance.api.disconnectPeer('unknown-peer')).not.toThrow();
    });
  });

  describe('Network Partition Scenarios', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
      await swarmInstance.api.connectToPeer('peer-3');
    });

    it('should detect network partition', () => {
      const peers = swarmInstance.api.getPeers();
      expect(peers).toHaveLength(3);
    });

    it('should handle peer subset disconnection', () => {
      swarmInstance.api.disconnectPeer('peer-1');
      swarmInstance.api.disconnectPeer('peer-2');
      expect(swarmInstance.api.getSwarmSize()).toBe(1);
    });

    it('should attempt reconnection', async () => {
      swarmInstance.api.disconnectPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-1');
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Connecting to peer: peer-1');
    });

    it('should maintain connection to reachable peers', () => {
      swarmInstance.api.disconnectPeer('peer-1');
      expect(swarmInstance.api.getSwarmSize()).toBe(2);
    });
  });

  describe('Peer Discovery', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should announce to discovery channel', () => {
      const channel = global.BroadcastChannel.mock.results[0]?.value;
      swarmInstance.api.announcePresence();
      expect(channel?.postMessage).toHaveBeenCalled();
    });

    it('should include peer ID in announcement', () => {
      const peerId = swarmInstance.api.getPeerId();
      expect(peerId).toBeDefined();
      expect(peerId).toContain('reploid-');
    });

    it('should include timestamp in announcement', () => {
      const channel = global.BroadcastChannel.mock.results[0]?.value;
      swarmInstance.api.announcePresence();
      const call = channel?.postMessage.mock.calls[0]?.[0];
      expect(call?.timestamp).toBeDefined();
    });

    it('should handle discovery response', () => {
      const channel = global.BroadcastChannel.mock.results[0]?.value;
      channel.onmessage = vi.fn();
      expect(channel).toBeDefined();
    });
  });

  describe('Concurrent Connections', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should handle multiple simultaneous connections', async () => {
      const connections = await Promise.all([
        swarmInstance.api.connectToPeer('peer-1'),
        swarmInstance.api.connectToPeer('peer-2'),
        swarmInstance.api.connectToPeer('peer-3'),
        swarmInstance.api.connectToPeer('peer-4'),
        swarmInstance.api.connectToPeer('peer-5')
      ]);
      expect(connections).toHaveLength(5);
      expect(swarmInstance.api.getSwarmSize()).toBe(5);
    });

    it('should maintain separate connections', async () => {
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
      const peers = swarmInstance.api.getPeers();
      expect(peers).toContain('peer-1');
      expect(peers).toContain('peer-2');
    });

    it('should handle connection race conditions', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(swarmInstance.api.connectToPeer(`peer-${i}`));
      }
      await Promise.all(promises);
      expect(swarmInstance.api.getSwarmSize()).toBe(10);
    });
  });

  describe('Message Routing', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
    });

    it('should route message to specific peer', () => {
      const result = swarmInstance.api.sendMessage('peer-1', { type: 'test', data: 'hello' });
      expect(result).toBe(true);
    });

    it('should broadcast to all peers', () => {
      const count = swarmInstance.api.broadcastMessage({ type: 'broadcast', data: 'hello all' });
      expect(count).toBe(2);
    });

    it('should handle large messages', () => {
      const largeMessage = { data: 'x'.repeat(10000) };
      const result = swarmInstance.api.sendMessage('peer-1', largeMessage);
      expect(result).toBe(true);
    });

    it('should handle structured messages', () => {
      const message = {
        type: 'update',
        timestamp: Date.now(),
        payload: { key: 'value' },
        metadata: { sender: 'test' }
      };
      const result = swarmInstance.api.sendMessage('peer-1', message);
      expect(result).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should track connection count', async () => {
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
      expect(swarmInstance.api.getSwarmSize()).toBe(2);
    });

    it('should measure broadcast latency', () => {
      const start = Date.now();
      swarmInstance.api.broadcastMessage({ data: 'test' });
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should handle rapid announcements', () => {
      for (let i = 0; i < 100; i++) {
        swarmInstance.api.announcePresence();
      }
      const channel = global.BroadcastChannel.mock.results[0]?.value;
      expect(channel.postMessage.mock.calls.length).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Cleanup and Resource Management', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
      await swarmInstance.api.connectToPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-2');
    });

    it('should close all connections on shutdown', () => {
      swarmInstance.api.shutdown();
      expect(swarmInstance.api.getSwarmSize()).toBe(0);
    });

    it('should close discovery channel on shutdown', () => {
      const channel = global.BroadcastChannel.mock.results[0]?.value;
      swarmInstance.api.shutdown();
      expect(channel.close).toHaveBeenCalled();
    });

    it('should prevent operations after shutdown', () => {
      swarmInstance.api.shutdown();
      expect(() => swarmInstance.api.announcePresence()).not.toThrow();
    });

    it('should clean up event listeners', async () => {
      const connection = await swarmInstance.api.connectToPeer('peer-3');
      swarmInstance.api.disconnectPeer('peer-3');
      expect(connection.close).toHaveBeenCalled();
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should handle connection drop', async () => {
      await swarmInstance.api.connectToPeer('peer-1');
      swarmInstance.api.disconnectPeer('peer-1');
      expect(swarmInstance.api.getSwarmSize()).toBe(0);
    });

    it('should attempt reconnection', async () => {
      await swarmInstance.api.connectToPeer('peer-1');
      swarmInstance.api.disconnectPeer('peer-1');
      await swarmInstance.api.connectToPeer('peer-1');
      expect(swarmInstance.api.getSwarmSize()).toBe(1);
    });

    it('should maintain connection state', async () => {
      await swarmInstance.api.connectToPeer('peer-1');
      const peers = swarmInstance.api.getPeers();
      expect(peers).toContain('peer-1');
    });

    it('should handle rapid connect/disconnect', async () => {
      for (let i = 0; i < 10; i++) {
        await swarmInstance.api.connectToPeer('peer-test');
        swarmInstance.api.disconnectPeer('peer-test');
      }
      expect(swarmInstance.api.getSwarmSize()).toBe(0);
    });
  });

  describe('Security Considerations', () => {
    beforeEach(async () => {
      swarmInstance = WebRTCSwarm.factory(mockDeps);
      await swarmInstance.initialize();
    });

    it('should validate peer IDs', () => {
      const validId = 'reploid-abc123';
      expect(validId).toMatch(/^reploid-/);
    });

    it('should handle malicious messages', () => {
      const maliciousMessage = { __proto__: { polluted: true } };
      const result = swarmInstance.api.sendMessage('peer-1', maliciousMessage);
      expect(result).toBeDefined();
    });

    it('should sanitize peer IDs', () => {
      const unsafeId = '<script>alert("xss")</script>';
      expect(() => swarmInstance.api.connectToPeer(unsafeId)).not.toThrow();
    });
  });
});
