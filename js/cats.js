#!/usr/bin/env node
// cats.js - Bundles project files into a single text artifact for LLMs.
// Supports both Node.js CLI and browser/library usage.

// --- Environment Detection ---
const IS_NODE =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

// --- Node.js Specific Imports ---
// These are conditionally required only in the Node.js environment.
let fs, path, glob, yargs;
if (IS_NODE) {
  fs = require("fs").promises;
  path = require("path");
  glob = require("glob");
  yargs = require("yargs/yargs");
  const { hideBin } = require("yargs/helpers");
}

// --- Configuration Constants ---
const DEFAULT_SYS_PROMPT_FILENAME = "sys/sys_a.md";
const DEFAULT_OUTPUT_FILENAME = "cats.md";
const DEFAULT_ENCODING = "utf-8";
const DEFAULT_EXCLUDES = [
  ".git",
  "node_modules",
  "**/__pycache__",
  "**/*.pyc",
  ".DS_Store",
];

// --- Bundle Structure Constants ---
const PERSONA_HEADER = "\n--- START PERSONA ---\n";
const PERSONA_FOOTER = "\n--- END PERSONA ---\n";
const SYS_PROMPT_POST_SEPARATOR =
  "\n--- END PREPENDED INSTRUCTIONS ---\nThe following content is the Cats Bundle.\n";
const BUNDLE_HEADER_PREFIX = "# Cats Bundle";
const BUNDLE_FORMAT_PREFIX = "# Format: ";
const DELTA_REFERENCE_HINT_PREFIX = "# Delta Reference: ";
const BASE64_HINT_TEXT = "(Content:Base64)";
const START_MARKER_TEMPLATE = "🐈 --- CATS_START_FILE: {path}{hint} ---";
const END_MARKER_TEMPLATE = "🐈 --- CATS_END_FILE: {path}{hint} ---";

/**
 * @typedef {Object} VirtualFile
 * @property {string} path - The relative path of the file.
 * @property {string | Buffer | Uint8Array} content - The file content.
 */

/**
 * @typedef {Object} FileObject
 * @property {string} path - Relative path for the bundle marker.
 * @property {Buffer} contentBytes - File content as a Buffer.
 * @property {boolean} isBinary - True if content is detected as binary.
 */

/**
 * A simple TextEncoder/Decoder polyfill for browser environments.
 */
const _TextEncoder =
  typeof TextEncoder !== "undefined"
    ? TextEncoder
    : class {
        encode(str) {
          const bytes = [];
          for (let i = 0; i < str.length; i++) {
            let code = str.charCodeAt(i);
            if (code < 0x80) bytes.push(code);
            else if (code < 0x800)
              bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            else if (code < 0xd800 || code >= 0xe000)
              bytes.push(
                0xe0 | (code >> 12),
                0x80 | ((code >> 6) & 0x3f),
                0x80 | (code & 0x3f)
              );
            else {
              code =
                0x10000 +
                (((code & 0x3ff) << 10) | (str.charCodeAt(++i) & 0x3ff));
              bytes.push(
                0xf0 | (code >> 18),
                0x80 | ((code >> 12) & 0x3f),
                0x80 | ((code >> 6) & 0x3f),
                0x80 | (code & 0x3f)
              );
            }
          }
          return new Uint8Array(bytes);
        }
      };

/**
 * Normalizes content to a Buffer. Works in Node.js and browsers.
 * @param {string | Buffer | Uint8Array} content
 * @returns {Buffer}
 */
function toBuffer(content) {
  if (typeof content === "string") {
    return Buffer.from(new _TextEncoder().encode(content));
  }
  return Buffer.from(content);
}

/**
 * Detects if content is likely binary.
 * @param {Buffer} contentBytes
 * @returns {boolean}
 */
function detectIsBinary(contentBytes) {
  // A common heuristic: check for null bytes. Real text files rarely have them.
  for (let i = 0; i < Math.min(contentBytes.length, 512); i++) {
    if (contentBytes[i] === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Prepares an array of FileObjects from virtual file representations.
 * @param {VirtualFile[]} files
 * @returns {FileObject[]}
 */
function prepareFileObjectsFromVirtualFS(files) {
  return files.map((file) => {
    const contentBytes = toBuffer(file.content);
    return {
      path: file.path.replace(/\\/g, "/"), // Normalize to forward slashes
      contentBytes,
      isBinary: detectIsBinary(contentBytes),
    };
  });
}

/**
 * Creates the final bundle string from an array of FileObjects.
 * @param {FileObject[]} fileObjects
 * @param {Object} options
 * @returns {string}
 */
function createBundleString(fileObjects, options) {
  const { prepareForDelta, forceEncoding } = options;
  const hasBinaries = fileObjects.some((f) => f.isBinary);
  const formatDesc =
    forceEncoding === "b64"
      ? "Base64"
      : `Raw UTF-8${hasBinaries ? "; binaries as Base64" : ""}`;

  const bundleParts = [
    BUNDLE_HEADER_PREFIX,
    `${BUNDLE_FORMAT_PREFIX}${formatDesc}`,
  ];
  if (prepareForDelta) {
    bundleParts.push(`${DELTA_REFERENCE_HINT_PREFIX}Yes`);
  }

  for (const fileObj of fileObjects) {
    const isBase64 = forceEncoding === "b64" || fileObj.isBinary;
    const contentStr = isBase64
      ? fileObj.contentBytes.toString("base64")
      : fileObj.contentBytes.toString(DEFAULT_ENCODING);
    const hint =
      isBase64 && forceEncoding !== "b64" ? ` ${BASE64_HINT_TEXT}` : "";

    bundleParts.push(
      "",
      START_MARKER_TEMPLATE.replace("{path}", fileObj.path).replace(
        "{hint}",
        hint
      )
    );
    bundleParts.push(contentStr);
    bundleParts.push(
      END_MARKER_TEMPLATE.replace("{path}", fileObj.path).replace(
        "{hint}",
        hint
      )
    );
  }

  return bundleParts.join("\n") + "\n";
}

/**
 * The core bundling logic, abstracted to work with a list of FileObjects.
 * This function is environment-agnostic.
 * @param {FileObject[]} allFileObjects - The complete list of files to bundle.
 * @param {Object} options - Bundling options.
 * @returns {string} The complete bundle string including prepended content.
 */
function buildFinalBundle(allFileObjects, options) {
  const { personaContent, sysPromptContent } = options;

  let bundleContentString = createBundleString(allFileObjects, options);
  let finalOutput = "";

  if (personaContent) {
    finalOutput += PERSONA_HEADER + personaContent + PERSONA_FOOTER;
  }
  if (sysPromptContent) {
    finalOutput += sysPromptContent + SYS_PROMPT_POST_SEPARATOR;
  }
  finalOutput += bundleContentString;

  return finalOutput;
}

// --- Main API Function ---

/**
 * Creates a PAWS bundle from a set of files.
 * In Node.js, it reads from the file system based on glob patterns.
 * In the browser, it operates on a provided virtual file system.
 *
 * @param {Object} options
 * @param {string[]} [options.paths=[]] - (Node.js) Glob patterns or paths to include.
 * @param {string[]} [options.exclude=[]] - (Node.js) Glob patterns to exclude.
 * @param {string} [options.personaFile] - (Node.js) Path to a persona file to prepend.
 * @param {string} [options.sysPromptFile] - (Node.js) Path to a system prompt file.
 * @param {boolean} [options.useDefaultExcludes=true] - (Node.js) Whether to use default excludes.
 * @param {VirtualFile[]} [options.virtualFS=[]] - (Browser) An array of {path, content} objects.
 * @param {string} [options.personaContent] - (Browser) String content for the persona.
 * @param {string} [options.sysPromptContent] - (Browser) String content for the system prompt.
 * @param {boolean} [options.prepareForDelta=false] - Add delta reference hint.
 * @param {string} [options.forceEncoding='auto'] - Force encoding ('auto' or 'b64').
 * @returns {Promise<string>} The generated bundle string.
 */
async function createBundle(options = {}) {
  // --- Node.js File System Logic ---
  if (IS_NODE) {
    const {
      paths = [],
      exclude = [],
      useDefaultExcludes = true,
      personaFile,
      sysPromptFile,
      prepareForDelta = false,
      forceEncoding = "auto",
    } = options;

    const ignorePatterns = exclude.slice();
    if (useDefaultExcludes) {
      ignorePatterns.push(...DEFAULT_EXCLUDES);
    }

    const files = (
      await Promise.all(
        paths.map((p) =>
          glob.glob(p, { nodir: true, dot: true, ignore: ignorePatterns })
        )
      )
    ).flat();

    const fileObjects = await Promise.all(
      files.map(async (file) => ({
        path: file,
        content: await fs.readFile(file),
      }))
    );

    // Read prepended files
    const finalOptions = { ...options };
    if (personaFile) {
      finalOptions.personaContent = await fs.readFile(
        personaFile,
        DEFAULT_ENCODING
      );
    }
    if (sysPromptFile) {
      finalOptions.sysPromptContent = await fs.readFile(
        sysPromptFile,
        DEFAULT_ENCODING
      );
    }

    const processedObjects = prepareFileObjectsFromVirtualFS(fileObjects);
    return buildFinalBundle(processedObjects, finalOptions);
  }
  // --- Browser/Library Virtual File System Logic ---
  else {
    const {
      virtualFS = [],
      personaContent = "",
      sysPromptContent = "",
      prepareForDelta = false,
      forceEncoding = "auto",
    } = options;
    const fileObjects = prepareFileObjectsFromVirtualFS(virtualFS);
    return buildFinalBundle(fileObjects, {
      personaContent,
      sysPromptContent,
      prepareForDelta,
      forceEncoding,
    });
  }
}

// --- Node.js Command-Line Interface (CLI) Logic ---

/**
 * Main function to run the CLI.
 */
async function mainCli() {
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: node cats.js [PATH_PATTERN...] [options]")
    .example(
      'node cats.js "src/**/*.js" -o web_project.md',
      "Bundle all JS files in src"
    )
    .example(
      'node cats.js . -x "node_modules/**" -p persona.md',
      "Bundle current directory with a persona"
    )
    .command("$0 [paths...]", "Default command to bundle files", (yargs) => {
      yargs.positional("paths", {
        describe: "One or more files, directories, or glob patterns to include",
        type: "string",
      });
    })
    .option("o", {
      alias: "output",
      describe: `Output bundle file (default: ${DEFAULT_OUTPUT_FILENAME}). Use '-' for stdout.`,
      type: "string",
      default: DEFAULT_OUTPUT_FILENAME,
    })
    .option("x", {
      alias: "exclude",
      describe: "A glob pattern to exclude files. Can be used multiple times.",
      type: "array",
      default: [],
    })
    .option("p", {
      alias: "persona",
      describe: "Path to a persona file to prepend to the entire output.",
      type: "string",
    })
    .option("s", {
      alias: "sys-prompt-file",
      describe: `System prompt filename for prepending (default: ${DEFAULT_SYS_PROMPT_FILENAME}).`,
      type: "string",
      default: DEFAULT_SYS_PROMPT_FILENAME,
    })
    .option("t", {
      alias: "prepare-for-delta",
      describe: "Mark the bundle as a clean reference for delta operations.",
      type: "boolean",
      default: false,
    })
    .option("q", {
      alias: "quiet",
      describe: "Suppress informational messages.",
      type: "boolean",
      default: false,
    })
    .option("y", {
      alias: "yes",
      describe: "Automatically confirm writing the output file.",
      type: "boolean",
      default: false,
    })
    .option("N", {
      alias: "no-default-excludes",
      describe: `Disable default excludes: ${DEFAULT_EXCLUDES.join(", ")}.`,
      type: "boolean",
      default: false,
    })
    .option("E", {
      alias: "force-encoding",
      describe:
        "Force encoding: 'auto' (default) or 'b64' (force all as Base64).",
      choices: ["auto", "b64"],
      default: "auto",
    })
    .help("h")
    .alias("h", "help").argv;

  if (argv.paths.length === 0) {
    console.error("Error: You must specify at least one path to include.");
    console.error("Use --help for more information.");
    process.exit(1);
  }

  // In quiet mode, stdout is for the bundle only. Log to stderr.
  const log = argv.q ? () => {} : (...args) => console.error(...args);

  log("--- Starting PAWS Bundling ---");

  const bundleString = await createBundle({
    paths: argv.paths,
    exclude: argv.x,
    personaFile: argv.p,
    sysPromptFile: argv.s,
    useDefaultExcludes: !argv.N,
    prepareForDelta: argv.t,
    forceEncoding: argv.E,
  });

  if (!bundleString.trim()) {
    log("No files matched the given criteria. Exiting.");
    process.exit(0);
  }

  if (argv.o === "-") {
    process.stdout.write(bundleString);
  } else {
    const outputPath = path.resolve(process.cwd(), argv.o);
    if (!argv.y && process.stdin.isTTY) {
      const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      await new Promise((resolve, reject) => {
        readline.question(
          `About to write bundle to '${outputPath}'. Proceed? [Y/n]: `,
          (answer) => {
            readline.close();
            if (answer.toLowerCase() === "n") {
              log("Operation cancelled.");
              process.exit(0);
            }
            resolve();
          }
        );
      });
    }
    await fs.writeFile(outputPath, bundleString);
    log(`\nOutput successfully written to: '${outputPath}'`);
  }
}

// --- Exports and Execution ---

// Export the main function for library use
module.exports = { createBundle };

// If run directly from Node.js, execute the CLI
if (IS_NODE && require.main === module) {
  mainCli().catch((err) => {
    console.error(`\nAn unexpected error occurred: ${err.message}`);
    process.exit(1);
  });
}
