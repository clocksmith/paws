#!/usr/bin/env node
// cats.js - Bundles project files into a single text artifact.
const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");
const readline = require("readline"); // For CLI prompt

const FILE_START_MARKER_TEMPLATE = "--- CATS_START_FILE: {} ---";
const FILE_END_MARKER = "--- CATS_END_FILE ---";
const DEFAULT_ENCODING = "utf-8";
const DEFAULT_OUTPUT_FILENAME = "cats_out.bundle"; // For CLI default
const BUNDLE_HEADER_PREFIX = "# Cats Bundle";
const BUNDLE_FORMAT_PREFIX = "# Format: ";

/**
 * @typedef {Object} FileObjectNode
 * @property {string} path - Absolute real path of the source file.
 * @property {string} relativePath - Relative path used in the bundle marker.
 * @property {Buffer} contentBytes - File content as a Buffer.
 * @property {boolean} isUtf8 - Whether the content is likely UTF-8.
 */

/**
 * Checks if file content is likely UTF-8 by attempting to decode.
 * @param {Buffer} fileContentBytes
 * @returns {boolean}
 */
function isLikelyUtf8Node(fileContentBytes) {
  if (!fileContentBytes || fileContentBytes.length === 0) {
    return true; // Empty files are UTF-8 compatible
  }
  try {
    fileContentBytes.toString(DEFAULT_ENCODING);
    return true;
  } catch (e) {
    // Node.js Buffer.toString doesn't throw for invalid UTF-8 in the same way Python's decode does.
    // A more robust check might involve looking for replacement characters or specific byte patterns,
    // but for this utility, we'll assume if it doesn't error spectacularly, it might be.
    // For stricter check, one might use a library or more complex validation.
    // A simple check: if it contains null bytes, it's likely not plain UTF-8 text.
    if (fileContentBytes.includes(0x00)) return false;
    return true; // Simplified check for Node.js
  }
}

/**
 * Determines the final list of absolute, canonical file paths to include.
 * Handles exclusions and output file skipping.
 * @param {string[]} includePathsRaw - Raw input paths.
 * @param {string[]} excludePathsRaw - Raw exclusion paths.
 * @param {string|null} [outputFileAbsPath=null] - Absolute path of the output file.
 * @param {string[]} [originalUserPaths=[]] - Paths originally specified by user (for warning logic).
 * @param {boolean} [verbose=false] - Verbose logging.
 * @returns {string[]} Sorted list of absolute file real paths.
 */
function getFinalPathsToProcessNode(
  includePathsRaw,
  excludePathsRaw,
  outputFileAbsPath = null,
  originalUserPaths = [],
  verbose = false
) {
  const candidateFileRealpaths = new Set();
  const absExcludedRealpathsSet = new Set(
    excludePathsRaw
      .map((p) => path.resolve(p))
      .map((p) => fs.realpathSync(p, { throwIfNoEntry: false }) || p)
  );
  const absExcludedDirsForPruningSet = new Set(
    Array.from(absExcludedRealpathsSet).filter((pReal) => {
      try {
        return fs.existsSync(pReal) && fs.statSync(pReal).isDirectory();
      } catch {
        return false;
      }
    })
  );
  const processedTopLevelInputRealpaths = new Set();

  for (const inclPathRaw of includePathsRaw) {
    const absInclPath = path.resolve(inclPathRaw);
    let currentInputRealPath;
    try {
      currentInputRealPath = fs.realpathSync(absInclPath);
    } catch (e) {
      // If realpath fails (e.g. broken symlink, or path doesn't exist yet but might be created by another process)
      // We still use the resolved absolute path for existence checks.
      currentInputRealPath = absInclPath;
    }

    if (
      processedTopLevelInputRealpaths.has(currentInputRealPath) &&
      originalUserPaths.includes(inclPathRaw)
    ) {
      if (verbose)
        console.log(
          `  Debug: Skipping already processed top-level input: ${currentInputRealPath}`
        );
      continue;
    }
    processedTopLevelInputRealpaths.add(currentInputRealPath);

    if (outputFileAbsPath && currentInputRealPath === outputFileAbsPath) {
      if (verbose)
        console.log(
          `  Debug: Skipping output file itself: ${currentInputRealPath}`
        );
      continue;
    }
    if (absExcludedRealpathsSet.has(currentInputRealPath)) {
      if (verbose)
        console.log(`  Debug: Skipping excluded path: ${currentInputRealPath}`);
      continue;
    }

    const isInsideExcludedDir = Array.from(absExcludedDirsForPruningSet).some(
      (excludedDirRp) =>
        currentInputRealPath.startsWith(excludedDirRp + path.sep)
    );
    if (isInsideExcludedDir) {
      if (verbose)
        console.log(
          `  Debug: Skipping path inside excluded dir: ${currentInputRealPath}`
        );
      continue;
    }

    if (!fs.existsSync(currentInputRealPath)) {
      if (originalUserPaths.includes(inclPathRaw)) {
        // Only warn for paths user explicitly provided
        console.warn(
          `  Warning: Input path '${inclPathRaw}' not found. Skipping.`
        );
      } else if (verbose && inclPathRaw === "sys_human.txt") {
        console.log(
          `  Debug: Conventionally included '${inclPathRaw}' not found. Skipping.`
        );
      }
      continue;
    }

    const stat = fs.statSync(currentInputRealPath);
    if (stat.isFile()) {
      candidateFileRealpaths.add(currentInputRealPath);
    } else if (stat.isDirectory()) {
      const walk = (dir) => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          const itemRealPath =
            fs.realpathSync(itemPath, { throwIfNoEntry: false }) || itemPath;

          if (outputFileAbsPath && itemRealPath === outputFileAbsPath) continue;
          if (absExcludedRealpathsSet.has(itemRealPath)) continue;
          const isInsideExclDirWalk = Array.from(
            absExcludedDirsForPruningSet
          ).some((excludedDirRp) =>
            itemRealPath.startsWith(excludedDirRp + path.sep)
          );
          if (isInsideExclDirWalk) continue;

          if (item.isFile()) {
            candidateFileRealpaths.add(itemRealPath);
          } else if (item.isDirectory()) {
            if (!absExcludedDirsForPruningSet.has(itemRealPath)) {
              // Check if dir itself is excluded for pruning
              walk(itemPath);
            }
          }
        }
      };
      walk(currentInputRealPath);
    }
  }
  return Array.from(candidateFileRealpaths).sort();
}

/**
 * Generates a relative path for the bundle marker, using forward slashes.
 * @param {string} fileRealPath - Absolute real path of the file.
 * @param {string} commonAncestorPath - Absolute real path of the common ancestor.
 * @returns {string} Relative path with forward slashes.
 */
function generateBundleRelativePathNode(fileRealPath, commonAncestorPath) {
  let relPath;
  if (
    commonAncestorPath === path.dirname(fileRealPath) &&
    fs.statSync(fileRealPath).isFile()
  ) {
    // If common ancestor is the direct parent of the file (e.g. single file input)
    relPath = path.basename(fileRealPath);
  } else if (fileRealPath.startsWith(commonAncestorPath + path.sep)) {
    relPath = path.relative(commonAncestorPath, fileRealPath);
  } else if (
    commonAncestorPath === fileRealPath &&
    fs.statSync(fileRealPath).isFile()
  ) {
    // Case where the common ancestor IS the file itself (e.g. cats.js myFile.txt)
    relPath = path.basename(fileRealPath);
  } else {
    // Fallback: if not directly under, usually means commonAncestorPath is a peer or unrelated.
    // In this case, using basename is safer to avoid '..' if commonAncestorPath is not truly an ancestor.
    // However, path.relative should handle this; if it produces '..' it means setup was complex.
    // Forcing basename might be too aggressive. Let path.relative do its job.
    // If common_ancestor is not truly an ancestor, path.relative will give '..'
    // We want paths relative to the bundle root.
    // If common_ancestor is CWD, and file is CWD/src/file.txt -> src/file.txt
    // If common_ancestor is CWD/src, and file is CWD/src/file.txt -> file.txt
    relPath = path.relative(commonAncestorPath, fileRealPath);
    if (relPath === "" || relPath === ".") {
      // relpath can return empty if paths are identical
      relPath = path.basename(fileRealPath);
    }
  }
  return relPath.replace(/\\/g, "/"); // Ensure forward slashes
}

/**
 * Finds the longest common ancestor directory for a list of absolute paths.
 * @param {string[]} absFilePaths - List of absolute, real file paths.
 * @returns {string} The common ancestor path.
 */
function findCommonAncestorNode(absFilePaths) {
  if (!absFilePaths || absFilePaths.length === 0) {
    return process.cwd();
  }
  if (absFilePaths.length === 1) {
    const pStat = fs.statSync(absFilePaths[0]);
    return pStat.isDirectory()
      ? absFilePaths[0]
      : path.dirname(absFilePaths[0]);
  }

  const dirPaths = absFilePaths.map((p) => {
    try {
      return fs.statSync(p).isDirectory() ? p : path.dirname(p);
    } catch {
      // Path might not exist if it was a broken symlink that got filtered out later
      return path.dirname(p); // Best guess
    }
  });

  let commonPath = dirPaths[0];
  for (let i = 1; i < dirPaths.length; i++) {
    let currentPath = dirPaths[i];
    while (
      !currentPath.startsWith(commonPath + path.sep) &&
      commonPath !== path.dirname(commonPath)
    ) {
      if (currentPath === commonPath) break; // They are the same
      commonPath = path.dirname(commonPath);
      if (commonPath === path.sep || commonPath === ".") {
        // Reached root or relative dot
        const driveMatchWin = commonPath.match(/^[a-zA-Z]:\\$/); // C:\
        const driveMatchUnix = commonPath === "/";
        if (driveMatchWin || driveMatchUnix) break; // Stop at drive root
      }
    }
    if (!currentPath.startsWith(commonPath)) {
      // If after loop, still no commonality
      // This can happen if paths are on different drives (Windows) or completely disparate
      // Fallback to current working directory or an empty string to signify no deep common root
      return process.cwd();
    }
  }
  // Final check: if commonPath is not a directory (e.g. if all inputs were files in CWD)
  // then the actual common ancestor for relative paths is its parent.
  // However, if commonPath is the result of common prefix of dirs, it IS the common ancestor dir.
  // This logic is tricky. `path.commonPrefix` is not in Node.js core.
  // The Python `os.path.commonpath` is more robust.
  // For now, this simplified approach:
  if (
    absFilePaths.every((p) => fs.statSync(p).isFile()) &&
    absFilePaths.length > 1
  ) {
    let firstDir = path.dirname(absFilePaths[0]);
    if (absFilePaths.every((p) => path.dirname(p) === firstDir)) {
      return firstDir;
    }
  }
  return commonPath;
}

/**
 * Prepares file objects from paths.
 * @param {string[]} absFilePaths - Absolute real file paths.
 * @param {string} commonAncestorForRelpath - Path to make relative paths from.
 * @returns {{fileObjects: FileObjectNode[], anyNonUtf8Found: boolean}}
 */
function prepareFileObjectsFromPathsNode(
  absFilePaths,
  commonAncestorForRelpath
) {
  const fileObjects = [];
  let anyNonUtf8Found = false;

  for (const fileAbsPath of absFilePaths) {
    try {
      const contentBytes = fs.readFileSync(fileAbsPath); // Returns Buffer
      const isUtf8 = isLikelyUtf8Node(contentBytes);
      if (!isUtf8) {
        anyNonUtf8Found = true;
      }
      const relativePath = generateBundleRelativePathNode(
        fileAbsPath,
        commonAncestorForRelpath
      );
      fileObjects.push({
        path: fileAbsPath,
        relativePath: relativePath,
        contentBytes: contentBytes,
        isUtf8: isUtf8,
      });
    } catch (e) {
      console.warn(
        `  Warning: Error reading file '${fileAbsPath}': ${e.message}. Skipping.`
      );
    }
  }
  return { fileObjects, anyNonUtf8Found };
}

/**
 * Creates the bundle string from prepared file objects.
 * @param {FileObjectNode[]} fileObjects
 * @param {boolean} forceBase64Bundle
 * @param {boolean} anyNonUtf8AlreadyDetected
 * @returns {{bundleString: string, formatDescription: string}}
 */
function createBundleStringFromObjectsNode(
  fileObjects,
  forceBase64Bundle,
  anyNonUtf8AlreadyDetected
) {
  const bundleParts = [];
  const useBase64ForAll = forceBase64Bundle || anyNonUtf8AlreadyDetected;

  const formatDescription = forceBase64Bundle
    ? "Base64 (Forced)"
    : anyNonUtf8AlreadyDetected
    ? "Base64 (Auto-Detected due to non-UTF-8 content)"
    : `Raw ${DEFAULT_ENCODING} (All files appear UTF-8 compatible)`;

  bundleParts.push(BUNDLE_HEADER_PREFIX);
  bundleParts.push(`${BUNDLE_FORMAT_PREFIX}${formatDescription}`);

  for (const fileObj of fileObjects) {
    bundleParts.push("");
    bundleParts.push(
      FILE_START_MARKER_TEMPLATE.replace("{}", fileObj.relativePath)
    );

    let contentToWrite;
    if (useBase64ForAll) {
      contentToWrite = fileObj.contentBytes.toString("base64");
    } else {
      contentToWrite = fileObj.contentBytes.toString(DEFAULT_ENCODING);
    }
    bundleParts.push(contentToWrite);
    bundleParts.push(FILE_END_MARKER);
  }
  return { bundleString: bundleParts.join("\n") + "\n", formatDescription };
}

/**
 * High-level function to create a bundle string from paths (Node.js).
 * @param {Object} params
 * @param {string[]} params.includePaths - Paths to include.
 * @param {string[]} params.excludePaths - Paths to exclude.
 * @param {boolean} params.forceBase64 - Force Base64 encoding.
 * @param {string} [params.outputFileAbsPath] - Absolute path of output file for self-exclusion.
 * @param {string} [params.baseDirForRelpath] - Optional base directory for relative paths.
 * @param {string[]} [params.originalUserPaths] - For warning logic.
 * @param {boolean} [params.verbose] - Verbose logging.
 * @returns {Promise<{bundleString: string, formatDescription: string, filesAdded: number}>}
 */
async function bundleFromPathsNode({
  includePaths,
  excludePaths,
  forceBase64,
  outputFileAbsPath,
  baseDirForRelpath,
  originalUserPaths = [],
  verbose = false,
}) {
  const absFilePathsToBundle = getFinalPathsToProcessNode(
    includePaths,
    excludePaths,
    outputFileAbsPath,
    originalUserPaths, // Pass this for warning logic
    verbose
  );

  if (absFilePathsToBundle.length === 0) {
    return {
      bundleString: "",
      formatDescription: "No files selected",
      filesAdded: 0,
    };
  }

  let commonAncestor;
  if (baseDirForRelpath) {
    commonAncestor = path.resolve(baseDirForRelpath);
    try {
      commonAncestor = fs.realpathSync(commonAncestor);
    } catch {
      /* Use as is if not exist */
    }
  } else {
    commonAncestor = findCommonAncestorNode(absFilePathsToBundle);
  }

  const { fileObjects, anyNonUtf8Found } = prepareFileObjectsFromPathsNode(
    absFilePathsToBundle,
    commonAncestor
  );

  if (fileObjects.length === 0) {
    return {
      bundleString: "",
      formatDescription: "No files successfully processed",
      filesAdded: 0,
    };
  }

  const { bundleString, formatDescription } = createBundleStringFromObjectsNode(
    fileObjects,
    forceBase64,
    anyNonUtf8Found
  );
  return { bundleString, formatDescription, filesAdded: fileObjects.length };
}

function parseCliArgsCats(argv) {
  const args = {
    paths: [],
    output: DEFAULT_OUTPUT_FILENAME,
    exclude: [],
    forceB64: false,
    yes: false, // For Node, this might mean "non-interactive"
    help: false,
    verbose: false,
  };
  const cliArgs = argv.slice(2);
  let i = 0;
  while (i < cliArgs.length) {
    const arg = cliArgs[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      break;
    } else if (arg === "-o" || arg === "--output") {
      if (i + 1 < cliArgs.length && !cliArgs[i + 1].startsWith("-")) {
        args.output = cliArgs[++i];
      } else {
        throw new Error(`Argument ${arg} requires a value.`);
      }
    } else if (arg === "-x" || arg === "--exclude") {
      if (i + 1 < cliArgs.length && !cliArgs[i + 1].startsWith("-")) {
        args.exclude.push(cliArgs[++i]);
      } else {
        throw new Error(`Argument ${arg} requires a value.`);
      }
    } else if (arg === "--force-b64") {
      args.forceB64 = true;
    } else if (arg === "-y" || arg === "--yes") {
      args.yes = true;
    } else if (arg === "-v" || arg === "--verbose") {
      args.verbose = true;
    } else if (!arg.startsWith("-")) {
      args.paths.push(arg);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
    i++;
  }
  if (args.paths.length === 0 && !args.help) {
    throw new Error("You must specify at least one PATH to include.");
  }
  return args;
}

function printCliHelpCats() {
  console.log(`cats.js : Bundles project files into a single text artifact for LLMs.

Syntax: node cats.js [PATH_TO_INCLUDE_1] [PATH_TO_INCLUDE_2...] [options]

Arguments:
  PATH                    Files or directories to include in the bundle.

Options:
  -o, --output BUNDLE_FILE  Output bundle file name (default: ${DEFAULT_OUTPUT_FILENAME}).
  -x, --exclude EXCLUDE_PATH Path to exclude (file or directory). Can be used multiple times.
  --force-b64             Force Base64 encoding for all files, even if all are UTF-8.
  -y, --yes               Automatically confirm and proceed (if a prompt would occur, e.g. overwrite).
  -v, --verbose           Enable verbose logging.
  -h, --help              Show this help message and exit.

Example: node cats.js ./src ./docs -x ./.git -x ./node_modules -o my_project.bundle`);
}

async function mainCliCatsNode() {
  let args;
  try {
    args = parseCliArgsCats(process.argv);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    printCliHelpCats();
    process.exit(1);
  }

  if (args.help) {
    printCliHelpCats();
    process.exit(0);
  }

  const absOutputFilePath = path.resolve(args.output);
  let pathsToProcessExplicit = [...args.paths];
  const originalUserPathsForWarning = [...args.paths]; // Keep a copy

  const sysHumanPath = "sys_human.txt";
  const sysHumanAbsPath = path.resolve(sysHumanPath);

  if (fs.existsSync(sysHumanAbsPath) && fs.statSync(sysHumanAbsPath).isFile()) {
    const sysHumanRealPath = fs.realpathSync(sysHumanAbsPath);
    const alreadyListed = pathsToProcessExplicit.some((pRaw) => {
      try {
        return fs.realpathSync(path.resolve(pRaw)) === sysHumanRealPath;
      } catch {
        return path.resolve(pRaw) === sysHumanAbsPath;
      } // Fallback if pRaw doesn't exist yet
    });
    if (!alreadyListed) {
      pathsToProcessExplicit.unshift(sysHumanPath); // Prepend
      if (args.verbose)
        console.log(
          `  Info: Conventionally including '${sysHumanPath}' from CWD.`
        );
    } else if (args.verbose) {
      console.log(
        `  Debug: '${sysHumanPath}' already listed by user or resolves to an existing path.`
      );
    }
  } else if (args.verbose) {
    console.log(
      `  Debug: Conventional file '${sysHumanPath}' not found in CWD, not added.`
    );
  }

  console.log("Phase 1: Collecting and filtering files...");
  const { bundleString, formatDescription, filesAdded } =
    await bundleFromPathsNode({
      includePaths: pathsToProcessExplicit,
      excludePaths: args.exclude,
      forceBase64: args.forceB64,
      outputFileAbsPath: absOutputFilePath, // For self-exclusion
      originalUserPaths: originalUserPathsForWarning,
      verbose: args.verbose,
    });

  if (filesAdded === 0) {
    console.log(
      `No files selected for bundling. ${formatDescription}. Exiting.`
    );
    return;
  }

  console.log(`  Files to be bundled: ${filesAdded}`);
  if (args.forceB64) {
    console.log("  Encoding: All files will be Base64 encoded (user forced).");
  } else {
    console.log(
      `  Bundle format determined: ${formatDescription.split("(")[0].trim()}`
    );
  }

  let proceed = args.yes;
  if (!proceed && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise((resolve) =>
      rl.question(
        `Output will be written to: ${absOutputFilePath}\nProceed with bundling? [Y/n]: `,
        resolve
      )
    );
    rl.close();
    if (answer.trim().toLowerCase() === "y" || answer.trim() === "") {
      proceed = true;
    } else {
      console.log("Bundling cancelled by user.");
      return;
    }
  } else if (!process.stdin.isTTY && !args.yes) {
    if (args.verbose)
      console.log(
        "  Info: Non-interactive mode, proceeding without confirmation prompt."
      );
    proceed = true; // Proceed in non-interactive if -y not given
  }

  if (!proceed) return;

  console.log(`\nPhase 2: Writing bundle to '${absOutputFilePath}'...`);
  console.log(`  Final Bundle Format: ${formatDescription}`);

  try {
    const outputParentDir = path.dirname(absOutputFilePath);
    if (outputParentDir && !fs.existsSync(outputParentDir)) {
      fs.mkdirSync(outputParentDir, { recursive: true });
    }
    fs.writeFileSync(absOutputFilePath, bundleString, {
      encoding: DEFAULT_ENCODING,
    });
    console.log(`\nBundle created successfully: '${args.output}'`);
    console.log(`  Files added: ${filesAdded}`);
  } catch (e) {
    console.error(`\nFatal error writing bundle: ${e.message}`);
    process.exit(1);
  }
}

// Export for library use
module.exports = {
  bundleFromPathsNode,
  // Potentially export other helper functions if useful as a library
  // For browser, one would typically create a separate entry point or use a bundler
};

if (require.main === module) {
  mainCliCatsNode().catch((error) => {
    console.error("CLI Error:", error.message);
    process.exit(1);
  });
}
