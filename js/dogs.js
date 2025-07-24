#!/usr/bin/env node
/**
 * @file dogs.js
 * @description Extracts files from a PAWS bundle, applying deltas if needed.
 * This script is a core component of the Prompt-Assisted Workflow System (PAWS).
 * It supports both Node.js for command-line operations and can be used as a
 * library in browser environments.
 * @version 2.0.0
 */

// --- Environment Detection ---
const IS_NODE =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

// --- Node.js Specific Imports ---
let fs, path, readline, yargs;
if (IS_NODE) {
  fs = require("fs").promises;
  path = require("path");
  readline = require("readline");
  yargs = require("yargs/yargs");
  const { hideBin } = require("yargs/helpers");
}

// --- Configuration Constants ---
const DEFAULT_INPUT_BUNDLE_FILENAME = "dogs.md";
const DEFAULT_OUTPUT_DIR = ".";
const DEFAULT_ENCODING = "utf-8";

// --- Bundle Structure Constants ---
const MARKER_REGEX = new RegExp(
  `^\\s*(?:🐈|🐕)\\s*-{3,}\\s*` +
    `(?:CATS|DOGS)_(START|END)_FILE\\s*:\\s*` +
    `(.+?)` +
    `(\\s+\\(Content:Base64\\))?` +
    `\\s*-{3,}\\s*$`,
  "i"
);
const PAWS_CMD_REGEX = /^\s*@@\s*PAWS_CMD\s+(.+?)\s*@@\s*$/;
const MARKDOWN_FENCE_REGEX = /^\s*```[\w-]*\s*$/;

// --- Delta Command Regexes ---
const REPLACE_LINES_REGEX = /REPLACE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)/i;
const INSERT_AFTER_LINE_REGEX = /INSERT_AFTER_LINE\(\s*(\d+)\s*\)/i;
const DELETE_LINES_REGEX = /DELETE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)/i;
const DELETE_FILE_REGEX = /DELETE_FILE\(\s*\)/i;

/**
 * @typedef {Object} ParsedFile
 * @property {string} path - The relative path of the file from the bundle.
 * @property {Buffer | null} contentBytes - Full content, or null if delta-only.
 * @property {Object[] | null} deltaCommands - Array of delta commands.
 * @property {boolean} isDelete - True if this is a DELETE_FILE operation.
 */

/**
 * Parses a PAWS bundle string into a structured representation of its files.
 */
class BundleParser {
  /**
   * @param {string[]} bundleLines - The bundle content split into an array of lines.
   * @param {Object} [options={}] - Parser options.
   * @param {boolean} [options.applyDeltaMode=false] - Whether to parse for delta commands.
   * @param {boolean} [options.quiet=false] - Suppresses console warnings.
   */
  constructor(bundleLines, options = {}) {
    this.lines = bundleLines;
    this.applyDeltaMode = options.applyDeltaMode || false;
    this.quiet = options.quiet || false;
    this.log = this.quiet ? () => {} : (...args) => console.error(...args);
    this.parsedFiles = [];
  }

  /**
   * Parses a PAWS command string into a structured delta command object.
   * @param {string} cmdStr - The command string (e.g., "DELETE_FILE()").
   * @returns {Object | null} A structured command object or null if invalid.
   */
  _parseDeltaCommand(cmdStr) {
    if (DELETE_FILE_REGEX.test(cmdStr)) return { type: "delete_file" };
    let match;
    if ((match = cmdStr.match(REPLACE_LINES_REGEX))) {
      return {
        type: "replace",
        start: parseInt(match[1]),
        end: parseInt(match[2]),
      };
    }
    if ((match = cmdStr.match(INSERT_AFTER_LINE_REGEX))) {
      return { type: "insert", lineNum: parseInt(match[1]) };
    }
    if ((match = cmdStr.match(DELETE_LINES_REGEX))) {
      return {
        type: "delete_lines",
        start: parseInt(match[1]),
        end: parseInt(match[2]),
      };
    }
    return null;
  }

  /**
   * Cleans a block of content lines by removing markdown fences and blank lines.
   * @param {string[]} lines - The raw lines of content from a file block.
   * @returns {string[]} The cleaned content lines.
   */
  _finalizeContentBlock(lines) {
    if (!lines.length) return [];
    let start = 0,
      end = lines.length;
    if (MARKDOWN_FENCE_REGEX.test(lines[start])) start++;
    if (end > start && MARKDOWN_FENCE_REGEX.test(lines[end - 1])) end--;
    while (start < end && !lines[start].trim()) start++;
    while (end > start && !lines[end - 1].trim()) end--;
    return lines.slice(start, end);
  }

  /**
   * Finalizes the parsing of a file block and adds it to the list of parsed files.
   * @param {string} path - The file path.
   * @param {boolean} isBinary - Whether the content is Base64 encoded.
   * @param {string[]} contentLines - The lines of content for the file.
   * @param {Object[]} deltaCommands - Any parsed delta commands.
   */
  _finalizeFile(path, isBinary, contentLines, deltaCommands) {
    const finalContentLines = this._finalizeContentBlock(contentLines);

    if (deltaCommands.some((cmd) => cmd.type === "delete_file")) {
      this.parsedFiles.push({
        path,
        contentBytes: null,
        deltaCommands: null,
        isDelete: true,
      });
      return;
    }

    if (this.applyDeltaMode && deltaCommands.length > 0) {
      if (
        finalContentLines.length > 0 &&
        deltaCommands.length > 0 &&
        deltaCommands[deltaCommands.length - 1].type !== "delete_lines"
      ) {
        deltaCommands[deltaCommands.length - 1].contentLines =
          finalContentLines;
      }
      this.parsedFiles.push({
        path,
        contentBytes: null,
        deltaCommands,
        isDelete: false,
      });
    } else {
      const rawContentStr = finalContentLines.join("\n");
      const contentBytes = isBinary
        ? Buffer.from(rawContentStr.replace(/\s/g, ""), "base64")
        : Buffer.from(rawContentStr, DEFAULT_ENCODING);
      this.parsedFiles.push({
        path,
        contentBytes,
        deltaCommands: null,
        isDelete: false,
      });
    }
  }

  /**
   * Executes the parsing of the entire bundle.
   * @returns {ParsedFile[]} The array of parsed file objects.
   */
  parse() {
    let inBlock = false;
    let currentPath = null;
    let isBinary = false;
    let contentLines = [];
    let deltaCommands = [];

    for (const line of this.lines) {
      const match = line.match(MARKER_REGEX);
      if (match) {
        const [, type, pathStr, hint] = match;
        if (type.toUpperCase() === "START") {
          if (inBlock) {
            this.log(
              `  Warning: New file '${pathStr}' started before '${currentPath}' ended. Finalizing previous file.`
            );
            this._finalizeFile(
              currentPath,
              isBinary,
              contentLines,
              deltaCommands
            );
          }
          inBlock = true;
          currentPath = pathStr.trim();
          isBinary = hint && hint.includes("Content:Base64");
          contentLines = [];
          deltaCommands = [];
        } else if (
          type.toUpperCase() === "END" &&
          inBlock &&
          pathStr.trim() === currentPath
        ) {
          this._finalizeFile(
            currentPath,
            isBinary,
            contentLines,
            deltaCommands
          );
          inBlock = false;
        }
      } else if (inBlock) {
        const cmdMatch = line.match(PAWS_CMD_REGEX);
        if (cmdMatch) {
          const deltaCmd = this._parseDeltaCommand(cmdMatch[1].trim());
          if (
            deltaCmd &&
            (deltaCmd.type === "delete_file" || this.applyDeltaMode)
          ) {
            const finalizedBlock = this._finalizeContentBlock(contentLines);
            if (
              finalizedBlock.length > 0 &&
              deltaCommands.length > 0 &&
              deltaCommands[deltaCommands.length - 1].type !== "delete_lines"
            ) {
              deltaCommands[deltaCommands.length - 1].contentLines =
                finalizedBlock;
            }
            contentLines = [];
            deltaCommands.push(deltaCmd);
          } else {
            contentLines.push(line);
          }
        } else {
          contentLines.push(line);
        }
      }
    }
    if (inBlock) {
      this.log(
        `  Warning: Bundle ended before file '${currentPath}' was closed. Finalizing.`
      );
      this._finalizeFile(currentPath, isBinary, contentLines, deltaCommands);
    }
    return this.parsedFiles;
  }
}

/**
 * Applies a series of delta commands to an array of original file lines.
 * @param {string[]} originalLines - The original lines of the file.
 * @param {Object[]} deltaCommands - The delta commands to apply.
 * @returns {string[]} The new lines of the file after applying deltas.
 */
function applyDeltas(originalLines, deltaCommands) {
  let newLines = [...originalLines];
  let offset = 0;
  for (const cmd of deltaCommands) {
    try {
      if (cmd.type === "replace") {
        const start = cmd.start - 1 + offset;
        const deleteCount = cmd.end - start;
        newLines.splice(start, deleteCount, ...(cmd.contentLines || []));
        offset += (cmd.contentLines || []).length - deleteCount;
      } else if (cmd.type === "insert") {
        const insertIdx = cmd.lineNum + offset;
        newLines.splice(insertIdx, 0, ...(cmd.contentLines || []));
        offset += (cmd.contentLines || []).length;
      } else if (cmd.type === "delete_lines") {
        const start = cmd.start - 1 + offset;
        const deleteCount = cmd.end - start;
        newLines.splice(start, deleteCount);
        offset -= deleteCount;
      }
    } catch (e) {
      console.error(
        `  Error applying delta command (${cmd.type}): ${e.message}. Skipping command.`
      );
    }
  }
  return newLines;
}

/**
 * Sanitizes a relative path to prevent directory traversal.
 * @param {string} relPath - The relative path from the bundle.
 * @returns {string} A safe, normalized path.
 */
function sanitizePath(relPath) {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.resolve("/", normalized);
  return resolved.substring(1);
}

/**
 * Extracts files from a PAWS bundle.
 * In Node.js, it can read from/write to the file system.
 * In the browser, it operates on strings and returns a virtual file system.
 * @param {Object} options - Configuration options for extraction.
 * @param {string} options.bundleContent - The bundle content as a string.
 * @param {string} [options.originalBundleContent] - The original bundle for delta mode.
 * @returns {Promise<ParsedFile[]>} A promise resolving to an array of ParsedFile objects.
 */
async function extractBundle(options = {}) {
  const { bundleContent, originalBundleContent, quiet = false } = options;
  const applyDeltaMode = !!originalBundleContent;

  const parser = new BundleParser(bundleContent.split(/\r?\n/), {
    applyDeltaMode,
    quiet,
  });
  let parsedFiles = parser.parse();

  if (applyDeltaMode) {
    const originalParser = new BundleParser(
      originalBundleContent.split(/\r?\n/),
      { quiet }
    );
    const originalFilesMap = new Map(
      originalParser
        .parse()
        .map((f) => [
          f.path,
          f.contentBytes.toString(DEFAULT_ENCODING).split(/\r?\n/),
        ])
    );

    for (const file of parsedFiles) {
      if (file.deltaCommands && originalFilesMap.has(file.path)) {
        const newLines = applyDeltas(
          originalFilesMap.get(file.path),
          file.deltaCommands
        );
        file.contentBytes = Buffer.from(newLines.join("\n"), DEFAULT_ENCODING);
      }
    }
  }
  return parsedFiles;
}

/**
 * Prompts the user for confirmation in an interactive terminal.
 * @param {string} question - The question to ask the user.
 * @param {string[]} [validChoices=['y', 'n']] - The list of valid single-character responses.
 * @returns {Promise<string>} The user's validated choice.
 */
async function confirmPrompt(question, validChoices = ["y", "n"]) {
  if (!process.stdin.isTTY) {
    return "n";
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const choice = answer.trim().toLowerCase();
      resolve(validChoices.includes(choice) ? choice : "n");
    });
  });
}

/**
 * Main function to run the Command-Line Interface.
 */
async function mainCli() {
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]")
    .example(
      "node dogs.js dogs.md ./output -y",
      "Extract dogs.md to ./output, auto-confirming"
    )
    .example(
      "node dogs.js changes.bundle . -d original.bundle",
      "Apply delta changes"
    )
    .positional("bundle_file", {
      describe: `Input bundle (default: ${DEFAULT_INPUT_BUNDLE_FILENAME})`,
      type: "string",
      default: DEFAULT_INPUT_BUNDLE_FILENAME,
    })
    .positional("output_dir", {
      describe: `Output directory (default: ${DEFAULT_OUTPUT_DIR})`,
      type: "string",
      default: DEFAULT_OUTPUT_DIR,
    })
    .option("d", {
      alias: "apply-delta",
      describe: "Path to original bundle for delta application.",
      type: "string",
    })
    .option("q", {
      alias: "quiet",
      describe: "Suppress all informational output. Implies -n.",
      type: "boolean",
      default: false,
    })
    .option("y", {
      alias: "yes",
      describe: "Auto-confirm all actions (overwrite/delete).",
      type: "boolean",
      default: false,
    })
    .option("n", {
      alias: "no",
      describe: "Auto-skip all conflicting actions.",
      type: "boolean",
      default: false,
    })
    .option("verify-docs", {
      describe: "Warn if a README.md is changed without its CATSCAN.md.",
      type: "boolean",
      default: false,
    })
    .help("h")
    .alias("h", "help").argv;

  const log = argv.q ? () => {} : (...args) => console.error(...args);

  log("--- Starting PAWS Extraction ---");
  const outputDir = path.resolve(process.cwd(), argv.output_dir);
  await fs.mkdir(outputDir, { recursive: true });

  const bundleContent = await fs.readFile(argv.bundle_file, DEFAULT_ENCODING);
  const originalBundleContent = argv.d
    ? await fs.readFile(argv.d, DEFAULT_ENCODING)
    : null;

  const filesToWrite = await extractBundle({
    bundleContent,
    originalBundleContent,
    quiet: argv.q,
  });

  if (filesToWrite.length === 0) {
    log("No files found in bundle. Nothing to do.");
    return;
  }

  let overwritePolicy = argv.y ? "yes" : argv.n || argv.q ? "no" : "prompt";

  for (const file of filesToWrite) {
    const safePath = sanitizePath(file.path);
    const outputPath = path.join(outputDir, safePath);

    if (!path.resolve(outputPath).startsWith(path.resolve(outputDir))) {
      log(
        `  Security Alert: Path '${file.path}' attempts traversal. Skipping.`
      );
      continue;
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const fileExists = await fs
      .access(outputPath)
      .then(() => true)
      .catch(() => false);

    if (file.isDelete) {
      if (fileExists) {
        let shouldDelete = false;
        if (overwritePolicy === "yes") shouldDelete = true;
        else if (overwritePolicy === "prompt") {
          const answer = await confirmPrompt(
            `Permanently delete '${safePath}'? [y/N/a(ll)/q(uit)]: `,
            ["y", "n", "a", "q"]
          );
          if (answer === "y") shouldDelete = true;
          if (answer === "a") {
            shouldDelete = true;
            overwritePolicy = "yes";
          }
          if (answer === "q") {
            log("Operation cancelled.");
            break;
          }
        }
        if (shouldDelete) {
          await fs.unlink(outputPath);
          log(`  Deleted: ${safePath}`);
        } else {
          log(`  Skipped delete: ${safePath}`);
        }
      }
    } else if (file.contentBytes) {
      let shouldWrite = true;
      if (fileExists) {
        if (overwritePolicy === "no") shouldWrite = false;
        else if (overwritePolicy === "prompt") {
          const answer = await confirmPrompt(
            `File '${safePath}' exists. Overwrite? [y/N/a(ll)/s(kip-all)/q(uit)]: `,
            ["y", "n", "a", "s", "q"]
          );
          if (answer === "n") shouldWrite = false;
          if (answer === "a") overwritePolicy = "yes";
          if (answer === "s") {
            shouldWrite = false;
            overwritePolicy = "no";
          }
          if (answer === "q") {
            log("Operation cancelled.");
            break;
          }
        }
      }
      if (shouldWrite) {
        await fs.writeFile(outputPath, file.contentBytes);
        log(`  Wrote: ${safePath}`);
      } else {
        log(`  Skipped: ${safePath}`);
      }
    }
  }

  if (argv.verifyDocs) {
    const modifiedFiles = new Set(filesToWrite.map((f) => f.path));
    const readmeChanges = new Set(
      Array.from(modifiedFiles).filter((f) =>
        f.toLowerCase().endsWith("readme.md")
      )
    );

    if (readmeChanges.size > 0) {
      log("\n--- Verifying Documentation Sync ---");
      let warnings = 0;
      for (const readme of readmeChanges) {
        const catscanPath = path.join(path.dirname(readme), "CATSCAN.md");
        if (!modifiedFiles.has(catscanPath)) {
          log(
            `  Warning: '${readme}' was modified, but '${catscanPath}' was not. Docs may be out of sync.`
          );
          warnings++;
        }
      }
      if (warnings === 0) {
        log(
          "  OK: All modified README.md files had corresponding CATSCAN.md changes."
        );
      }
    }
  }
}

// --- Exports and Execution ---
module.exports = { extractBundle };

if (IS_NODE && require.main === module) {
  mainCli().catch((err) => {
    console.error(`\nAn unexpected error occurred: ${err.message}`);
    process.exit(1);
  });
}
