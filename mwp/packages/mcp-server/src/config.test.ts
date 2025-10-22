/**
 * Tests for configuration loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { loadConfig, validateConfig, resolveEnvVariables, getDefaultConfig, mergeConfig } from './config.js';

describe('Configuration', () => {
  const testConfigPath = './test-config.json';

  afterEach(() => {
    try {
      unlinkSync(testConfigPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('loadConfig', () => {
    it('should load default config when no file provided', () => {
      const config = loadConfig();
      expect(config).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.host).toBeDefined();
    });

    it('should load config from file', () => {
      const testConfig = {
        server: {
          port: 8080,
          host: '0.0.0.0',
        },
        mcpServers: [
          {
            name: 'test',
            command: 'test',
          },
        ],
      };

      writeFileSync(testConfigPath, JSON.stringify(testConfig));

      const config = loadConfig(testConfigPath);
      expect(config.port).toBe(8080);
      expect(config.host).toBe('0.0.0.0');
      expect(config.mcpServers).toHaveLength(1);
    });

    it('should throw when config file not found', () => {
      expect(() => loadConfig('./non-existent.json')).toThrow(/not found/);
    });

    it('should throw when config file is invalid JSON', () => {
      writeFileSync(testConfigPath, 'invalid json');
      expect(() => loadConfig(testConfigPath)).toThrow(/Failed to parse/);
    });
  });

  describe('validateConfig', () => {
    it('should accept valid config', () => {
      const config = getDefaultConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject invalid port', () => {
      const config = { ...getDefaultConfig(), port: 70000 };
      expect(() => validateConfig(config)).toThrow(/Port must be between/);
    });

    it('should reject duplicate MCP server names', () => {
      const config = {
        ...getDefaultConfig(),
        mcpServers: [
          { name: 'test', command: 'test' },
          { name: 'test', command: 'test2' },
        ],
      };
      expect(() => validateConfig(config)).toThrow(/Duplicate/);
    });

    it('should reject MCP server without name', () => {
      const config = {
        ...getDefaultConfig(),
        mcpServers: [{ command: 'test' } as any],
      };
      expect(() => validateConfig(config)).toThrow(/missing 'name'/);
    });

    it('should reject MCP server without command', () => {
      const config = {
        ...getDefaultConfig(),
        mcpServers: [{ name: 'test' } as any],
      };
      expect(() => validateConfig(config)).toThrow(/missing 'command'/);
    });

    it('should reject invalid transport type', () => {
      const config = {
        ...getDefaultConfig(),
        mcpServers: [
          {
            name: 'test',
            command: 'test',
            transport: 'invalid' as any,
          },
        ],
      };
      expect(() => validateConfig(config)).toThrow(/invalid transport/);
    });

    it('should reject invalid log level', () => {
      const config = {
        ...getDefaultConfig(),
        logging: { level: 'invalid' as any },
      };
      expect(() => validateConfig(config)).toThrow(/Invalid log level/);
    });
  });

  describe('resolveEnvVariables', () => {
    it('should resolve environment variable placeholders', () => {
      process.env.TEST_VAR = 'test-value';

      const config = {
        ...getDefaultConfig(),
        mcpServers: [
          {
            name: 'test',
            command: 'test',
            env: {
              TOKEN: '${TEST_VAR}',
            },
          },
        ],
      };

      const resolved = resolveEnvVariables(config);
      expect(resolved.mcpServers![0].env!.TOKEN).toBe('test-value');

      delete process.env.TEST_VAR;
    });

    it('should leave non-placeholder values unchanged', () => {
      const config = {
        ...getDefaultConfig(),
        mcpServers: [
          {
            name: 'test',
            command: 'test',
            env: {
              STATIC: 'static-value',
            },
          },
        ],
      };

      const resolved = resolveEnvVariables(config);
      expect(resolved.mcpServers![0].env!.STATIC).toBe('static-value');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const config = getDefaultConfig();

      expect(config).toMatchObject({
        port: 3000,
        host: 'localhost',
        mcpServers: [],
        security: expect.any(Object),
        logging: expect.any(Object),
        widgets: expect.any(Object),
      });
    });
  });

  describe('mergeConfig', () => {
    it('should merge multiple configs', () => {
      const config1 = { port: 3000 };
      const config2 = { host: '0.0.0.0' };
      const config3 = {
        mcpServers: [{ name: 'test', command: 'test' }],
      };

      const merged = mergeConfig(config1, config2, config3);

      expect(merged.port).toBe(3000);
      expect(merged.host).toBe('0.0.0.0');
      expect(merged.mcpServers).toHaveLength(1);
    });

    it('should override values in order', () => {
      const config1 = { port: 3000 };
      const config2 = { port: 4000 };
      const config3 = { port: 5000 };

      const merged = mergeConfig(config1, config2, config3);

      expect(merged.port).toBe(5000);
    });

    it('should deep merge nested objects', () => {
      const config1 = {
        security: {
          cors: { origin: 'http://localhost' },
        },
      };
      const config2 = {
        security: {
          cors: { credentials: true },
        },
      };

      const merged = mergeConfig(config1, config2);

      expect(merged.security?.cors?.origin).toBe('http://localhost');
      expect(merged.security?.cors?.credentials).toBe(true);
    });
  });
});
