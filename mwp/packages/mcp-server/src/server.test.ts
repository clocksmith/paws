/**
 * Tests for MCP server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServer } from './server.js';
import { ServerConfig } from './types.js';

describe('MCPServer', () => {
  let server: MCPServer;
  const testConfig: ServerConfig = {
    port: 3001,
    host: 'localhost',
    mcpServers: [],
    logging: {
      level: 'error',
      console: false,
    },
  };

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create server with default config', () => {
      server = new MCPServer();
      expect(server).toBeDefined();
    });

    it('should create server with custom config', () => {
      server = new MCPServer(testConfig);
      expect(server).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start server successfully', async () => {
      server = new MCPServer(testConfig);
      await server.start();

      const status = server.getStatus();
      expect(status.status).toBeDefined();
    });

    it('should accept HTTP requests after starting', async () => {
      server = new MCPServer(testConfig);
      await server.start();

      const response = await fetch(`http://localhost:3001/api/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop server gracefully', async () => {
      server = new MCPServer(testConfig);
      await server.start();
      await server.stop();

      // Server should not accept connections after stop
      await expect(
        fetch(`http://localhost:3001/api/health`)
      ).rejects.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return server status', async () => {
      server = new MCPServer(testConfig);
      await server.start();

      const status = server.getStatus();

      expect(status).toMatchObject({
        status: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        mcpServers: expect.any(Object),
        connections: {
          websocket: expect.any(Number),
          http: expect.any(Number),
        },
      });
    });

    it('should show degraded status when no MCP servers', async () => {
      server = new MCPServer(testConfig);
      await server.start();

      const status = server.getStatus();
      expect(status.status).toBe('degraded');
    });
  });

  describe('getMCPServers', () => {
    it('should return empty array when no servers', async () => {
      server = new MCPServer(testConfig);
      await server.start();

      const servers = server.getMCPServers();
      expect(servers).toEqual([]);
    });
  });

  describe('addMCPServer', () => {
    it('should reject invalid server config', async () => {
      server = new MCPServer(testConfig);
      await server.start();

      await expect(
        server.addMCPServer({
          name: 'test',
          command: 'invalid-command-that-does-not-exist',
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate server names', async () => {
      server = new MCPServer(testConfig);
      await server.start();

      const config = {
        name: 'test',
        command: 'echo',
        args: ['test'],
      };

      // Add server (will fail but name will be registered)
      try {
        await server.addMCPServer(config);
      } catch {
        // Ignore error
      }

      // Try to add with same name
      await expect(server.addMCPServer(config)).rejects.toThrow(/already exists/);
    });
  });

  describe('removeMCPServer', () => {
    it('should throw when removing non-existent server', async () => {
      server = new MCPServer(testConfig);
      await server.start();

      await expect(server.removeMCPServer('non-existent')).rejects.toThrow(/not found/);
    });
  });

  describe('HTTP endpoints', () => {
    beforeEach(async () => {
      server = new MCPServer(testConfig);
      await server.start();
    });

    it('GET /api/health should return health status', async () => {
      const response = await fetch('http://localhost:3001/api/health');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBeDefined();
    });

    it('GET /api/mcp-servers should return server list', async () => {
      const response = await fetch('http://localhost:3001/api/mcp-servers');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.servers)).toBe(true);
    });

    it('POST /api/mcp-servers should validate input', async () => {
      const response = await fetch('http://localhost:3001/api/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.code).toBe('INVALID_CONFIG');
    });

    it('DELETE /api/mcp-servers/:name should return 404 for non-existent', async () => {
      const response = await fetch('http://localhost:3001/api/mcp-servers/non-existent', {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.code).toBe('SERVER_NOT_FOUND');
    });

    it('GET /api/widgets should return widget list', async () => {
      const response = await fetch('http://localhost:3001/api/widgets');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
