#!/usr/bin/env node
// @blueprint 0x000073 - MCP WebSocket Bridge Server (Node.js)
/**
 * MCP WebSocket Bridge Server
 *
 * Standalone Node.js server that acts as a WebSocket bridge
 * Connects browser-based MCP server to external MCP clients
 *
 * Architecture:
 * - External MCP Client → WebSocket → Bridge Server → Browser MCP Server
 * - Supports multiple concurrent client connections
 * - Routes JSON-RPC messages bidirectionally
 * - Handles connection lifecycle and errors
 *
 * Usage:
 *   node mcp-bridge-server.js [--port 8001]
 *
 * Environment Variables:
 *   MCP_BRIDGE_PORT - Server port (default: 8001)
 *   MCP_BRIDGE_HOST - Server host (default: 0.0.0.0)
 */

// Check if running in Node.js
if (typeof window !== 'undefined') {
  console.error('[MCPBridgeServer] This module must run in Node.js, not the browser');
  // Export empty module for browser compatibility
  export default {};
} else {
  // Node.js environment - create WebSocket server
  const WebSocket = require('ws');
  const http = require('http');

  class MCPBridgeServer {
    constructor(options = {}) {
      this.port = options.port || process.env.MCP_BRIDGE_PORT || 8001;
      this.host = options.host || process.env.MCP_BRIDGE_HOST || '0.0.0.0';
      this.server = null;
      this.wss = null;

      // Client connections
      this.browserClient = null; // Single browser connection
      this.externalClients = new Set(); // Multiple external MCP clients

      this.messageId = 0;
    }

    start() {
      console.log('[MCPBridgeServer] Starting MCP WebSocket bridge server...');

      // Create HTTP server
      this.server = http.createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            browserConnected: !!this.browserClient,
            externalClients: this.externalClients.size
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('MCP Bridge Server\n');
        }
      });

      // Create WebSocket server
      this.wss = new WebSocket.Server({ server: this.server });

      this.wss.on('connection', (ws, req) => {
        this.handleConnection(ws, req);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`[MCPBridgeServer] Listening on ${this.host}:${this.port}`);
        console.log(`[MCPBridgeServer] Health check: http://localhost:${this.port}/health`);
      });
    }

    handleConnection(ws, req) {
      const clientType = req.headers['x-client-type'] || 'external';
      const clientId = `${clientType}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      console.log(`[MCPBridgeServer] New connection: ${clientId} (type: ${clientType})`);

      // Determine if this is browser or external client
      if (clientType === 'browser' || req.headers['user-agent']?.includes('Mozilla')) {
        if (this.browserClient) {
          console.warn('[MCPBridgeServer] Browser already connected, replacing...');
          this.browserClient.close();
        }
        this.browserClient = ws;
        ws.clientId = clientId;
        ws.clientType = 'browser';
        console.log('[MCPBridgeServer] Browser client connected');
      } else {
        this.externalClients.add(ws);
        ws.clientId = clientId;
        ws.clientType = 'external';
        console.log(`[MCPBridgeServer] External client connected (${this.externalClients.size} total)`);
      }

      // Message handler
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // Close handler
      ws.on('close', () => {
        if (ws.clientType === 'browser') {
          console.log('[MCPBridgeServer] Browser client disconnected');
          this.browserClient = null;
        } else {
          this.externalClients.delete(ws);
          console.log(`[MCPBridgeServer] External client disconnected (${this.externalClients.size} remaining)`);
        }
      });

      // Error handler
      ws.on('error', (error) => {
        console.error(`[MCPBridgeServer] WebSocket error (${ws.clientId}):`, error);
      });

      // Send welcome message
      const welcome = {
        type: 'welcome',
        clientId: ws.clientId,
        clientType: ws.clientType,
        serverVersion: '1.0.0'
      };
      ws.send(JSON.stringify(welcome));
    }

    handleMessage(ws, data) {
      try {
        const message = JSON.parse(data);

        console.log(`[MCPBridgeServer] Message from ${ws.clientId}:`, message);

        // Route message based on source
        if (ws.clientType === 'browser') {
          // Message from browser → forward to all external clients
          this.broadcastToExternalClients(message);
        } else {
          // Message from external client → forward to browser
          if (this.browserClient && this.browserClient.readyState === WebSocket.OPEN) {
            this.browserClient.send(JSON.stringify(message));
            console.log('[MCPBridgeServer] Forwarded message to browser');
          } else {
            // Browser not connected - send error
            const errorResponse = {
              jsonrpc: '2.0',
              id: message.id || null,
              error: {
                code: -32000,
                message: 'Browser MCP server not connected'
              }
            };
            ws.send(JSON.stringify(errorResponse));
            console.log('[MCPBridgeServer] Browser not connected, sent error response');
          }
        }
      } catch (error) {
        console.error('[MCPBridgeServer] Error handling message:', error);
      }
    }

    broadcastToExternalClients(message) {
      let sent = 0;
      for (const client of this.externalClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
          sent++;
        }
      }
      console.log(`[MCPBridgeServer] Broadcast message to ${sent} external client(s)`);
    }

    stop() {
      console.log('[MCPBridgeServer] Stopping server...');

      // Close all connections
      if (this.browserClient) {
        this.browserClient.close();
      }
      for (const client of this.externalClients) {
        client.close();
      }

      // Close server
      if (this.wss) {
        this.wss.close();
      }
      if (this.server) {
        this.server.close();
      }

      console.log('[MCPBridgeServer] Server stopped');
    }
  }

  // CLI entry point
  if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    // Parse CLI args
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--port' && args[i + 1]) {
        options.port = parseInt(args[i + 1]);
        i++;
      } else if (args[i] === '--host' && args[i + 1]) {
        options.host = args[i + 1];
        i++;
      }
    }

    const server = new MCPBridgeServer(options);
    server.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n[MCPBridgeServer] Received SIGINT, shutting down...');
      server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[MCPBridgeServer] Received SIGTERM, shutting down...');
      server.stop();
      process.exit(0);
    });
  }

  module.exports = MCPBridgeServer;
}
