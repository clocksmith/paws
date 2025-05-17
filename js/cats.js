#!/usr/bin/env node
// cats.js - Bundles project files into a single text artifact.
const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");
const readline = require("readline");

const FILE_START_MARKER_TEMPLATE = "🐈 --- CATS_START_FILE: {} ---";
const FILE_END_MARKER = "🐈 --- CATS_END_FILE ---";
const DEFAULT_ENCODING = "utf-8"; // Default *text* encoding
const DEFAULT_OUTPUT_FILENAME = "cats_out.bundle";
const BUNDLE_HEADER_PREFIX = "# Cats Bundle";
const BUNDLE_FORMAT_PREFIX = "# Format: ";
const DEFAULT_EXCLUDES = ['.git', 'node_modules', 'gem', '__pycache__'];

/**
 * @typedef {Object} FileObjectNode
 * @property {string} path - Absolute real path of the source file.
 * @property {string} relativePath - Relative path used in the bundle marker.
 * @property {Buffer} contentBytes - File content as a Buffer.
 * @property {string|null} encoding - Detected: 'utf-8', 'utf16le', or null for binary.
 * @property {boolean} isUtf8 - Kept for compatibility, derived from encoding.
 */

/**
 * Detects if content is likely UTF-8 or UTF-16LE.
 * @param {Buffer} fileContentBytes
 * @returns {string|null} 'utf-8', 'utf16le', or null for binary.
 */
function detectTextEncodingNode(fileContentBytes) {
  if (!fileContentBytes || fileContentBytes.length === 0) {
    return DEFAULT_ENCODING; // Empty is text compatible
  }
  // Check for UTF-16LE BOM
  if (fileContentBytes.length >= 2 && fileContentBytes[0] === 0xFF && fileContentBytes[1] === 0xFE) {
    try { fileContentBytes.toString('utf16le'); return 'utf16le'; } catch (e) { /* fall through */ }
  }
  // Check for UTF-16BE BOM
   if (fileContentBytes.length >= 2 && fileContentBytes[0] === 0xFE && fileContentBytes[1] === 0xFF) {
     try { fileContentBytes.toString('utf16le'); return 'utf16le'; } catch (e) { /* fall through */ } // Node might handle BE via utf16le
   }

  // Try decoding as UTF-8
  try {
    // Node's toString is lenient, stricter check needed. Look for null bytes.
    if (fileContentBytes.includes(0x00)) throw new Error('Null byte found');
    // Simple test: decode and re-encode, check length? Might be slow.
    // For now, assume if it doesn't contain null bytes, it *might* be UTF-8.
    fileContentBytes.toString(DEFAULT_ENCODING); // Basic check
    return DEFAULT_ENCODING;
  } catch (e) {
    // Try decoding as UTF-16LE (without BOM)
    try {
      fileContentBytes.toString('utf16le');
      return 'utf16le';
    } catch (e2) {
      return null; // Assume binary if neither works well
    }
  }
}

/**
 * Determines the final list of absolute, canonical file paths to include.
 * Handles exclusions (user + default) and output file skipping.
 * @param {string[]} includePathsRaw - Raw input paths.
 * @param {string[]} excludePathsRaw - User-specified exclusion paths.
 * @param {boolean} useDefaultExcludes - Whether to apply default excludes.
 * @param {string|null} [outputFileAbsPath=null] - Absolute path of the output file.
 * @param {string[]} [originalUserPaths=[]] - Paths originally specified by user.
 * @param {boolean} [verbose=false] - Verbose logging.
 * @returns {string[]} Sorted list of absolute file real paths.
 */
function getFinalPathsToProcessNode(
  includePathsRaw,
  excludePathsRaw,
  useDefaultExcludes,
  outputFileAbsPath = null,
  originalUserPaths = [],
  verbose = false
) {
  const candidateFileRealpaths = new Set();
  let allExcludePaths = [...excludePathsRaw];
  if (useDefaultExcludes) {
      const cwd = process.cwd();
      for (const defaultExcl of DEFAULT_EXCLUDES) {
           const potentialPath = path.join(cwd, defaultExcl);
           // Only add if it exists to avoid overly broad excludes
           if (fs.existsSync(potentialPath)) {
                allExcludePaths.push(potentialPath);
                if (verbose) console.log(`  Debug: Applying default exclude for existing path: ${potentialPath}`);
           } else if (verbose) {
               // console.log(`  Debug: Default exclude '${defaultExcl}' not found, not applying.`);
           }
      }
  }


  const absExcludedRealpathsSet = new Set(
    allExcludePaths
      .map((p) => path.resolve(p))
      .map((p) => { try { return fs.realpathSync(p); } catch { return p; }}) // Get realpath, fallback to abspath
  );

  const absExcludedDirsForPruningSet = new Set(
    Array.from(absExcludedRealpathsSet).filter((pReal) => {
      try { return fs.existsSync(pReal) && fs.statSync(pReal).isDirectory(); }
      catch { return false; }
    })
  );
  const processedTopLevelInputRealpaths = new Set();

  for (const inclPathRaw of includePathsRaw) {
    let currentInputRealPath;
    const absInclPath = path.resolve(inclPathRaw);
    try { currentInputRealPath = fs.realpathSync(absInclPath); }
    catch { currentInputRealPath = absInclPath; } // Fallback

    if (
      processedTopLevelInputRealpaths.has(currentInputRealPath) &&
      originalUserPaths.includes(inclPathRaw)
    ) {
      continue;
    }
    processedTopLevelInputRealpaths.add(currentInputRealPath);

    if (outputFileAbsPath && currentInputRealPath === outputFileAbsPath) continue;
    if (absExcludedRealpathsSet.has(currentInputRealPath)) continue;

    const isInsideExcludedDir = Array.from(absExcludedDirsForPruningSet).some(
      (excludedDirRp) =>
        currentInputRealPath === excludedDirRp || // Exclude the dir itself
        currentInputRealPath.startsWith(excludedDirRp + path.sep)
    );
    if (isInsideExcludedDir) continue;

    if (!fs.existsSync(currentInputRealPath)) {
      if (originalUserPaths.includes(inclPathRaw)) {
        console.warn(`  Warning: Input path '${inclPathRaw}' not found. Skipping.`);
      } else if (verbose && inclPathRaw === "sys_human.txt") {
         // console.log(`  Debug: Conventionally included '${inclPathRaw}' not found. Skipping.`);
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
          let itemRealPath;
          try { itemRealPath = fs.realpathSync(itemPath); }
          catch { itemRealPath = itemPath; } // Fallback

          if (outputFileAbsPath && itemRealPath === outputFileAbsPath) continue;
          if (absExcludedRealpathsSet.has(itemRealPath)) continue;

          const isInsideExclDirWalk = Array.from(absExcludedDirsForPruningSet).some(
             (excludedDirRp) => itemRealPath === excludedDirRp || itemRealPath.startsWith(excludedDirRp + path.sep)
           );
          if (isInsideExclDirWalk) continue;

          if (item.isFile()) {
            candidateFileRealpaths.add(itemRealPath);
          } else if (item.isDirectory()) {
              // Check if dir itself is excluded before recursing
              if (!absExcludedRealpathsSet.has(itemRealPath) && !isInsideExclDirWalk) {
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
  try {
      if (commonAncestorPath === fileRealPath && fs.statSync(fileRealPath).isFile()) {
          relPath = path.basename(fileRealPath);
      } else if (commonAncestorPath === path.dirname(fileRealPath) && fs.statSync(fileRealPath).isFile()) {
          relPath = path.basename(fileRealPath);
      } else {
          relPath = path.relative(commonAncestorPath, fileRealPath);
          if (relPath === "" || relPath === ".") {
              relPath = path.basename(fileRealPath);
          }
      }
  } catch (e) { // Handle potential stat errors on complex paths
      relPath = path.basename(fileRealPath);
  }
  return relPath.replace(/\\/g, "/"); // Ensure forward slashes
}


/**
 * Finds the longest common ancestor directory for a list of absolute paths.
 * @param {string[]} absFilePaths - List of absolute, real file paths.
 * @returns {string} The common ancestor path.
 */
function findCommonAncestorNode(absFilePaths) {
    if (!absFilePaths || absFilePaths.length === 0) { return process.cwd(); }
    if (absFilePaths.length === 1) {
        try {
            const pStat = fs.statSync(absFilePaths[0]);
            return pStat.isDirectory() ? absFilePaths[0] : path.dirname(absFilePaths[0]);
        } catch { return path.dirname(absFilePaths[0]); } // Fallback if stat fails
    }

    const dirPaths = absFilePaths.map((p) => {
        try { return fs.statSync(p).isDirectory() ? p : path.dirname(p); }
        catch { return path.dirname(p); } // Fallback
    });

    let commonPath = dirPaths[0];
    for (let i = 1; i < dirPaths.length; i++) {
        let currentPath = dirPaths[i];
        // Normalize separators for reliable comparison
        const normCommon = commonPath.split(path.sep).join('/');
        const normCurrent = currentPath.split(path.sep).join('/');
        const commonParts = normCommon === '/' ? [''] : normCommon.split('/');
        const currentParts = normCurrent === '/' ? [''] : normCurrent.split('/');

        let k = 0;
        while(k < commonParts.length && k < currentParts.length && commonParts[k] === currentParts[k]) {
            k++;
        }
        // Reconstruct common path ensuring correct root handling ('/' or 'C:/')
        let newCommon = commonParts.slice(0, k).join('/');
         if (newCommon === '' && commonParts[0] === '') newCommon = '/'; // Handle root Unix
         else if (!newCommon && commonParts[0] && commonParts[0].endsWith(':')) newCommon = commonParts[0] + '/'; // Handle root Windows Drive C:/
         else if (!newCommon) newCommon = '.'; // Relative fallback

        commonPath = path.normalize(newCommon); // Back to OS specific
    }

    // If the result isn't actually a directory (e.g., common prefix of files), use its parent
    try {
      if (!fs.statSync(commonPath).isDirectory()) {
        commonPath = path.dirname(commonPath);
      }
    } catch {
       // If stat fails, maybe it's a non-existent common root? Fallback.
       if (commonPath !== process.cwd()) { // Avoid going above CWD
          commonPath = path.dirname(commonPath);
       }
    }

    return commonPath;
}


/**
 * Prepares file objects from paths.
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
        path: fileAbsPath,
        relativePath: relativePath,
        contentBytes: contentBytes,
        encoding: detectedEncoding,
        isUtf8: detectedEncoding === 'utf-8',
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
 * @param {FileObjectNode[]} fileObjects
 * @param {string} encodingMode - 'auto', 'utf8', 'utf16le', 'b64'.
 * @returns {{bundleString: string, formatDescription: string}}
 */
function createBundleStringFromObjectsNode(
  fileObjects,
  encodingMode // 'auto', 'utf8', 'utf16le', 'b64'
) {
  const bundleParts = [];
  let finalBundleFormat = 'Raw UTF-8';
  let finalEncodingForWrite = 'utf8'; // Node encoding names

  if (encodingMode === 'b64') {
    finalBundleFormat = 'Base64';
    finalEncodingForWrite = 'base64';
  } else if (encodingMode === 'utf16le') {
    finalBundleFormat = 'Raw UTF-16LE';
    finalEncodingForWrite = 'utf16le';
  } else if (encodingMode === 'utf8') {
    finalBundleFormat = 'Raw UTF-8';
    finalEncodingForWrite = 'utf8';
  } else if (encodingMode === 'auto') {
    const hasBinary = fileObjects.some(f => f.encoding === null);
    const hasUtf16 = fileObjects.some(f => f.encoding === 'utf16le');
    if (hasBinary) {
        finalBundleFormat = 'Base64';
        finalEncodingForWrite = 'base64';
    } else if (hasUtf16) {
        finalBundleFormat = 'Raw UTF-16LE';
        finalEncodingForWrite = 'utf16le';
    } else {
        finalBundleFormat = 'Raw UTF-8';
        finalEncodingForWrite = 'utf8';
    }
  } else { // Default fallback
    finalBundleFormat = 'Raw UTF-8';
    finalEncodingForWrite = 'utf8';
  }

  let formatDescription = finalBundleFormat;
  if (encodingMode !== 'auto') formatDescription += ` (Forced by user: ${encodingMode})`;
  else if (finalBundleFormat === 'Base64') formatDescription += " (Auto-Detected binary content)";
  else if (finalBundleFormat === 'Raw UTF-16LE') formatDescription += " (Auto-Detected UTF-16LE content)";
  else formatDescription += " (All files appear UTF-8 compatible)";

  bundleParts.push(BUNDLE_HEADER_PREFIX);
  bundleParts.push(`${BUNDLE_FORMAT_PREFIX}${formatDescription}`);

  for (const fileObj of fileObjects) {
    bundleParts.push("");
    bundleParts.push(
      FILE_START_MARKER_TEMPLATE.replace("{}", fileObj.relativePath)
    );

    let contentToWrite = "";
    try {
        if (finalEncodingForWrite === 'base64') {
            contentToWrite = fileObj.contentBytes.toString('base64');
        } else if (finalEncodingForWrite === 'utf16le') {
            contentToWrite = fileObj.contentBytes.toString('utf16le');
        } else { // utf8
            contentToWrite = fileObj.contentBytes.toString('utf8');
        }
    } catch (e) {
         console.warn(`  Warning: Unexpected error encoding file '${fileObj.relativePath}' for bundle format '${finalBundleFormat}'. Falling back to Base64 for this file. Error: ${e.message}`);
         contentToWrite = fileObj.contentBytes.toString('base64');
    }
    bundleParts.push(contentToWrite);
    bundleParts.push(FILE_END_MARKER);
  }
  // Write bundle file itself as UTF-8
  return { bundleString: bundleParts.join("\n") + "\n", formatDescription };
}

/**
 * High-level function to create a bundle string from paths (Node.js).
 * @param {Object} params
 * @param {string[]} params.includePaths - Paths to include.
 * @param {string[]} params.excludePaths - User paths to exclude.
 * @param {string} params.encodingMode - 'auto', 'utf8', 'utf16le', 'b64'.
 * @param {boolean} params.useDefaultExcludes - Apply default excludes.
 * @param {string} [params.outputFileAbsPath] - Absolute path of output file for self-exclusion.
 * @param {string} [params.baseDirForRelpath] - Optional base directory for relative paths.
 * @param {string[]} [params.originalUserPaths] - For warning logic.
 * @param {boolean} [params.verbose] - Verbose logging.
 * @returns {Promise<{bundleString: string, formatDescription: string, filesAdded: number}>}
 */
async function bundleFromPathsNode({
  includePaths,
  excludePaths,
  encodingMode = 'auto',
  useDefaultExcludes = true,
  outputFileAbsPath,
  baseDirForRelpath,
  originalUserPaths = [],
  verbose = false,
}) {
  // Handle sys_human.txt automatically for library too? Yes, consistent with Python.
  let finalIncludePaths = [...includePaths];
  const sysHumanPath = "sys_human.txt";
  const sysHumanAbsPath = path.resolve(sysHumanPath);
  let sysHumanRealPath = null;
   try {
       if (fs.existsSync(sysHumanAbsPath) && fs.statSync(sysHumanAbsPath).isFile()) {
            sysHumanRealPath = fs.realpathSync(sysHumanAbsPath);
            const alreadyListed = finalIncludePaths.some((pRaw) => {
                try { return fs.realpathSync(path.resolve(pRaw)) === sysHumanRealPath; }
                catch { return path.resolve(pRaw) === sysHumanAbsPath; }
            });
            if (!alreadyListed) {
                 // Check if excluded by user rules or default rules (if active)
                 let isExcluded = excludePaths.some(excl => {
                     try { return fs.realpathSync(path.resolve(excl)) === sysHumanRealPath; } catch { return false; }
                 });
                 if (!isExcluded && useDefaultExcludes) {
                     isExcluded = DEFAULT_EXCLUDES.some(defExcl => {
                         const potentialPath = path.join(process.cwd(), defExcl);
                          try { return fs.existsSync(potentialPath) && fs.realpathSync(potentialPath) === sysHumanRealPath; } catch { return false; }
                     });
                 }

                 if (!isExcluded) {
                     finalIncludePaths.unshift(sysHumanPath); // Prepend if found and not excluded
                      if (verbose) console.log(`  Debug: Library prepending sys_human.txt: ${sysHumanPath}`);
                 } else if (verbose) {
                     console.log(`  Debug: Library found sys_human.txt but it is excluded: ${sysHumanPath}`);
                 }
            }
       }
   } catch (e) { if (verbose) console.log(`  Debug: Error checking sys_human.txt: ${e.message}`); }


  const absFilePathsToBundle = getFinalPathsToProcessNode(
    finalIncludePaths, // Use potentially modified list
    excludePaths,
    useDefaultExcludes,
    outputFileAbsPath,
    originalUserPaths,
    verbose
  );

  if (absFilePathsToBundle.length === 0) {
    return { bundleString: "", formatDescription: "No files selected", filesAdded: 0 };
  }

  let commonAncestor;
  if (baseDirForRelpath) {
    commonAncestor = path.resolve(baseDirForRelpath);
    try { commonAncestor = fs.realpathSync(commonAncestor); } catch { /* Use as is */ }
  } else {
    commonAncestor = findCommonAncestorNode(absFilePathsToBundle);
  }

  const { fileObjects } = prepareFileObjectsFromPathsNode(
    absFilePathsToBundle,
    commonAncestor
  );

  if (fileObjects.length === 0) {
    return { bundleString: "", formatDescription: "No files successfully processed", filesAdded: 0 };
  }

  const { bundleString, formatDescription } = createBundleStringFromObjectsNode(
    fileObjects,
    encodingMode
  );
  return { bundleString, formatDescription, filesAdded: fileObjects.length };
}

function parseCliArgsCats(argv) {
  const args = {
    paths: [],
    output: DEFAULT_OUTPUT_FILENAME,
    exclude: [],
    forceEncoding: 'auto',
    noDefaultExcludes: false,
    yes: false,
    help: false,
    verbose: false,
  };
  const cliArgs = argv.slice(2);
  let i = 0;
  while (i < cliArgs.length) {
    const arg = cliArgs[i];
    if (arg === "-h" || arg === "--help") { args.help = true; break; }
    else if (arg === "-o" || arg === "--output") {
      if (i + 1 < cliArgs.length && !cliArgs[i + 1].startsWith("-")) args.output = cliArgs[++i];
      else throw new Error(`Argument ${arg} requires a value.`);
    } else if (arg === "-x" || arg === "--exclude") {
      if (i + 1 < cliArgs.length && !cliArgs[i + 1].startsWith("-")) args.exclude.push(cliArgs[++i]);
      else throw new Error(`Argument ${arg} requires a value.`);
    } else if (arg === "-E" || arg === "--force-encoding") {
       if (i + 1 < cliArgs.length && ['auto', 'utf8', 'utf16le', 'b64'].includes(cliArgs[i + 1].toLowerCase())) {
            args.forceEncoding = cliArgs[++i].toLowerCase();
       } else throw new Error(`Argument ${arg} requires a value (auto, utf8, utf16le, b64).`);
    } else if (arg === "-N" || arg === "--no-default-excludes") { args.noDefaultExcludes = true; }
    else if (arg === "-y" || arg === "--yes") { args.yes = true; }
    else if (arg === "-v" || arg === "--verbose") { args.verbose = true; }
    else if (!arg.startsWith("-")) { args.paths.push(arg); }
    else { throw new Error(`Unknown option: ${arg}`); }
    i++;
  }
  if (args.paths.length === 0 && !args.help) {
    throw new Error("You must specify at least one PATH to include.");
  }
  return args;
}

function printCliHelpCats() {
  console.log(`cats.js : Bundles project files into a single text artifact for LLMs.

Syntax: node cats.js [PATH...] [options]

Arguments:
  PATH                    Files or directories to include in the bundle.

Options:
  -o, --output BUNDLE_FILE  Output bundle file name (default: ${DEFAULT_OUTPUT_FILENAME}).
  -x, --exclude EXCLUDE_PATH Path to exclude (file/directory). Applied in addition to defaults. Multiple allowed.
  -N, --no-default-excludes Disable default excludes: ${DEFAULT_EXCLUDES.join(', ')}.
  -E, --force-encoding MODE Force bundle encoding: auto (default), utf8, utf16le, b64.
  -y, --yes               Automatically confirm and proceed (if a prompt would occur).
  -v, --verbose           Enable verbose logging.
  -h, --help              Show this help message and exit.

Example: node cats.js ./src ./docs -x .git -x node_modules -o my_project.bundle`);
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

  if (args.help) { printCliHelpCats(); process.exit(0); }

  const absOutputFilePath = path.resolve(args.output);
  const originalUserPathsForWarning = [...args.paths];

  console.log("Phase 1: Collecting and filtering files...");
  const { bundleString, formatDescription, filesAdded } =
    await bundleFromPathsNode({
      includePaths: args.paths, // sys_human.txt handled inside
      excludePaths: args.exclude,
      encodingMode: args.forceEncoding,
      useDefaultExcludes: !args.noDefaultExcludes,
      outputFileAbsPath: absOutputFilePath,
      originalUserPaths: originalUserPathsForWarning,
      verbose: args.verbose,
    });

  if (filesAdded === 0) {
    console.log(`No files selected for bundling. ${formatDescription}. Exiting.`);
    return;
  }

  console.log(`  Files to be bundled: ${filesAdded}`);
  console.log(`  Bundle format determined: ${formatDescription.split("(")[0].trim()}`);
   if (args.forceEncoding !== 'auto') {
       console.log(`  (Encoding forced by user: ${args.forceEncoding})`);
   }

  let proceed = args.yes;
  if (!proceed && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) =>
      rl.question(`Output will be written to: ${absOutputFilePath}\nProceed with bundling? [Y/n]: `, resolve)
    );
    rl.close();
    if (answer.trim().toLowerCase() !== "y" && answer.trim() !== "") {
       console.log("Bundling cancelled by user."); return;
    }
     proceed = true;
  } else if (!process.stdin.isTTY && !args.yes) {
    if (args.verbose) console.log("  Info: Non-interactive mode, proceeding without confirmation prompt.");
    proceed = true;
  }

  if (!proceed) return;

  console.log(`\nPhase 2: Writing bundle to '${absOutputFilePath}'...`);
  console.log(`  Final Bundle Format: ${formatDescription}`);

  try {
    const outputParentDir = path.dirname(absOutputFilePath);
    if (outputParentDir && !fs.existsSync(outputParentDir)) {
      fs.mkdirSync(outputParentDir, { recursive: true });
    }
    // Write bundle file itself as UTF-8
    fs.writeFileSync(absOutputFilePath, bundleString, { encoding: DEFAULT_ENCODING });
    console.log(`\nBundle created successfully: '${args.output}'`);
    console.log(`  Files added: ${filesAdded}`);
  } catch (e) {
    console.error(`\nFatal error writing bundle: ${e.message}`);
    process.exit(1);
  }
}

module.exports = {
  bundleFromPathsNode,
};

if (require.main === module) {
  mainCliCatsNode().catch((error) => {
    console.error("CLI Error:", error);
    process.exit(1);
  });
}