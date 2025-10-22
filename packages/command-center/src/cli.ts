#!/usr/bin/env node
/**
 * PAWS Command Center CLI
 *
 * Interactive command-line interface for orchestrating MCP servers
 */

import { PAWSCommandCenter } from "./index.js";
import { getDefaultServers } from "./servers/registry.js";
import { Command } from "commander";

const program = new Command();

program
  .name("paws")
  .description("PAWS Command Center - Orchestrate GAMMA, REPLOID, and MCP servers")
  .version("1.0.0");

/**
 * List command - Show available servers and their capabilities
 */
program
  .command("list")
  .description("List connected servers and their capabilities")
  .action(async () => {
    const commandCenter = new PAWSCommandCenter({
      servers: getDefaultServers(),
    });

    try {
      await commandCenter.initialize();

      console.log("\n=== Connected Servers ===\n");

      const servers = commandCenter.getConnectedServers();

      for (const serverName of servers) {
        console.log(`\n📦 ${serverName.toUpperCase()}`);

        // List resources
        try {
          const resources = await commandCenter.listResources(serverName);
          console.log(`  Resources: ${resources.length}`);
          for (const resource of resources.slice(0, 3)) {
            console.log(`    • ${resource.name} (${resource.uri})`);
          }
          if (resources.length > 3) {
            console.log(`    ... and ${resources.length - 3} more`);
          }
        } catch {}

        // List tools
        try {
          const tools = await commandCenter.listTools(serverName);
          console.log(`  Tools: ${tools.length}`);
          for (const tool of tools.slice(0, 3)) {
            console.log(`    • ${tool.name}${tool.description ? ` - ${tool.description}` : ""}`);
          }
          if (tools.length > 3) {
            console.log(`    ... and ${tools.length - 3} more`);
          }
        } catch {}

        // List prompts
        try {
          const prompts = await commandCenter.listPrompts(serverName);
          console.log(`  Prompts: ${prompts.length}`);
          for (const prompt of prompts) {
            console.log(
              `    • ${prompt.name}${prompt.description ? ` - ${prompt.description}` : ""}`
            );
          }
        } catch {}
      }

      console.log("\n");

      await commandCenter.shutdown();
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Status command - Show server connection status
 */
program
  .command("status")
  .description("Show connection status of all servers")
  .action(async () => {
    const commandCenter = new PAWSCommandCenter({
      servers: getDefaultServers(),
    });

    try {
      await commandCenter.initialize();

      console.log("\n=== Server Status ===\n");

      const status = commandCenter.getStatus();

      for (const [name, state] of Object.entries(status)) {
        const icon = state === "connected" ? "✓" : state === "error" ? "✗" : "○";
        const color = state === "connected" ? "\x1b[32m" : state === "error" ? "\x1b[31m" : "\x1b[33m";
        console.log(`${color}${icon}\x1b[0m ${name}: ${state}`);
      }

      console.log("\n");

      await commandCenter.shutdown();
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Roots command - Show filesystem roots
 */
program
  .command("roots")
  .description("Show filesystem roots for server coordination")
  .action(async () => {
    const commandCenter = new PAWSCommandCenter({
      servers: getDefaultServers(),
    });

    try {
      await commandCenter.initialize();

      console.log("\n=== Filesystem Roots ===\n");

      const roots = commandCenter.getRoots();

      for (const root of roots) {
        console.log(`📁 ${root.name}`);
        console.log(`   ${root.uri}\n`);
      }

      await commandCenter.shutdown();
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Tool command - Execute a tool on a server
 */
program
  .command("tool <server> <tool> [args...]")
  .description("Execute a tool on a server")
  .action(async (server: string, tool: string, argsArray: string[]) => {
    const commandCenter = new PAWSCommandCenter({
      servers: getDefaultServers(),
    });

    try {
      await commandCenter.initialize();

      // Parse args as key=value pairs
      const args: Record<string, unknown> = {};
      for (const arg of argsArray) {
        const [key, value] = arg.split("=");
        if (key && value) {
          // Try to parse as JSON, fallback to string
          try {
            args[key] = JSON.parse(value);
          } catch {
            args[key] = value;
          }
        }
      }

      console.log(`\nExecuting ${tool} on ${server}...`);
      console.log(`Arguments:`, args);
      console.log("");

      const result = await commandCenter.callTool(server, tool, args);

      console.log("Result:");
      for (const content of result.content) {
        if (content.type === "text" && "text" in content) {
          console.log(content.text);
        } else {
          console.log(JSON.stringify(content, null, 2));
        }
      }

      console.log("\n");

      await commandCenter.shutdown();
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Resource command - Read a resource from a server
 */
program
  .command("resource <server> <uri>")
  .description("Read a resource from a server")
  .action(async (server: string, uri: string) => {
    const commandCenter = new PAWSCommandCenter({
      servers: getDefaultServers(),
    });

    try {
      await commandCenter.initialize();

      console.log(`\nReading ${uri} from ${server}...`);
      console.log("");

      const result = await commandCenter.readResource(server, uri);

      for (const content of result.contents) {
        if ("text" in content) {
          console.log(content.text);
        } else {
          console.log(JSON.stringify(content, null, 2));
        }
      }

      console.log("\n");

      await commandCenter.shutdown();
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Interactive REPL command
 */
program
  .command("repl")
  .description("Start an interactive REPL session")
  .action(async () => {
    console.log("\n🚀 PAWS Command Center Interactive REPL\n");
    console.log("Interactive REPL not yet implemented.");
    console.log("Use individual commands like: paws list, paws status, paws tool, etc.\n");
  });

// Parse arguments
program.parse();
