/**
 * Shared test helpers for PAWS CLI tests
 */

const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

// Resolve paths to the CLI scripts
const catsCliPath = path.resolve(__dirname, "..", "bin", "cats.js");
const dogsCliPath = path.resolve(__dirname, "..", "bin", "dogs.js");

/**
 * Helper function to run a CLI command with interactive input.
 * @param {string} command The base command to execute.
 * @param {string[]} inputs Array of strings to be piped to stdin.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function runCliWithInput(command, inputs = []) {
  // Parse command string properly, handling quoted arguments
  const args = [];
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

    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });

    child.on("error", (err) => reject(err));

    // Write inputs to stdin
    let currentInput = 0;
    const writeNextInput = () => {
      if (currentInput < inputs.length) {
        child.stdin.write(inputs[currentInput] + "\n");
        currentInput++;
      } else {
        child.stdin.end();
      }
    };

    // Wait for prompts before writing
    child.stderr.on("data", (data) => {
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
 * @param {Object} files - Object mapping file paths to content
 * @returns {Promise<string>} Path to temp directory
 */
async function createTempDir(files = {}) {
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
 * @param {string} tempDir - Directory to remove
 */
async function cleanupTempDir(tempDir) {
  await fs.rm(tempDir, { recursive: true, force: true });
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file content or return null if doesn't exist
 * @param {string} filePath - Path to read
 * @returns {Promise<string|null>}
 */
async function readFileOrNull(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

module.exports = {
  catsCliPath,
  dogsCliPath,
  runCliWithInput,
  createTempDir,
  cleanupTempDir,
  fileExists,
  readFileOrNull
};
