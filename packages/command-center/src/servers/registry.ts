/**
 * Server Registry
 *
 * Pre-configured MCP server definitions for GAMMA, REPLOID,
 * and popular public MCP servers.
 */

import type { ServerConfig } from "../types/index.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the PAWS root directory
 */
function getPAWSRoot(): string {
  // Command center is at: paws/packages/command-center
  // So PAWS root is 3 levels up from src/
  return path.resolve(__dirname, "../../../..");
}

/**
 * GAMMA MCP Server configuration
 */
export function getGammaServerConfig(): ServerConfig {
  const pawsRoot = getPAWSRoot();
  const gammaServerPath = path.join(pawsRoot, "../gamma/mcp-server/server.py");

  return {
    name: "gamma",
    command: "python3",
    args: [gammaServerPath],
    env: {
      PYTHONUNBUFFERED: "1",
    },
    trusted: true,
    description: "GAMMA LLM experimentation toolkit - model inference, comparison, and benchmarking",
  };
}

/**
 * REPLOID MCP Server configuration
 */
export function getReploidServerConfig(): ServerConfig {
  const pawsRoot = getPAWSRoot();
  const reploidServerPath = path.join(
    pawsRoot,
    "packages/reploid/mcp-server/build/server.js"
  );

  return {
    name: "reploid",
    command: "node",
    args: [reploidServerPath],
    trusted: false, // Requires approval for destructive operations
    description: "REPLOID recursive self-improvement - code introspection and modification",
  };
}

/**
 * Filesystem MCP Server configuration
 */
export function getFilesystemServerConfig(allowedDirectories?: string[]): ServerConfig {
  return {
    name: "filesystem",
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      ...(allowedDirectories || [process.cwd()]),
    ],
    trusted: true,
    description: "Official MCP filesystem server - read/write files within allowed directories",
  };
}

/**
 * GitHub MCP Server configuration
 */
export function getGithubServerConfig(token?: string): ServerConfig {
  return {
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: token ? { GITHUB_PERSONAL_ACCESS_TOKEN: token } : undefined,
    trusted: true,
    description: "Official MCP GitHub server - repository operations and API access",
  };
}

/**
 * Puppeteer MCP Server configuration
 */
export function getPuppeteerServerConfig(): ServerConfig {
  return {
    name: "puppeteer",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    trusted: true,
    description: "Official MCP Puppeteer server - web scraping and browser automation",
  };
}

/**
 * PostgreSQL MCP Server configuration
 */
export function getPostgresServerConfig(connectionString: string): ServerConfig {
  return {
    name: "postgres",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", connectionString],
    trusted: true,
    description: "Official MCP PostgreSQL server - database queries and operations",
  };
}

/**
 * Brave Search MCP Server configuration
 */
export function getBraveSearchServerConfig(apiKey: string): ServerConfig {
  return {
    name: "brave-search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: {
      BRAVE_API_KEY: apiKey,
    },
    trusted: true,
    description: "Official MCP Brave Search server - web search capabilities",
  };
}

/**
 * Get default server configurations for PAWS
 */
export function getDefaultServers(): ServerConfig[] {
  const servers: ServerConfig[] = [];

  // Always include GAMMA if available
  try {
    const gammaConfig = getGammaServerConfig();
    if (fs.existsSync(gammaConfig.args[0])) {
      servers.push(gammaConfig);
    }
  } catch {
    console.error("[Registry] GAMMA server not found");
  }

  // Always include REPLOID if available
  try {
    const reploidConfig = getReploidServerConfig();
    if (fs.existsSync(reploidConfig.args[0])) {
      servers.push(reploidConfig);
    }
  } catch {
    console.error("[Registry] REPLOID server not found");
  }

  // Include filesystem server for current directory
  servers.push(getFilesystemServerConfig([process.cwd()]));

  return servers;
}

/**
 * Get all available public MCP servers
 */
export function getPublicServers(): Omit<ServerConfig, "env">[] {
  return [
    {
      name: "filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
      trusted: true,
      description: "Official MCP filesystem server",
    },
    {
      name: "github",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      trusted: true,
      description: "Official MCP GitHub server",
    },
    {
      name: "puppeteer",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
      trusted: true,
      description: "Official MCP Puppeteer server",
    },
    {
      name: "postgres",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
      trusted: true,
      description: "Official MCP PostgreSQL server",
    },
    {
      name: "brave-search",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      trusted: true,
      description: "Official MCP Brave Search server",
    },
    {
      name: "memory",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
      trusted: true,
      description: "Official MCP memory/knowledge graph server",
    },
    {
      name: "sqlite",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite"],
      trusted: true,
      description: "Official MCP SQLite server",
    },
  ];
}

/**
 * Create a custom server configuration
 */
export function createCustomServer(
  name: string,
  command: string,
  args: string[],
  options: {
    env?: Record<string, string>;
    trusted?: boolean;
    description?: string;
  } = {}
): ServerConfig {
  return {
    name,
    command,
    args,
    env: options.env,
    trusted: options.trusted ?? false,
    description: options.description,
  };
}
