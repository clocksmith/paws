/**
 * Configuration loader and validator
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { ServerConfig, MCPServerConfig } from './types.js';

/**
 * Load configuration from environment and file
 */
export function loadConfig(configPath?: string): ServerConfig {
  // Load environment variables
  dotenv.config();

  let fileConfig: Partial<ServerConfig> = {};

  // Load configuration file if provided
  if (configPath) {
    const resolvedPath = resolve(process.cwd(), configPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    try {
      const content = readFileSync(resolvedPath, 'utf-8');
      fileConfig = JSON.parse(content);
    } catch (error: any) {
      throw new Error(`Failed to parse configuration file: ${error.message}`);
    }
  }

  // Merge configurations (environment variables take precedence)
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '') || fileConfig.server?.port || 3000,
    host: process.env.HOST || fileConfig.server?.host || 'localhost',
    mcpServers: parseMCPServers(process.env.MCP_SERVERS) || fileConfig.mcpServers || [],
    security: {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || fileConfig.security?.cors?.origin || '*',
        credentials: process.env.CORS_CREDENTIALS === 'true' || fileConfig.security?.cors?.credentials,
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '') || fileConfig.security?.rateLimit?.windowMs || 900000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '') || fileConfig.security?.rateLimit?.max || 100,
      },
      helmet: fileConfig.security?.helmet,
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || fileConfig.logging?.level || 'info',
      file: process.env.LOG_FILE || fileConfig.logging?.file,
      console: process.env.LOG_CONSOLE !== 'false',
      format: (process.env.LOG_FORMAT as any) || fileConfig.logging?.format || 'simple',
    },
    widgets: fileConfig.widgets || {},
  };

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Parse MCP servers from environment variable
 */
function parseMCPServers(envValue?: string): MCPServerConfig[] | undefined {
  if (!envValue) {
    return undefined;
  }

  try {
    const servers = JSON.parse(envValue);

    if (!Array.isArray(servers)) {
      throw new Error('MCP_SERVERS must be a JSON array');
    }

    return servers;
  } catch (error: any) {
    throw new Error(`Failed to parse MCP_SERVERS: ${error.message}`);
  }
}

/**
 * Validate configuration
 */
function validateConfig(config: ServerConfig): void {
  // Validate port
  if (config.port && (config.port < 1 || config.port > 65535)) {
    throw new Error('Port must be between 1 and 65535');
  }

  // Validate host
  if (config.host && typeof config.host !== 'string') {
    throw new Error('Host must be a string');
  }

  // Validate MCP servers
  if (config.mcpServers) {
    if (!Array.isArray(config.mcpServers)) {
      throw new Error('mcpServers must be an array');
    }

    config.mcpServers.forEach((server, index) => {
      if (!server.name) {
        throw new Error(`MCP server at index ${index} is missing 'name'`);
      }

      if (!server.command) {
        throw new Error(`MCP server '${server.name}' is missing 'command'`);
      }

      if (server.args && !Array.isArray(server.args)) {
        throw new Error(`MCP server '${server.name}' args must be an array`);
      }

      if (server.env && typeof server.env !== 'object') {
        throw new Error(`MCP server '${server.name}' env must be an object`);
      }

      if (server.transport && !['stdio', 'sse', 'websocket'].includes(server.transport)) {
        throw new Error(
          `MCP server '${server.name}' has invalid transport: ${server.transport}`
        );
      }
    });

    // Check for duplicate names
    const names = new Set<string>();
    config.mcpServers.forEach((server) => {
      if (names.has(server.name)) {
        throw new Error(`Duplicate MCP server name: ${server.name}`);
      }
      names.add(server.name);
    });
  }

  // Validate logging level
  const validLevels = ['error', 'warn', 'info', 'debug'];
  if (config.logging?.level && !validLevels.includes(config.logging.level)) {
    throw new Error(`Invalid log level: ${config.logging.level}. Must be one of: ${validLevels.join(', ')}`);
  }
}

/**
 * Resolve environment variable placeholders in config
 */
export function resolveEnvVariables(config: ServerConfig): ServerConfig {
  const resolved = JSON.parse(JSON.stringify(config));

  // Resolve env variables in MCP server configurations
  if (resolved.mcpServers) {
    resolved.mcpServers.forEach((server: MCPServerConfig) => {
      if (server.env) {
        Object.keys(server.env).forEach((key) => {
          const value = server.env![key];
          if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
            const envVar = value.slice(2, -1);
            server.env![key] = process.env[envVar] || '';
          }
        });
      }
    });
  }

  return resolved;
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): ServerConfig {
  return {
    port: 3000,
    host: 'localhost',
    mcpServers: [],
    security: {
      cors: {
        origin: '*',
        credentials: false,
      },
      rateLimit: {
        windowMs: 900000, // 15 minutes
        max: 100,
      },
      helmet: true,
    },
    logging: {
      level: 'info',
      console: true,
      format: 'simple',
    },
    widgets: {},
  };
}

/**
 * Merge configurations
 */
export function mergeConfig(...configs: Partial<ServerConfig>[]): ServerConfig {
  const merged: ServerConfig = getDefaultConfig();

  configs.forEach((config) => {
    if (config.port !== undefined) merged.port = config.port;
    if (config.host !== undefined) merged.host = config.host;

    if (config.mcpServers !== undefined) {
      merged.mcpServers = [...(merged.mcpServers || []), ...(config.mcpServers || [])];
    }

    if (config.security) {
      merged.security = {
        ...merged.security,
        ...config.security,
        cors: { ...merged.security?.cors, ...config.security.cors },
        rateLimit: { ...merged.security?.rateLimit, ...config.security.rateLimit },
      };
    }

    if (config.logging) {
      merged.logging = { ...merged.logging, ...config.logging };
    }

    if (config.widgets) {
      merged.widgets = { ...merged.widgets, ...config.widgets };
    }
  });

  return merged;
}
