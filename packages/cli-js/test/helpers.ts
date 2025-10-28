/**
 * Shared test helpers for PAWS CLI tests
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Resolve paths to the CLI scripts
export const catsCliPath = path.resolve(__dirname, "..", "dist", "bin", "cats.js");
export const dogsCliPath = path.resolve(__dirname, "..", "dist", "bin", "dogs.js");

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Helper function to run a CLI command with interactive input.
 */
export function runCliWithInput(command: string, inputs: string[] = []): Promise<CommandResult> {
  // Parse command string properly, handling quoted arguments
  const args: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  const [cmd, ...cmdArgs] = args;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => (stdout += data.toString()));
    child.stderr?.on("data", (data: Buffer) => (stderr += data.toString()));

    child.on("close", (code: number | null) => {
      resolve({ stdout, stderr, code });
    });

    child.on("error", (err: Error) => reject(err));

    // Write inputs to stdin
    let currentInput = 0;
    const writeNextInput = () => {
      if (currentInput < inputs.length) {
        child.stdin?.write(inputs[currentInput] + "\n");
        currentInput++;
      } else {
        child.stdin?.end();
      }
    };

    // Wait for prompts before writing
    child.stderr?.on("data", (data: Buffer) => {
      if (data.toString().includes("? [y/N")) {
        writeNextInput();
      }
    });

    // Start the process
    writeNextInput();
  });
}

/**
 * Create a temporary test directory with optional files
 */
export async function createTempDir(files: Record<string, string> = {}): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paws-test-"));

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  return tempDir;
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  await fs.rm(tempDir, { recursive: true, force: true });
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file content or return null if doesn't exist
 */
export async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// Also export as CommonJS for compatibility
module.exports = {
  catsCliPath,
  dogsCliPath,
  runCliWithInput,
  createTempDir,
  cleanupTempDir,
  fileExists,
  readFileOrNull
};
