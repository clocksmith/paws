#!/usr/bin/env node
// cats.js - Bundles project files into a single text artifact for LLMs.

const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");
const readline = require("readline");

// Filename for the system prompt that can be prepended.
const SYS_PROMPT_FILENAME = "sys_ant.txt";

// Separator appended after the prepended system prompt.
const SYS_PROMPT_POST_SEPARATOR =
  "\n--- END OF SYSTEM PROMPT ---\nThe following content is the Cats Bundle.\n";

// Marker indicating the end of a file block within the bundle.
const FILE_END_MARKER = "🐈 --- CATS_END_FILE ---";

// Default character encoding for text files.
const DEFAULT_ENCODING = "utf-8"; // Node.js 'utf8'

// Default name for the output bundle file.
const DEFAULT_OUTPUT_FILENAME = "cats_out.bundle";

// Prefix for the main bundle header.
const BUNDLE_HEADER_PREFIX = "# Cats Bundle";

// Prefix for the bundle format description within the header.
const BUNDLE_FORMAT_PREFIX = "# Format: ";

// Prefix for the delta reference hint within the header.
const DELTA_REFERENCE_HINT_PREFIX = "# Delta Reference: ";

// Text to indicate Base64 encoded content in file markers.
const BASE64_HINT_TEXT = "(Content:Base64)";

// Default directories/files to exclude from bundling.
// These are commonly version control, package managers, or cache directories.
const DEFAULT_EXCLUDES = [".git", "node_modules", "gem", "__pycache__"];

/**
 * @typedef {Object} FileObjectNode
 * @property {string} absPath - Absolute real path of the source file.
 * @property {string} relativePath - Relative path used in the bundle marker.
 * @property {Buffer} contentBytes - File content as a Buffer.
 * @property {string|null} encoding - Detected: 'utf8', 'utf16le', 'utf16be', or null for binary.
 * @property {boolean} isBinary - True if no text encoding was detected.
 */

/**
 * Attempts to find the system prompt file (sys_ant.txt) in the script's
 * directory or its parent directory.
 *
 * @returns {string|null} The resolved absolute path to the system prompt file if found, null otherwise.
 */
function findSysPromptPathForPrepending() {
  // Get the directory where the script itself is located.
  const scriptDir = __dirname;

  // Locations to check for the system prompt file.
  const locationsToCheck = [scriptDir, path.join(scriptDir, "..")];

  for (const loc of locationsToCheck) {
    const pathToCheck = path.join(loc, SYS_PROMPT_FILENAME);
    // Check if the file exists and is a file.
    try {
      if (fs.existsSync(pathToCheck) && fs.statSync(pathToCheck).isFile()) {
        return path.resolve(pathToCheck);
      }
    } catch (e) {
      // Ignore errors like permission issues or broken symlinks during stat.
    }
  }
  return null;
}

/**
 * Detects the text encoding of a given Buffer.
 * Prioritizes UTF-8, then UTF-16LE, then UTF-16BE.
 *
 * @param {Buffer} fileContentBytes - The content of the file as a Buffer.
 * @returns {string|null} The detected encoding ('utf8', 'utf16le', 'utf16be')
 *                        or null if it's likely a binary file or encoding cannot be determined.
 */
function detectTextEncodingNode(fileContentBytes) {
  // If content is empty, default to UTF-8 as a safe assumption for text.
  if (!fileContentBytes || fileContentBytes.length === 0) {
    return DEFAULT_ENCODING;
  }

  // Check for common BOMs first.
  if (
    fileContentBytes.length >= 2 &&
    fileContentBytes[0] === 0xff &&
    fileContentBytes[1] === 0xfe
  ) {
    // UTF-16LE BOM
    try {
      fileContentBytes.toString("utf16le");
      return "utf16le";
    } catch (e) {
      /* fall through */
    }
  }
  if (
    fileContentBytes.length >= 2 &&
    fileContentBytes[0] === 0xfe &&
    fileContentBytes[1] === 0xff
  ) {
    // UTF-16BE BOM
    try {
      fileContentBytes.toString("utf16be");
      return "utf16be";
    } catch (e) {
      /* fall through */
    }
  }

  // Try decoding as default UTF-8.
  try {
    // Simple heuristic for non-UTF8: presence of many null bytes usually indicates binary or UTF-16.
    // This is not foolproof but helps avoid misclassifying binary as garbled UTF-8.
    const nullByteCount = fileContentBytes.reduce(
      (count, byte) => count + (byte === 0x00 ? 1 : 0),
      0
    );
    if (nullByteCount > fileContentBytes.length / 100) {
      // More than 1% null bytes
      throw new Error("Possible binary content due to high null byte count");
    }
    fileContentBytes.toString(DEFAULT_ENCODING);
    return DEFAULT_ENCODING;
  } catch (e) {
    // If UTF-8 fails (or heuristic suggests binary), try UTF-16LE as a fallback (without BOM).
    try {
      fileContentBytes.toString("utf16le");
      return "utf16le";
    } catch (e2) {
      // If all common text encodings fail, it's likely binary.
      return null;
    }
  }
}

/**
 * Determines the final list of absolute, canonical file paths to include.
 * Handles inclusions, exclusions (user + default), and output file skipping.
 *
 * @param {string[]} includePathsRaw - Raw input paths from the user.
 * @param {string[]} excludePathsRaw - User-specified exclusion paths.
 * @param {boolean} useDefaultExcludes - Whether to apply default exclusion rules.
 * @param {string|null} [outputFileAbsPath=null] - Absolute path of the output bundle file,
 *                                                 to ensure it's not bundled.
 * @param {string|null} [sysAntInCwdAbsPathToIgnore=null] - Absolute path of sys_ant.txt in CWD
 *                                                          if it's being bundled as the first file,
 *                                                          to prevent duplicate processing.
 * @returns {string[]} Sorted list of absolute file real paths to include.
 */
function getFinalPathsToProcessNode(
  includePathsRaw,
  excludePathsRaw,
  useDefaultExcludes,
  outputFileAbsPath = null,
  sysAntInCwdAbsPathToIgnore = null
) {
  const candidateFileRealpaths = new Set();
  const cwd = process.cwd();

  const absExcludesResolved = new Set();
  // Resolve user-specified exclude paths.
  for (const pStr of excludePathsRaw) {
    try {
      absExcludesResolved.add(fs.realpathSync(path.resolve(cwd, pStr)));
    } catch (e) {
      // Ignore excludes that don't exist.
    }
  }

  // Add default excludes if enabled.
  if (useDefaultExcludes) {
    for (const defExcl of DEFAULT_EXCLUDES) {
      const potentialPath = path.resolve(cwd, defExcl);
      // Even if the path doesn't exist, we add its resolved path to the set
      // to handle cases where it might be created later or symlinked.
      // Using a try-catch for realpathSync as it throws if path doesn't exist.
      try {
        absExcludesResolved.add(fs.realpathSync(potentialPath));
      } catch (e) {
        absExcludesResolved.add(potentialPath); // Add as resolved absolute path
      }
    }
  }

  // Ensure the output bundle file itself is excluded.
  if (outputFileAbsPath) {
    try {
      absExcludesResolved.add(fs.realpathSync(outputFileAbsPath));
    } catch (e) {
      absExcludesResolved.add(outputFileAbsPath);
    }
  }

  // Ensure the sys_ant.txt from CWD is excluded if already handled as a special case.
  if (sysAntInCwdAbsPathToIgnore) {
    try {
      absExcludesResolved.add(fs.realpathSync(sysAntInCwdAbsPathToIgnore));
    } catch (e) {
      absExcludesResolved.add(sysAntInCwdAbsPathToIgnore);
    }
  }

  const processedTopLevelInputRealpaths = new Set();

  for (const inclPathRaw of includePathsRaw) {
    const absInclPath = path.resolve(cwd, inclPathRaw);
    let currentInputRealPath;
    try {
      currentInputRealPath = fs.realpathSync(absInclPath);
    } catch (e) {
      console.warn(
        `  Warning: Input path '${inclPathRaw}' not found or inaccessible. Skipping.`
      );
      continue;
    }

    if (processedTopLevelInputRealpaths.has(currentInputRealPath)) {
      continue;
    }
    processedTopLevelInputRealpaths.add(currentInputRealPath);

    let isExcluded = false;
    // Check if the current item (file or directory) is directly excluded
    // or is a child of an excluded directory.
    for (const exRealpath of absExcludesResolved) {
      try {
        const stat = fs.statSync(exRealpath);
        if (
          currentInputRealPath === exRealpath ||
          (stat.isDirectory() &&
            currentInputRealPath.startsWith(exRealpath + path.sep))
        ) {
          isExcluded = true;
          break;
        }
      } catch (e) {
        // If excluded path itself doesn't exist, it cannot exclude anything.
      }
    }
    if (isExcluded) {
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
          let itemRealPath;
          try {
            itemRealPath = fs.realpathSync(itemPath);
          } catch (e) {
            // Skip inaccessible items within a directory walk.
            continue;
          }

          let itemIsExcluded = false;
          for (const exRealpath of absExcludesResolved) {
            try {
              const exStat = fs.statSync(exRealpath);
              if (
                itemRealPath === exRealpath ||
                (exStat.isDirectory() &&
                  itemRealPath.startsWith(exRealpath + path.sep))
              ) {
                itemIsExcluded = true;
                break;
              }
            } catch (e) {
              // If excluded path itself doesn't exist, it cannot exclude anything.
            }
          }
          if (itemIsExcluded) {
            continue;
          }

          if (item.isFile()) {
            candidateFileRealpaths.add(itemRealPath);
          } else if (item.isDirectory()) {
            walk(itemPath);
          }
        }
      };
      walk(currentInputRealPath);
    }
  }
  // Return a sorted list for consistent bundle order.
  return Array.from(candidateFileRealpaths).sort();
}

/**
 * Finds the longest common ancestor directory for a list of absolute paths.
 * Used to calculate relative paths within the bundle.
 *
 * @param {string[]} absFilePaths - List of absolute, real file paths.
 * @returns {string} The common ancestor path. Defaults to CWD if no paths or errors.
 */
function findCommonAncestorNode(absFilePaths) {
  if (!absFilePaths || absFilePaths.length === 0) {
    return process.cwd();
  }
  if (absFilePaths.length === 1) {
    try {
      const pStat = fs.statSync(absFilePaths[0]);
      return pStat.isDirectory()
        ? absFilePaths[0]
        : path.dirname(absFilePaths[0]);
    } catch (e) {
      return path.dirname(absFilePaths[0]); // Fallback if stat fails
    }
  }

  // Convert all paths to a consistent format (e.g., forward slashes) for comparison
  // and ensure they are directory paths.
  const normalizedDirPaths = absFilePaths.map((p) => {
    try {
      const pStat = fs.statSync(p);
      return (pStat.isDirectory() ? p : path.dirname(p)).replace(/\\/g, "/");
    } catch (e) {
      return path.dirname(p).replace(/\\/g, "/"); // Fallback if stat fails
    }
  });

  let commonPathParts = normalizedDirPaths[0].split("/");
  for (let i = 1; i < normalizedDirPaths.length; i++) {
    const currentPathParts = normalizedDirPaths[i].split("/");
    let k = 0;
    while (
      k < commonPathParts.length &&
      k < currentPathParts.length &&
      commonPathParts[k] === currentPathParts[k]
    ) {
      k++;
    }
    commonPathParts = commonPathParts.slice(0, k);
  }

  let commonAncestor = commonPathParts.join("/");
  // Handle root paths (e.g., '/' or 'C:/')
  if (commonAncestor === "") {
    // If all paths were like '/a/b', common is '', which means root.
    if (normalizedDirPaths[0].startsWith("/")) {
      commonAncestor = "/";
    } else if (normalizedDirPaths[0].includes(":")) {
      // Windows drive letter
      commonAncestor =
        normalizedDirPaths[0].substring(
          0,
          normalizedDirPaths[0].indexOf(":") + 1
        ) + "/";
    } else {
      commonAncestor = "."; // Fallback to current directory
    }
  }

  // If the reconstructed path is not a directory, try its parent.
  try {
    if (!fs.statSync(commonAncestor).isDirectory()) {
      commonAncestor = path.dirname(commonAncestor);
    }
  } catch (e) {
    // If stat fails, it might be a non-existent path or a base that's a file name itself.
    // Try parent, but don't go above CWD unless necessary (e.g. for absolute roots)
    if (commonAncestor !== process.cwd() && !path.isAbsolute(commonAncestor)) {
      commonAncestor = path.dirname(commonAncestor);
    }
    if (
      commonAncestor === "." ||
      commonAncestor === ".." ||
      commonAncestor === ""
    ) {
      // Ensure it's not relative traversal
      commonAncestor = process.cwd();
    }
  }
  return path.normalize(commonAncestor); // Normalize back to OS specific
}

/**
 * Generates a relative path for the bundle marker, using forward slashes.
 *
 * @param {string} fileAbsPath - Absolute real path of the file.
 * @param {string} commonAncestorPath - Absolute real path of the common ancestor.
 * @returns {string} Relative path with forward slashes.
 */
function generateBundleRelativePathNode(fileAbsPath, commonAncestorPath) {
  let relPath;
  try {
    const resolvedFile = fs.realpathSync(fileAbsPath);
    const resolvedAncestor = fs.realpathSync(commonAncestorPath);

    // path.relative might return '..' for paths outside commonAncestor, handle this.
    relPath = path.relative(resolvedAncestor, resolvedFile);

    // If relative path indicates going up, or is empty (meaning same as ancestor)
    // or indicates current directory, use basename for simplicity.
    if (relPath.startsWith("..") || relPath === "" || relPath === ".") {
      relPath = path.basename(resolvedFile);
    }
  } catch (e) {
    // Fallback to just the basename if realpath or relative fails.
    relPath = path.basename(fileAbsPath);
  }
  // Ensure forward slashes for bundle consistency.
  return relPath.replace(/\\/g, "/");
}

/**
 * Prepares file objects from paths, reading content and detecting encoding.
 *
 * @param {string[]} absFilePaths - Absolute real file paths.
 * @param {string} commonAncestorForRelpath - Path to make relative paths from.
 * @returns {{fileObjects: FileObjectNode[]}}
 */
function prepareFileObjectsFromPathsNode(
  absFilePaths,
  commonAncestorForRelpath
) {
  const fileObjects = [];

  for (const fileAbsPath of absFilePaths) {
    try {
      const contentBytes = fs.readFileSync(fileAbsPath);
      const detectedEncoding = detectTextEncodingNode(contentBytes);
      const relativePath = generateBundleRelativePathNode(
        fileAbsPath,
        commonAncestorForRelpath
      );
      fileObjects.push({
        absPath: fileAbsPath,
        relativePath: relativePath,
        contentBytes: contentBytes,
        encoding: detectedEncoding,
        isBinary: detectedEncoding === null,
      });
    } catch (e) {
      console.warn(
        `  Warning: Error reading file '${fileAbsPath}': ${e.message}. Skipping.`
      );
    }
  }
  return { fileObjects };
}

/**
 * Creates the bundle string from prepared file objects.
 *
 * @param {FileObjectNode[]} fileObjects - List of prepared file objects.
 * @param {string} encodingMode - User-specified encoding strategy ('auto', 'utf8', 'utf16le', 'b64').
 * @param {boolean} prepareForDeltaReference - Whether to add a hint that this bundle
 *                                           is a good reference for delta operations.
 * @returns {{bundleString: string, formatDescription: string, finalBundleEncodingForWrite: string}}
 */
function createBundleStringFromObjectsNode(
  fileObjects,
  encodingMode,
  prepareForDeltaReference
) {
  const bundleParts = [];
  let formatDescCore = "";
  let finalBundleEncodingForWrite = DEFAULT_ENCODING; // This is the encoding for the output bundle file itself (always utf8 unless all content is utf16le)

  // Determine the core format description based on encoding mode and file types.
  if (encodingMode === "b64") {
    formatDescCore = "Base64";
  } else if (encodingMode === "utf16le") {
    formatDescCore = "Raw UTF-16LE";
  } else if (encodingMode === "utf8") {
    formatDescCore = "Raw UTF-8";
  } else {
    // encodingMode === "auto"
    const textFiles = fileObjects.filter((f) => !f.isBinary);

    // Auto-detect if all text files are consistently UTF-16LE.
    if (
      textFiles.length > 0 &&
      textFiles.every((f) => f.encoding === "utf16le")
    ) {
      formatDescCore = "Raw UTF-16LE";
    } else {
      formatDescCore = "Raw UTF-8";
    }
  }

  let bundleDescriptionSuffix = "";
  if (encodingMode !== "auto") {
    bundleDescriptionSuffix = ` (All files forced to ${encodingMode.toUpperCase()} by user)`;
  } else {
    const hasBinaries = fileObjects.some((f) => f.isBinary);
    const hasTextFiles = fileObjects.some((f) => !f.isBinary);

    if (hasBinaries && hasTextFiles) {
      bundleDescriptionSuffix = ` (Auto-Detected ${
        formatDescCore.includes("UTF-16LE") ? "UTF-16LE" : "UTF-8"
      } for text; binaries as Base64; mixed content found)`;
    } else if (hasBinaries && !hasTextFiles) {
      formatDescCore = "Base64"; // If only binaries, even auto-mode defaults to Base64
      bundleDescriptionSuffix = " (Only binary files found, bundled as Base64)";
    } else if (!hasBinaries && hasTextFiles) {
      bundleDescriptionSuffix = ` (All files appear ${
        formatDescCore.includes("UTF-16LE") ? "UTF-16LE" : "UTF-8"
      } compatible)`;
    } else {
      // No files
      bundleDescriptionSuffix = " (No files)";
    }
  }

  const formatDescription = `${formatDescCore}${bundleDescriptionSuffix}`;

  // Start building bundle parts.
  bundleParts.push(BUNDLE_HEADER_PREFIX);
  bundleParts.push(`${BUNDLE_FORMAT_PREFIX}${formatDescription}`);

  // Add the delta reference hint if requested.
  if (prepareForDeltaReference) {
    bundleParts.push(
      `${DELTA_REFERENCE_HINT_PREFIX}Yes (This bundle is suitable as an original for delta operations)`
    );
  }

  for (const fileObj of fileObjects) {
    bundleParts.push(""); // Empty line for readability
    let contentToWrite = "";
    let isThisFileOutputAsBase64 = false;

    try {
      // If force-encoding is b64 or it's a binary file, Base64 encode it.
      if (encodingMode === "b64" || fileObj.isBinary) {
        contentToWrite = fileObj.contentBytes.toString("base64");
        isThisFileOutputAsBase64 = true;
      } else {
        // Otherwise, decode as text using detected/forced encoding.
        const sourceEncoding = fileObj.encoding || DEFAULT_ENCODING;
        contentToWrite = fileObj.contentBytes.toString(sourceEncoding);
      }
    } catch (e) {
      // Fallback to Base64 if text encoding fails.
      console.warn(
        `  Warning: Error processing '${fileObj.relativePath}'. Fallback to Base64. Error: ${e.message}`
      );
      contentToWrite = fileObj.contentBytes.toString("base64");
      isThisFileOutputAsBase64 = true;
    }

    // Add hint to marker if Base64 and not forced globally Base64.
    const hint =
      isThisFileOutputAsBase64 && encodingMode !== "b64"
        ? ` ${BASE64_HINT_TEXT}`
        : "";
    bundleParts.push(
      `🐈 --- CATS_START_FILE: ${fileObj.relativePath}${hint} ---`
    );
    bundleParts.push(contentToWrite);

    // Ensure a newline for text files not ending in one, for cleaner parsing.
    if (!contentToWrite.endsWith("\n") && !isThisFileOutputAsBase64) {
      bundleParts.push("");
    }
    bundleParts.push(FILE_END_MARKER);
  }

  // Determine the actual encoding for the output bundle file itself.
  // If core format is UTF-16LE, write the bundle file as UTF-16LE. Otherwise, UTF-8.
  if (formatDescCore === "Raw UTF-16LE" && encodingMode !== "b64") {
    finalBundleEncodingForWrite = "utf16le";
  }

  // Return the full bundle string and format description.
  return {
    bundleString: bundleParts.join("\n") + "\n",
    formatDescription,
    finalBundleEncodingForWrite,
  };
}

/**
 * High-level API function to create a bundle string from specified paths.
 *
 * @param {Object} params
 * @param {string[]} params.includePathsRaw - List of raw paths to include.
 * @param {string[]} params.excludePathsRaw - List of raw paths to exclude.
 * @param {string} [params.encodingMode='auto'] - Encoding strategy ('auto', 'utf8', 'utf16le', 'b64').
 * @param {boolean} [params.useDefaultExcludes=true] - Whether to use default exclusions.
 * @param {string} [params.outputFileAbsPath] - Absolute path of the output bundle file.
 * @param {string|null} [params.sysAntInCwdAbsPathToBundleFirst=null] - Path to sys_ant.txt in CWD,
 *                                                                   to be bundled first if present.
 * @param {boolean} [params.prepareForDeltaReference=false] - Whether to add a hint about delta reference.
 * @returns {Promise<{bundleString: string, formatDescription: string, filesAdded: number, bundleFileEncoding: string}>}
 */
async function createBundleFromPathsApi({
  includePathsRaw,
  excludePathsRaw,
  encodingMode = "auto",
  useDefaultExcludes = true,
  outputFileAbsPath,
  sysAntInCwdAbsPathToBundleFirst = null,
  prepareForDeltaReference = false,
}) {
  let sysAntFileObjForBundling = null;

  // Handle sys_ant.txt in CWD to be bundled as the first file.
  if (
    sysAntInCwdAbsPathToBundleFirst &&
    fs.existsSync(sysAntInCwdAbsPathToBundleFirst) &&
    fs.statSync(sysAntInCwdAbsPathToBundleFirst).isFile()
  ) {
    try {
      const sysAntAncestor = path.dirname(sysAntInCwdAbsPathToBundleFirst);
      const contentBytes = fs.readFileSync(sysAntInCwdAbsPathToBundleFirst);
      const detectedEncoding = detectTextEncodingNode(contentBytes);

      sysAntFileObjForBundling = {
        absPath: sysAntInCwdAbsPathToBundleFirst,
        relativePath: path.basename(sysAntInCwdAbsPathToBundleFirst), // Force its relative path to just its filename
        contentBytes: contentBytes,
        encoding: detectedEncoding,
        isBinary: detectedEncoding === null,
      };
    } catch (e) {
      console.warn(
        `  Warning: Could not read sys_ant.txt from CWD for bundling: ${e.message}. Skipping.`
      );
      sysAntFileObjForBundling = null;
    }
  }

  // Get the list of other files to process, excluding the CWD sys_ant.txt if it's handled separately.
  const otherAbsFilePaths = getFinalPathsToProcessNode(
    includePathsRaw,
    excludePathsRaw,
    useDefaultExcludes,
    outputFileAbsPath,
    sysAntInCwdAbsPathToBundleFirst
  );

  // Find common ancestor for calculating relative paths for other files.
  const commonAncestorForOthers =
    otherAbsFilePaths.length > 0
      ? findCommonAncestorNode(otherAbsFilePaths)
      : process.cwd();

  // Prepare FileObject dictionaries for all other files.
  const { fileObjects: otherFileObjects } = prepareFileObjectsFromPathsNode(
    otherAbsFilePaths,
    commonAncestorForOthers
  );

  const finalFileObjects = [];
  // Add sys_ant.txt from CWD first if it's being bundled.
  if (sysAntFileObjForBundling) {
    finalFileObjects.push(sysAntFileObjForBundling);
  }
  // Add all other prepared file objects.
  finalFileObjects.push(...otherFileObjects);

  // If no files are selected, return empty bundle.
  if (finalFileObjects.length === 0) {
    return {
      bundleString: "",
      formatDescription: "No files selected for bundle",
      filesAdded: 0,
      bundleFileEncoding: DEFAULT_ENCODING,
    };
  }

  // Create the bundle string.
  const { bundleString, formatDescription, finalBundleEncodingForWrite } =
    createBundleStringFromObjectsNode(
      finalFileObjects,
      encodingMode,
      prepareForDeltaReference
    );

  return {
    bundleString,
    formatDescription,
    filesAdded: finalFileObjects.length,
    bundleFileEncoding: finalBundleEncodingForWrite,
  };
}

/**
 * Asks the user for confirmation via a Y/n prompt.
 *
 * @param {string} promptMessage - The message to display to the user.
 * @returns {Promise<boolean>} Resolves to true if the user confirms (Y/y/Enter), false otherwise (N/n/Ctrl+C).
 */
async function confirmActionPrompt(promptMessage) {
  // If not running in an interactive terminal, assume 'yes'.
  if (!process.stdin.isTTY) {
    console.error("  Non-interactive mode. Proceeding automatically.");
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    while (true) {
      const answer = await new Promise((resolve) =>
        rl.question(`${promptMessage} [Y/n]: `, resolve)
      );
      const choice = answer.trim().toLowerCase();
      if (choice === "y" || choice === "") {
        return true;
      }
      if (choice === "n") {
        return false;
      }
      console.error("Invalid input. Please enter 'y' or 'n'.");
    }
  } finally {
    rl.close();
  }
}

/**
 * Parses command-line arguments for cats.js.
 * @param {string[]} argv - process.argv.
 * @returns {Object} Parsed arguments.
 * @throws {Error} If arguments are invalid.
 */
function parseCliArgsCats(argv) {
  const args = {
    paths: [],
    output: DEFAULT_OUTPUT_FILENAME,
    exclude: [],
    forceEncoding: "auto",
    useDefaultExcludes: true, // Default to true
    yes: false,
    noSysPrompt: false,
    requireSysPrompt: false,
    prepareForDeltaReference: false, // New flag
    verbose: false,
    help: false,
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
    } else if (arg === "-N" || arg === "--no-default-excludes") {
      args.useDefaultExcludes = false;
    } else if (arg === "-E" || arg === "--force-encoding") {
      if (
        i + 1 < cliArgs.length &&
        ["auto", "utf8", "utf16le", "b64"].includes(
          cliArgs[i + 1].toLowerCase()
        )
      ) {
        args.forceEncoding = cliArgs[++i].toLowerCase();
      } else {
        throw new Error(
          `Argument ${arg} requires a valid value (auto, utf8, utf16le, b64).`
        );
      }
    } else if (arg === "-t" || arg === "--prepare-for-delta-reference") {
      args.prepareForDeltaReference = true;
    } // New flag
    else if (arg === "-y" || arg === "--yes") {
      args.yes = true;
    } else if (arg === "--no-sys-prompt") {
      args.noSysPrompt = true;
    } else if (arg === "--require-sys-prompt") {
      args.requireSysPrompt = true;
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

/**
 * Prints the CLI help message for cats.js.
 */
function printCliHelpCats() {
  console.log(`
cats.js : Bundles project files into a single text artifact for LLMs.

Supports bundling multiple input files and directories, with options for
inclusive and exclusive filtering. Files are placed into the bundle
with paths relative to their common ancestor or the current working directory.

Syntax: node cats.js [PATH...] [options]

Arguments:
  PATH                    One or more files or directories to include.
                          Directories will be scanned recursively.

Options:
  -o, --output BUNDLE_FILE  Output bundle file (default: '${DEFAULT_OUTPUT_FILENAME}'). Use '-' for stdout.
  -x, --exclude EXCLUDE_PATH Path (file or directory) to exclude from bundling. Can be used multiple times.
  -N, --no-default-excludes Disable default excludes: ${DEFAULT_EXCLUDES.join(
    ", "
  )}. All files will be included unless explicitly excluded by -x.
  -E, --force-encoding MODE Force bundle encoding: auto (default), utf8, utf16le, b64.
  -t, --prepare-for-delta-reference Adds a header hint to the bundle indicating it is suitable as an original
                                    bundle for future delta operations with 'dogs.js --apply-delta'.
  -y, --yes               Automatically confirm and proceed without prompting for output file writing.
  --no-sys-prompt         Do not prepend '${SYS_PROMPT_FILENAME}' found near the script itself.
  --require-sys-prompt    Exit if '${SYS_PROMPT_FILENAME}' for prepending is not found or unreadable.
  -v, --verbose           Enable verbose logging.
  -h, --help              Show this help message and exit.

Examples:
  # Bundle 'src' directory, the sibling 'main.js' file, and a subset of another sibling folder 'docs/api'
  node cats.js src main.js docs/api -o project_bundle.bundle

  # Bundle current directory, excluding 'dist' and default excludes
  node cats.js . -x dist -o my_project_context.bundle

  # Bundle current directory, disabling default excludes, force all content to Base64
  node cats.js . -N -E b64 -o binary_assets.bundle

  # Bundle current directory, prepare this bundle to be an original for future delta operations
  node cats.js . -t -o delta_base.bundle
`);
}

/**
 * Main command-line interface function for cats.js.
 * Handles argument parsing, file collection, bundling, and output.
 */
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

  const outputToStdout = args.output === "-";
  let absOutputFilePathForLogic = null;
  let outputTargetDisplayName = "stdout";

  // Determine the absolute path for the output file if not writing to stdout.
  if (!outputToStdout) {
    absOutputFilePathForLogic = path.resolve(process.cwd(), args.output);
    outputTargetDisplayName = absOutputFilePathForLogic;
  }

  let prependedPromptBuffer = Buffer.from("");
  let sysPromptPrependedSuccessfully = false;
  let sysPromptPathUsedForPrepending = null;

  // Handle prepending of the system prompt (e.g., sys_ant.txt).
  if (!args.noSysPrompt) {
    sysPromptPathUsedForPrepending = findSysPromptPathForPrepending();
    if (sysPromptPathUsedForPrepending) {
      try {
        const promptContent = fs.readFileSync(
          sysPromptPathUsedForPrepending,
          DEFAULT_ENCODING
        );
        // Ensure content ends with a newline and append the separator.
        prependedPromptBuffer = Buffer.from(
          promptContent.trimRight() + "\n" + SYS_PROMPT_POST_SEPARATOR,
          DEFAULT_ENCODING
        );
        sysPromptPrependedSuccessfully = true;
        console.error(
          `  Prepended system prompt from: ${sysPromptPathUsedForPrepending}`
        );
      } catch (e) {
        const msg = `Warning: Could not read/process system prompt '${SYS_PROMPT_FILENAME}' from ${sysPromptPathUsedForPrepending}: ${e.message}`;
        console.error(msg);
        if (args.requireSysPrompt) {
          console.error("Exiting due to --require-sys-prompt.");
          process.exit(1);
        }
      }
    } else if (args.requireSysPrompt) {
      console.error(
        `Error: System prompt '${SYS_PROMPT_FILENAME}' not found and --require-sys-prompt specified.`
      );
      process.exit(1);
    } else if (args.paths.length > 0) {
      // Inform if no sys prompt found but paths were given.
      console.error(
        `  Info: System prompt '${SYS_PROMPT_FILENAME}' for prepending not found.`
      );
    }
  }

  let sysAntInCwdToBundleFirst = null;
  const potentialSysAntCwd = path.resolve(process.cwd(), SYS_PROMPT_FILENAME);

  // Handle sys_ant.txt in current working directory (CWD).
  // This is bundled as the first file *within* the bundle.
  if (
    fs.existsSync(potentialSysAntCwd) &&
    fs.statSync(potentialSysAntCwd).isFile()
  ) {
    let resolvedSysAntCwd;
    try {
      resolvedSysAntCwd = fs.realpathSync(potentialSysAntCwd);
    } catch (e) {
      resolvedSysAntCwd = potentialSysAntCwd;
    } // Fallback if realpath fails

    // Ensure it's not the same file that was already prepended.
    if (
      !(
        sysPromptPathUsedForPrepending &&
        resolvedSysAntCwd === fs.realpathSync(sysPromptPathUsedForPrepending)
      )
    ) {
      let isExcludedByArg = args.exclude.some((ex) => {
        try {
          return (
            fs.realpathSync(path.resolve(process.cwd(), ex)) ===
            resolvedSysAntCwd
          );
        } catch (e) {
          return path.resolve(process.cwd(), ex) === resolvedSysAntCwd;
        }
      });

      let isExcludedByDefault = false;
      if (args.useDefaultExcludes) {
        isExcludedByDefault = DEFAULT_EXCLUDES.some((defExcl) => {
          const potentialPath = path.resolve(process.cwd(), defExcl);
          try {
            return fs.realpathSync(potentialPath) === resolvedSysAntCwd;
          } catch (e) {
            return potentialPath === resolvedSysAntCwd;
          }
        });
      }

      if (!isExcludedByArg && !isExcludedByDefault) {
        sysAntInCwdToBundleFirst = potentialSysAntCwd;
        console.error(
          `  Convention: Found '${SYS_PROMPT_FILENAME}' in CWD. It will be the first file _within_ the bundle.`
        );
      } else {
        console.error(
          `  Info: '${SYS_PROMPT_FILENAME}' in CWD is excluded. Not bundling as first file.`
        );
      }
    }
  }

  console.error("Phase 1: Collecting and filtering files...");
  // Create the bundle content string.
  const { bundleString, formatDescription, filesAdded, bundleFileEncoding } =
    await createBundleFromPathsApi({
      includePathsRaw: args.paths,
      excludePathsRaw: args.exclude,
      encodingMode: args.forceEncoding,
      useDefaultExcludes: args.useDefaultExcludes,
      outputFileAbsPath: absOutputFilePathForLogic,
      sysAntInCwdAbsPathToBundleFirst: sysAntInCwdToBundleFirst,
      prepareForDeltaReference: args.prepareForDeltaReference, // Pass the new flag
    });

  // Check if any content was generated.
  if (filesAdded === 0 && !sysPromptPrependedSuccessfully) {
    console.error(
      `No files selected, and system prompt was not prepended. Bundle format: ${formatDescription}. Exiting.`
    );
    process.exit(0);
  }

  if (filesAdded > 0) {
    console.error(`  Files to be included in bundle: ${filesAdded}`);
    console.error(
      `  Bundle format determined: ${formatDescription.split("(")[0].trim()}`
    );
    if (args.forceEncoding !== "auto") {
      console.error(`  (Encoding strategy forced to: ${args.forceEncoding})`);
    }
    if (args.prepareForDeltaReference) {
      console.error(`  (Bundle marked as suitable for delta reference)`);
    }
  }

  let proceed = args.yes;
  // Prompt user for confirmation if not auto-confirming.
  if (!proceed && (filesAdded > 0 || sysPromptPrependedSuccessfully)) {
    console.error(`\n  Output will be written to: ${outputTargetDisplayName}`);
    proceed = await confirmActionPrompt("Proceed with writing output?");
  }

  if (!proceed) {
    console.error("Operation cancelled by user.");
    process.exit(0);
  }

  // Encode the bundle content string to bytes using the determined encoding.
  const bundleBytesToWrite = Buffer.from(bundleString, bundleFileEncoding);

  // Combine prepended prompt and bundle content.
  const fullOutputBytes = Buffer.concat([
    prependedPromptBuffer,
    bundleBytesToWrite,
  ]);

  // Write the output.
  if (!outputToStdout && absOutputFilePathForLogic) {
    console.error(
      `\nPhase 2: Writing bundle to '${outputTargetDisplayName}'...`
    );
    try {
      // Create parent directories if they don't exist.
      const outputParentDir = path.dirname(absOutputFilePathForLogic);
      if (outputParentDir && !fs.existsSync(outputParentDir)) {
        fs.mkdirSync(outputParentDir, { recursive: true });
      }
      fs.writeFileSync(absOutputFilePathForLogic, fullOutputBytes);
      console.error(
        `\nOutput successfully written to: '${outputTargetDisplayName}'`
      );
    } catch (e) {
      console.error(
        `Fatal: Could not write to output file '${outputTargetDisplayName}': ${e.message}`
      );
      process.exit(1);
    }
  } else {
    // Write to stdout.
    process.stdout.write(fullOutputBytes);
  }

  // Clean up potentially empty output file if cancelled mid-process.
  // This logic relies on the prepended prompt existing and no files being added.
  if (
    sysPromptPrependedSuccessfully &&
    filesAdded === 0 &&
    !proceed &&
    absOutputFilePathForLogic
  ) {
    try {
      if (
        fs.existsSync(absOutputFilePathForLogic) &&
        fs.statSync(absOutputFilePathForLogic).size ===
          prependedPromptBuffer.length
      ) {
        fs.unlinkSync(absOutputFilePathForLogic);
      }
    } catch (e) {
      // Ignore error during cleanup.
    }
  }
}

// Export high-level API functions for library usage.
module.exports = {
  createBundleFromPathsApi,
};

// If the script is run directly from the command line.
if (require.main === module) {
  mainCliCatsNode().catch((error) => {
    if (error.name === "AbortError") {
      // Catch specific readline abort
      console.error("\nOperation cancelled.");
      process.exit(130);
    } else {
      console.error(
        "\nAn unexpected critical error occurred in cats.js main:",
        error
      );
      // In a real scenario, might want to print stack trace: console.error(error.stack);
      process.exit(1);
    }
  });
}
