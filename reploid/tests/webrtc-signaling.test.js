/**
 * WebRTC Signaling Server Tests
 *
 * Tests for the WebSocket-based signaling server
 * that enables cross-origin WebRTC P2P connections
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import SignalingServer from '../server/signaling-server.js';

describe('WebRTC Signaling Server', () => {
  let httpServer;
  let signalingServer;
  let serverUrl;
  const PORT = 9999;

  beforeAll(() => {
    // Create HTTP server for testing
    httpServer = http.createServer();

    // Initialize signaling server
    signalingServer = new SignalingServer(httpServer, {
      path: '/signaling',
      heartbeatInterval: 1000,
      peerTimeout: 3000
    });

    // Start server
    return new Promise((resolve) => {
      httpServer.listen(PORT, () => {
        serverUrl = `ws://localhost:${PORT}/signaling`;
        console.log(`Test signaling server started on ${serverUrl}`);
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise((resolve) => {
      signalingServer.close();
      httpServer.close(() => {
        console.log('Test signaling server closed');
        resolve();
      });
    });
  });

  describe('Connection', () => {
    it('should accept WebSocket connections', (done) => {
      const ws = new WebSocket(serverUrl);

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should send welcome message on connection', (done) => {
      const ws = new WebSocket(serverUrl);

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'welcome') {
          expect(message.type).toBe('welcome');
          expect(message.timestamp).toBeDefined();
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });
  });

  describe('Room Management', () => {
    it('should allow peer to join a room', (done) => {
      const ws = new WebSocket(serverUrl);
      const peerId = 'test-peer-1';
      const roomId = 'test-room-1';

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'join',
          peerId,
          roomId,
          metadata: { test: true }
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          expect(message.peerId).toBe(peerId);
          expect(message.roomId).toBe(roomId);
          expect(message.peers).toEqual([]);
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should notify existing peers when new peer joins', (done) => {
      const ws1 = new WebSocket(serverUrl);
      const ws2 = new WebSocket(serverUrl);
      const roomId = 'test-room-2';
      let peer1Joined = false;

      // First peer joins
      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-1',
          roomId,
          metadata: { name: 'Peer 1' }
        }));
      });

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          peer1Joined = true;

          // Second peer joins after first is ready
          setTimeout(() => {
            ws2.send(JSON.stringify({
              type: 'join',
              peerId: 'peer-2',
              roomId,
              metadata: { name: 'Peer 2' }
            }));
          }, 100);
        } else if (message.type === 'peer-joined') {
          expect(message.peerId).toBe('peer-2');
          expect(message.metadata.name).toBe('Peer 2');
          ws1.close();
          ws2.close();
          done();
        }
      });

      ws2.on('open', () => {
        // Wait for first peer to join
      });

      ws1.on('error', done);
      ws2.on('error', done);
    });

    it('should list existing peers when joining room', (done) => {
      const ws1 = new WebSocket(serverUrl);
      const ws2 = new WebSocket(serverUrl);
      const roomId = 'test-room-3';

      // First peer joins
      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-alpha',
          roomId
        }));
      });

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          // Second peer joins after first
          setTimeout(() => {
            ws2.send(JSON.stringify({
              type: 'join',
              peerId: 'peer-beta',
              roomId
            }));
          }, 100);
        }
      });

      ws2.on('open', () => {
        // Wait for join message
      });

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          expect(message.peers).toContain('peer-alpha');
          expect(message.peers.length).toBe(1);
          ws1.close();
          ws2.close();
          done();
        }
      });

      ws1.on('error', done);
      ws2.on('error', done);
    });
  });

  describe('Signaling Messages', () => {
    it('should forward offer to target peer', (done) => {
      const ws1 = new WebSocket(serverUrl);
      const ws2 = new WebSocket(serverUrl);
      const roomId = 'test-room-4';
      let bothJoined = 0;

      const checkBothJoined = () => {
        bothJoined++;
        if (bothJoined === 2) {
          // Send offer from peer 1 to peer 2
          ws1.send(JSON.stringify({
            type: 'offer',
            peerId: 'peer-1',
            targetPeer: 'peer-2',
            offer: {
              type: 'offer',
              sdp: 'mock-sdp-data'
            }
          }));
        }
      };

      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-1',
          roomId
        }));
      });

      ws2.on('open', () => {
        ws2.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-2',
          roomId
        }));
      });

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'joined') {
          checkBothJoined();
        }
      });

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          checkBothJoined();
        } else if (message.type === 'offer') {
          expect(message.peerId).toBe('peer-1');
          expect(message.offer.sdp).toBe('mock-sdp-data');
          ws1.close();
          ws2.close();
          done();
        }
      });

      ws1.on('error', done);
      ws2.on('error', done);
    });

    it('should forward answer to target peer', (done) => {
      const ws1 = new WebSocket(serverUrl);
      const ws2 = new WebSocket(serverUrl);
      const roomId = 'test-room-5';
      let bothJoined = 0;

      const checkBothJoined = () => {
        bothJoined++;
        if (bothJoined === 2) {
          // Send answer from peer 2 to peer 1
          ws2.send(JSON.stringify({
            type: 'answer',
            peerId: 'peer-2',
            targetPeer: 'peer-1',
            answer: {
              type: 'answer',
              sdp: 'mock-answer-sdp'
            }
          }));
        }
      };

      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-1',
          roomId
        }));
      });

      ws2.on('open', () => {
        ws2.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-2',
          roomId
        }));
      });

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          checkBothJoined();
        } else if (message.type === 'answer') {
          expect(message.peerId).toBe('peer-2');
          expect(message.answer.sdp).toBe('mock-answer-sdp');
          ws1.close();
          ws2.close();
          done();
        }
      });

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'joined') {
          checkBothJoined();
        }
      });

      ws1.on('error', done);
      ws2.on('error', done);
    });

    it('should forward ICE candidates', (done) => {
      const ws1 = new WebSocket(serverUrl);
      const ws2 = new WebSocket(serverUrl);
      const roomId = 'test-room-6';
      let bothJoined = 0;

      const checkBothJoined = () => {
        bothJoined++;
        if (bothJoined === 2) {
          ws1.send(JSON.stringify({
            type: 'ice-candidate',
            peerId: 'peer-1',
            targetPeer: 'peer-2',
            candidate: {
              candidate: 'mock-ice-candidate',
              sdpMid: '0',
              sdpMLineIndex: 0
            }
          }));
        }
      };

      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-1',
          roomId
        }));
      });

      ws2.on('open', () => {
        ws2.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-2',
          roomId
        }));
      });

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'joined') {
          checkBothJoined();
        }
      });

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          checkBothJoined();
        } else if (message.type === 'ice-candidate') {
          expect(message.peerId).toBe('peer-1');
          expect(message.candidate.candidate).toBe('mock-ice-candidate');
          ws1.close();
          ws2.close();
          done();
        }
      });

      ws1.on('error', done);
      ws2.on('error', done);
    });
  });

  describe('Peer Management', () => {
    it('should notify room when peer leaves', (done) => {
      const ws1 = new WebSocket(serverUrl);
      const ws2 = new WebSocket(serverUrl);
      const roomId = 'test-room-7';
      let bothJoined = 0;

      const checkBothJoined = () => {
        bothJoined++;
        if (bothJoined === 2) {
          // Close first peer connection
          setTimeout(() => {
            ws1.close();
          }, 100);
        }
      };

      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-1',
          roomId
        }));
      });

      ws2.on('open', () => {
        ws2.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-2',
          roomId
        }));
      });

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'joined') {
          checkBothJoined();
        }
      });

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          checkBothJoined();
        } else if (message.type === 'peer-left') {
          expect(message.peerId).toBe('peer-1');
          ws2.close();
          done();
        }
      });

      ws1.on('error', done);
      ws2.on('error', done);
    });

    it('should handle broadcast messages', (done) => {
      const ws1 = new WebSocket(serverUrl);
      const ws2 = new WebSocket(serverUrl);
      const roomId = 'test-room-8';
      let bothJoined = 0;

      const checkBothJoined = () => {
        bothJoined++;
        if (bothJoined === 2) {
          ws1.send(JSON.stringify({
            type: 'broadcast',
            peerId: 'peer-1',
            roomId,
            data: {
              message: 'Hello swarm!'
            }
          }));
        }
      };

      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-1',
          roomId
        }));
      });

      ws2.on('open', () => {
        ws2.send(JSON.stringify({
          type: 'join',
          peerId: 'peer-2',
          roomId
        }));
      });

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'joined') {
          checkBothJoined();
        }
      });

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'joined') {
          checkBothJoined();
        } else if (message.type === 'broadcast') {
          expect(message.peerId).toBe('peer-1');
          expect(message.data.message).toBe('Hello swarm!');
          ws1.close();
          ws2.close();
          done();
        }
      });

      ws1.on('error', done);
      ws2.on('error', done);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate stats', () => {
      const stats = signalingServer.getStats();

      expect(stats).toHaveProperty('totalRooms');
      expect(stats).toHaveProperty('totalPeers');
      expect(stats).toHaveProperty('rooms');
      expect(Array.isArray(stats.rooms)).toBe(true);
    });
  });
});
