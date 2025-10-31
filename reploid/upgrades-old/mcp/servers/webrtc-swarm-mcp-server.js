// @blueprint 0x00008C - WebRTC Swarm MCP Server for REPLOID
/**
 * WebRTC Swarm MCP Server
 *
 * Exposes REPLOID WebRTC Swarm operations via MCP
 * Enables P2P communication between agent instances
 *
 * Available Tools:
 * - connect_peer - Connect to a peer
 * - disconnect_peer - Disconnect from a peer
 * - list_peers - List connected peers
 * - send_message - Send message to peer
 * - get_topology - Get swarm topology
 */

const WebRTCSwarmMCPServer = {
  metadata: {
    id: 'WebRTCSwarmMCPServer',
    version: '1.0.0',
    description: 'WebRTC Swarm operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'WebRTCSwarm', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, WebRTCSwarm, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[WebRTCSwarmMCPServer] Initializing WebRTC Swarm MCP Server...');

    const server = createMCPServer({
      name: 'webrtc-swarm',
      version: '1.0.0',
      description: 'REPLOID WebRTC Swarm - P2P agent communication',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'connect_peer',
          schema: {
            description: 'Connect to a peer (initiated automatically on room join)',
            properties: {
              peer_id: {
                type: 'string',
                description: 'Peer ID to connect to'
              }
            },
            required: ['peer_id']
          },
          handler: async (args) => {
            const { peer_id } = args;

            return {
              success: true,
              message: 'Peer connections are managed automatically by WebRTC Swarm',
              peer_id: peer_id,
              note: 'Peers connect automatically when they join the same room'
            };
          }
        },

        {
          name: 'disconnect_peer',
          schema: {
            description: 'Disconnect from swarm',
            properties: {}
          },
          handler: async () => {
            try {
              WebRTCSwarm.disconnect();

              return {
                success: true,
                message: 'Disconnected from swarm'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'list_peers',
          schema: {
            description: 'List all connected peers',
            properties: {}
          },
          handler: async () => {
            try {
              const stats = WebRTCSwarm.getStats();

              return {
                success: true,
                peers: stats.peers.map(p => ({
                  id: p.id,
                  status: p.status,
                  last_seen: p.lastSeen,
                  capabilities: p.capabilities
                })),
                total_peers: stats.totalPeers,
                connected_peers: stats.connectedPeers
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'send_message',
          schema: {
            description: 'Send message to a specific peer',
            properties: {
              peer_id: {
                type: 'string',
                description: 'Peer ID to send to'
              },
              message: {
                type: 'object',
                description: 'Message object to send'
              }
            },
            required: ['peer_id', 'message']
          },
          handler: async (args) => {
            const { peer_id, message } = args;

            try {
              const success = WebRTCSwarm.sendToPeer(peer_id, message);

              return {
                success,
                peer_id,
                message: success ? 'Message sent' : 'Failed to send (peer not connected)'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'get_topology',
          schema: {
            description: 'Get swarm topology and statistics',
            properties: {}
          },
          handler: async () => {
            try {
              const stats = WebRTCSwarm.getStats();
              const bandwidth = WebRTCSwarm.getCurrentBandwidth();
              const signalingStatus = WebRTCSwarm.getSignalingStatus();

              return {
                success: true,
                topology: {
                  peer_id: stats.peerId,
                  total_peers: stats.totalPeers,
                  connected_peers: stats.connectedPeers,
                  signaling: signalingStatus,
                  bandwidth: {
                    sent: bandwidth.sent,
                    received: bandwidth.received,
                    total: bandwidth.total
                  }
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'broadcast',
          schema: {
            description: 'Broadcast message to all connected peers',
            properties: {
              message: {
                type: 'object',
                description: 'Message object to broadcast'
              }
            },
            required: ['message']
          },
          handler: async (args) => {
            const { message } = args;

            try {
              const sent = WebRTCSwarm.broadcast(message);

              return {
                success: true,
                peers_reached: sent,
                message: `Broadcast sent to ${sent} peers`
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'configure_signaling',
          schema: {
            description: 'Configure signaling server settings',
            properties: {
              signaling_server: {
                type: 'string',
                description: 'WebSocket signaling server URL'
              },
              room_id: {
                type: 'string',
                description: 'Room ID to join'
              }
            }
          },
          handler: async (args) => {
            const { signaling_server, room_id } = args;

            try {
              WebRTCSwarm.configureSignaling({
                signalingServer: signaling_server,
                roomId: room_id
              });

              return {
                success: true,
                message: 'Signaling configuration updated',
                config: {
                  signaling_server,
                  room_id
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[WebRTCSwarmMCPServer] Initialized with ${server.listTools().length} tools`);

    return server;
  }
};

export default WebRTCSwarmMCPServer;
