#!/usr/bin/env node
// dogs.js - Extracts files from a cats.js or LLM-generated (DOGS_) bundle.
const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");
const readline = require("readline");

const DEFAULT_ENCODING = "utf-8";

const CATS_FILE_START_MARKER_REGEX =
  /^-{3,}\s*CATS_START_FILE\s*:\s*(.+?)\s*-{3,}$/i;
const CATS_FILE_END_MARKER_REGEX = /^-{3,}\s*CATS_END_FILE\s*-{3,}$/i;
const DOGS_FILE_START_MARKER_REGEX =
  /^-{3,}\s*DOGS_START_FILE\s*:\s*(.+?)\s*-{3,}$/i;
const DOGS_FILE_END_MARKER_REGEX = /^-{3,}\s*DOGS_END_FILE\s*-{3,}$/i;

const CATS_BUNDLE_HEADER_PREFIX = "# Cats Bundle";
const DOGS_BUNDLE_HEADER_PREFIX = "# Dogs Bundle";
const BUNDLE_FORMAT_PREFIX = "# Format: ";

/**
 * Basic sanitization for a single filename or directory name component.
 * @param {string} comp - The component string.
 * @returns {string} Sanitized component.
 */
function sanitizePathComponent(comp) {
  if (!comp || comp === "." || comp === "..") {
    return "_sanitized_dots_";
  }
  let sanitized = comp.replace(/[^\w.\-_~ ]/g, "_"); // Allow spaces, tilde too
  sanitized = sanitized.replace(/\s+/g, "_"); // Replace spaces with single underscore
  sanitized = sanitized.replace(/_+/g, "_");
  sanitized = sanitized.replace(/^[._]+|[._]+$/g, "");
  return sanitized || "sanitized_empty_comp";
}

/**
 * Sanitizes a relative path from the bundle, ensuring components are safe.
 * @param {string} relPathFromBundle - The relative path from bundle marker.
 * @returns {string} Sanitized relative path using OS-specific separators.
 */
function sanitizeRelativePath(relPathFromBundle) {
  const normalizedPath = relPathFromBundle.replace(/\\/g, "/");
  const parts = normalizedPath.split("/");
  const sanitizedParts = parts
    .map((p) => sanitizePathComponent(p))
    .filter((p) => p && p !== "." && p !== "..");

  if (sanitizedParts.length === 0) {
    return (
      sanitizePathComponent(path.basename(relPathFromBundle)) ||
      "unnamed_file_from_bundle"
    );
  }
  return path.join(...sanitizedParts);
}

/**
 * @typedef {Object} ParsedFileFromBundle
 * @property {string} path - Relative path from bundle marker.
 * @property {Buffer} contentBytes - Decoded file content as Buffer.
 * @property {string} formatUsedForDecode - 'b64' or 'utf8'.
 */
/**
 * Parses the bundle string into a list of file objects.
 * Prioritizes DOGS_ markers/headers, then CATS_. Does not do heuristic LLM parsing.
 * @param {string} bundleContent - The entire bundle string.
 * @param {string|null} forcedFormatOverride - 'b64', 'utf8', or null for auto.
 * @param {boolean} [verbose=false] - Enable verbose logging.
 * @returns {{parsedFiles: ParsedFileFromBundle[], formatDescription: string, bundleContentIsB64Effective: boolean|null}}
 */
function parseBundleContent(
  bundleContent,
  forcedFormatOverride = null,
  verbose = false
) {
  const lines = bundleContent.split(/\r?\n/);
  const parsedFiles = [];
  let bundleFormatIsB64 = null;
  let formatDescription = "Unknown (Header not found or not recognized)";
  let headerLinesConsumed = 0;
  const possibleHeaders = [
    { prefix: DOGS_BUNDLE_HEADER_PREFIX, desc: "Dogs Bundle (LLM Output)" },
    {
      prefix: CATS_BUNDLE_HEADER_PREFIX,
      desc: "Cats Bundle (Original Source)",
    },
  ];
  let headerTypeFound = null;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lineTextTrimmed = lines[i].trim();
    if (!headerTypeFound) {
      for (const headerInfo of possibleHeaders) {
        if (lineTextTrimmed.startsWith(headerInfo.prefix)) {
          headerTypeFound = headerInfo.desc;
          headerLinesConsumed = Math.max(headerLinesConsumed, i + 1);
          break;
        }
      }
      if (headerTypeFound) continue;
    }
    if (headerTypeFound && lineTextTrimmed.startsWith(BUNDLE_FORMAT_PREFIX)) {
      headerLinesConsumed = Math.max(headerLinesConsumed, i + 1);
      const tempFormatDesc = lineTextTrimmed
        .substring(BUNDLE_FORMAT_PREFIX.length)
        .trim();
      formatDescription = `${headerTypeFound} - Format: ${tempFormatDesc}`;
      if (tempFormatDesc.toLowerCase().includes("base64")) {
        bundleFormatIsB64 = true;
      } else if (
        tempFormatDesc
          .toLowerCase()
          .includes(`raw ${DEFAULT_ENCODING.toLowerCase()}`) ||
        tempFormatDesc.toLowerCase().includes("utf-8 compatible") ||
        tempFormatDesc.toLowerCase().includes("raw utf-8")
      ) {
        bundleFormatIsB64 = false;
      } else {
        bundleFormatIsB64 = false;
        formatDescription += ` (Unrecognized format details, defaulting to Raw UTF-8)`;
        if (verbose)
          console.warn(
            `  Warning: Unrecognized format details in header: '${tempFormatDesc}'. Defaulting to UTF-8.`
          );
      }
      break;
    }
  }

  if (forcedFormatOverride) {
    bundleFormatIsB64 = forcedFormatOverride.toLowerCase() === "b64";
    if (headerTypeFound) {
      formatDescription = `${
        formatDescription.split(" - Format: ")[0]
      } - Format: ${
        bundleFormatIsB64 ? "Base64" : `Raw ${DEFAULT_ENCODING}`
      } (Overridden by user)`;
    } else {
      formatDescription = `Forced by user: ${
        bundleFormatIsB64 ? "Base64" : `Raw ${DEFAULT_ENCODING}`
      }`;
    }
  }

  if (bundleFormatIsB64 === null) {
    bundleFormatIsB64 = false;
    formatDescription = `Raw ${DEFAULT_ENCODING} (Assumed, no valid header found. Override with --input-format if needed.)`;
    if (verbose) console.warn(`  Warning: ${formatDescription}`);
  }
  const effectiveIsB64ForDecode = bundleFormatIsB64 === true;
  let currentFileRelativePathFromMarker = null;
  let contentBufferLines = [];

  for (let lineNum = headerLinesConsumed; lineNum < lines.length; lineNum++) {
    const lineText = lines[lineNum];
    const strippedLine = lineText.trim();
    let startMatch =
      DOGS_FILE_START_MARKER_REGEX.exec(strippedLine) ||
      CATS_FILE_START_MARKER_REGEX.exec(strippedLine);
    let endMatch =
      DOGS_FILE_END_MARKER_REGEX.test(strippedLine) ||
      CATS_FILE_END_MARKER_REGEX.test(strippedLine);

    if (startMatch) {
      if (currentFileRelativePathFromMarker && verbose) {
        console.warn(
          `  Warning (L${
            lineNum + 1
          }): New file started before '${currentFileRelativePathFromMarker}' ended. Previous block discarded.`
        );
      }
      currentFileRelativePathFromMarker = startMatch[1].trim();
      contentBufferLines = [];
      if (verbose)
        console.log(
          `  Debug (L${
            lineNum + 1
          }): Matched START marker for '${currentFileRelativePathFromMarker}'`
        );
      continue;
    }
    if (endMatch && currentFileRelativePathFromMarker) {
      const rawContentStr = contentBufferLines.join("\n");
      let fileContentBytes;
      try {
        if (effectiveIsB64ForDecode) {
          fileContentBytes = Buffer.from(
            rawContentStr.replace(/\s/g, ""),
            "base64"
          );
        } else {
          fileContentBytes = Buffer.from(rawContentStr, DEFAULT_ENCODING);
        }
        parsedFiles.push({
          path: currentFileRelativePathFromMarker,
          contentBytes: fileContentBytes,
          formatUsedForDecode: effectiveIsB64ForDecode ? "b64" : "utf8",
        });
        if (verbose)
          console.log(
            `  Debug (L${
              lineNum + 1
            }): Matched END marker for '${currentFileRelativePathFromMarker}', decoded.`
          );
      } catch (e) {
        console.warn(
          `  Error (L${
            lineNum + 1
          }): Failed to decode content for '${currentFileRelativePathFromMarker}' (format: ${
            effectiveIsB64ForDecode ? "Base64" : "UTF-8"
          }). Skipping. Error: ${e.message}`
        );
      }
      currentFileRelativePathFromMarker = null;
      contentBufferLines = [];
      continue;
    }
    if (currentFileRelativePathFromMarker !== null) {
      contentBufferLines.push(lineText);
    }
  }
  if (currentFileRelativePathFromMarker) {
    console.warn(
      `  Warning: Bundle ended before file '${currentFileRelativePathFromMarker}' was closed by an END marker. Block discarded.`
    );
  }
  return {
    parsedFiles,
    formatDescription,
    bundleContentIsB64Effective: effectiveIsB64ForDecode,
  };
}

async function extractToMemory(
  bundleContent,
  inputFormatOverride = null,
  verbose = false
) {
  const { parsedFiles } = parseBundleContent(
    bundleContent,
    inputFormatOverride,
    verbose
  );
  return parsedFiles;
}

async function extractToDiskNode({
  bundleFilePath,
  bundleFileContent,
  outputDir,
  overwritePolicy = "prompt",
  inputFormat = "auto",
  verbose = false,
}) {
  const results = [];
  const absOutputDirBase = path.resolve(outputDir);

  if (!fs.existsSync(absOutputDirBase)) {
    try {
      await fs.promises.mkdir(absOutputDirBase, { recursive: true });
      if (verbose)
        console.log(`  Info: Created output directory '${absOutputDirBase}'.`);
    } catch (e) {
      const msg = `Error creating base output directory '${absOutputDirBase}': ${e.message}`;
      console.error(msg);
      results.push({ path: outputDir, status: "error", message: msg });
      return results;
    }
  } else if (!(await fs.promises.stat(absOutputDirBase)).isDirectory()) {
    const msg = `Error: Output path '${absOutputDirBase}' exists but is not a directory.`;
    console.error(msg);
    results.push({ path: outputDir, status: "error", message: msg });
    return results;
  }
  const realAbsOutputDirBase = fs.realpathSync(absOutputDirBase);
  let contentStr = bundleFileContent;
  if (!contentStr && bundleFilePath) {
    try {
      contentStr = await fs.promises.readFile(
        path.resolve(bundleFilePath),
        DEFAULT_ENCODING
      );
    } catch (e) {
      const msg = `Error reading bundle file '${bundleFilePath}': ${e.message}`;
      console.error(msg);
      results.push({ path: bundleFilePath, status: "error", message: msg });
      return results;
    }
  }
  if (!contentStr && contentStr !== "") {
    results.push({
      path: "bundle",
      status: "error",
      message: "No bundle content provided.",
    });
    return results;
  }
  const formatOverride = inputFormat === "auto" ? null : inputFormat;
  const { parsedFiles, formatDescription } = parseBundleContent(
    contentStr,
    formatOverride,
    verbose
  );
  if (verbose)
    console.log(
      `  Info: Bundle parsed. Format: ${formatDescription}. Files: ${parsedFiles.length}.`
    );

  if (parsedFiles.length === 0) return results;

  let alwaysYes = overwritePolicy === "yes";
  let alwaysNo = overwritePolicy === "no";
  let userQuitExtraction = false;
  const rl =
    overwritePolicy === "prompt" && process.stdin.isTTY
      ? readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })
      : null;
  const promptUser = rl
    ? (query) =>
        new Promise((resolve) =>
          rl.question(query, (answer) => resolve(answer))
        )
    : null;
  if (overwritePolicy === "prompt" && !process.stdin.isTTY) {
    if (verbose)
      console.log(
        "Info: Non-interactive mode, 'prompt' for overwrite policy defaults to 'no'."
      );
    alwaysNo = true;
  }

  for (const fileToExtract of parsedFiles) {
    if (userQuitExtraction) {
      results.push({
        path: fileToExtract.path,
        status: "skipped",
        message: "User quit extraction.",
      });
      continue;
    }
    const originalPathFromMarker = fileToExtract.path;
    const sanitizedFinalRelPath = sanitizeRelativePath(originalPathFromMarker);
    const prospectiveAbsOutputPath = path.normalize(
      path.join(realAbsOutputDirBase, sanitizedFinalRelPath)
    );

    // Security check against path traversal
    if (
      !fs
        .realpathSync(path.dirname(prospectiveAbsOutputPath))
        .startsWith(realAbsOutputDirBase) &&
      fs.realpathSync(prospectiveAbsOutputPath) !== realAbsOutputDirBase
    ) {
      // The check needs to ensure the DIR is within base, or if it's a top-level file, that it IS the base (less likely for files)
      // A simpler check for files is: if path.dirname(prospective) starts with realBase, OR prospective itself IS realBase (for a file directly in outputDir)
      // For a file, its realpath must start with parent. For a dir, its realpath must start with parent.
      // path.dirname(prospectiveAbsOutputPath) gets the dir.
      // fs.realpathSync(path.dirname(prospectiveAbsOutputPath)) gets the real dir.
      let dirToTest = path.dirname(prospectiveAbsOutputPath);
      if (!fs.existsSync(dirToTest)) {
        // If dir doesn't exist yet, use prospective path as-is for check basis
        dirToTest = prospectiveAbsOutputPath;
      }
      let isSafe = false;
      try {
        // realpathSync can fail if path doesn't exist, but dirname should point to existing parent or root
        isSafe = fs.realpathSync(dirToTest).startsWith(realAbsOutputDirBase);
        if (
          !isSafe &&
          fs.realpathSync(prospectiveAbsOutputPath) === realAbsOutputDirBase &&
          fs.statSync(prospectiveAbsOutputPath).isFile()
        ) {
          isSafe = true; // File directly in the output dir
        }
      } catch (e) {
        // If realpath fails on dirToTest, it implies a deeper issue or non-existent path segment
        // The most direct check is `prospectiveAbsOutputPath` itself
        isSafe =
          prospectiveAbsOutputPath.startsWith(
            realAbsOutputDirBase + path.sep
          ) || prospectiveAbsOutputPath === realAbsOutputDirBase;
      }

      if (!isSafe) {
        const msg = `Security Alert: Path '${sanitizedFinalRelPath}' (from '${originalPathFromMarker}') resolved to '${prospectiveAbsOutputPath}', potentially outside base '${realAbsOutputDirBase}'. Skipping.`;
        console.error(`  Error: ${msg}`);
        results.push({
          path: originalPathFromMarker,
          status: "error",
          message: msg,
        });
        continue;
      }
    }

    let performActualWrite = true;
    if (fs.existsSync(prospectiveAbsOutputPath)) {
      const stat = await fs.promises.lstat(prospectiveAbsOutputPath);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        const msg = `Path '${sanitizedFinalRelPath}' exists as directory. Cannot overwrite. Skipping.`;
        if (verbose) console.warn(`  Warning: ${msg}`);
        results.push({
          path: originalPathFromMarker,
          status: "error",
          message: msg,
        });
        performActualWrite = false;
      } else if (alwaysYes) {
        if (verbose)
          console.log(
            `  Info: Overwriting '${sanitizedFinalRelPath}' (forced yes).`
          );
      } else if (alwaysNo) {
        if (verbose)
          console.log(
            `  Info: Skipping existing file '${sanitizedFinalRelPath}' (forced no).`
          );
        results.push({
          path: originalPathFromMarker,
          status: "skipped",
          message: "Overwrite (policy: no).",
        });
        performActualWrite = false;
      } else if (promptUser) {
        while (true) {
          const choice = (
            await promptUser(
              `File '${sanitizedFinalRelPath}' exists. Overwrite? [(y)es/(N)o/(a)ll yes/(s)kip all/(q)uit]: `
            )
          )
            .trim()
            .toLowerCase();
          if (choice === "y") break;
          if (choice === "n" || choice === "") {
            performActualWrite = false;
            results.push({
              path: originalPathFromMarker,
              status: "skipped",
              message: "Overwrite (user: no).",
            });
            break;
          }
          if (choice === "a") {
            alwaysYes = true;
            break;
          }
          if (choice === "s") {
            alwaysNo = true;
            performActualWrite = false;
            results.push({
              path: originalPathFromMarker,
              status: "skipped",
              message: "Overwrite (user: skip all).",
            });
            break;
          }
          if (choice === "q") {
            userQuitExtraction = true;
            performActualWrite = false;
            break;
          }
          console.log("Invalid choice. Please enter y, n, a, s, or q.");
        }
      } else {
        performActualWrite = false;
        results.push({
          path: originalPathFromMarker,
          status: "skipped",
          message: "Overwrite (prompt in non-interactive, default no).",
        });
      }
    }
    if (userQuitExtraction && !performActualWrite) {
      if (
        !results.find(
          (r) => r.path === originalPathFromMarker && r.status === "skipped"
        )
      )
        results.push({
          path: originalPathFromMarker,
          status: "skipped",
          message: "User quit extraction.",
        });
      continue;
    }
    if (performActualWrite) {
      try {
        const outputFileDir = path.dirname(prospectiveAbsOutputPath);
        if (!fs.existsSync(outputFileDir))
          await fs.promises.mkdir(outputFileDir, { recursive: true });
        if (
          fs.existsSync(prospectiveAbsOutputPath) &&
          (await fs.promises.lstat(prospectiveAbsOutputPath)).isSymbolicLink()
        ) {
          await fs.promises.unlink(prospectiveAbsOutputPath);
        }
        await fs.promises.writeFile(
          prospectiveAbsOutputPath,
          fileToExtract.contentBytes
        );
        results.push({
          path: originalPathFromMarker,
          status: "extracted",
          message: `Extracted to ${sanitizedFinalRelPath}`,
        });
        if (verbose) console.log(`  Extracted: ${sanitizedFinalRelPath}`);
      } catch (e) {
        const msg = `Error writing file '${sanitizedFinalRelPath}': ${e.message}`;
        console.error(`  Error: ${msg}`);
        results.push({
          path: originalPathFromMarker,
          status: "error",
          message: msg,
        });
      }
    }
  }
  if (rl) rl.close();
  return results;
}

async function extractFromBrowser(bundleContent, options = {}) {
  const {
    inputFormat = "auto",
    targetDirectoryHandle,
    verbose = false,
  } = options;
  const formatOverride = inputFormat === "auto" ? null : inputFormat;
  const { parsedFiles } = parseBundleContent(
    bundleContent,
    formatOverride,
    verbose
  );
  if (!parsedFiles || parsedFiles.length === 0)
    return {
      method: "Error",
      message: "No files found in bundle to extract.",
      filesAttempted: 0,
    };
  const filesAttempted = parsedFiles.length;
  let filesWritten = 0;
  if (typeof window !== "undefined" && window.showDirectoryPicker) {
    try {
      const dirHandle =
        targetDirectoryHandle || (await window.showDirectoryPicker());
      if (dirHandle) {
        for (const file of parsedFiles) {
          const sanitizedPathForBrowser = file.path
            .replace(/\\/g, "/")
            .split("/")
            .map((p) => sanitizePathComponent(p))
            .filter((p) => p)
            .join("/");
          if (!sanitizedPathForBrowser) continue;
          const parts = sanitizedPathForBrowser.split("/");
          let currentHandle = dirHandle;
          for (let i = 0; i < parts.length - 1; i++)
            currentHandle = await currentHandle.getDirectoryHandle(parts[i], {
              create: true,
            });
          const fileHandle = await currentHandle.getFileHandle(
            parts[parts.length - 1],
            { create: true }
          );
          const writable = await fileHandle.createWritable();
          await writable.write(file.contentBytes);
          await writable.close();
          filesWritten++;
        }
        return {
          method: "FileSystemAPI",
          path: dirHandle.name,
          filesAttempted,
          filesWritten,
        };
      }
    } catch (e) {
      if (verbose)
        console.warn(
          "File System Access API failed or was cancelled:",
          e.message
        );
    }
  }
  if (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof URL !== "undefined" &&
    URL.createObjectURL
  ) {
    try {
      let downloadsInitiated = 0;
      for (const file of parsedFiles) {
        const blob = new Blob([file.contentBytes]);
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        const filename = sanitizePathComponent(
          file.path.split(/[\/\\]/).pop() || "downloaded_file"
        );
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        downloadsInitiated++;
      }
      if (downloadsInitiated > 0)
        return {
          method: "Downloads",
          message:
            "Files offered for individual download. Recreate directory structure manually.",
          filesAttempted,
          filesWritten: downloadsInitiated,
        };
    } catch (e) {
      if (verbose) console.warn("Individual file downloads failed:", e.message);
    }
  }
  if (verbose || filesAttempted > 0) {
    console.log("--- Extracted File Contents (Console Fallback) ---");
    parsedFiles.forEach((file) => {
      console.log(`\nFile: ${file.path}`);
      try {
        const textContent = new TextDecoder(DEFAULT_ENCODING, {
          fatal: false,
        }).decode(file.contentBytes);
        console.log("Content (UTF-8 Attempt):\n", textContent);
      } catch (e) {
        console.log(
          "Content (Base64 as fallback for non-UTF-8 display):\n",
          file.contentBytes.toString("base64")
        );
      }
    });
    return {
      method: "Console",
      message: "File details printed to console.",
      filesAttempted,
      filesWritten: 0,
    };
  }
  return {
    method: "Error",
    message: "No extraction method succeeded.",
    filesAttempted,
    filesWritten: 0,
  };
}

function parseCliArgsDogs(argv) {
  const args = {
    bundleFile: null,
    outputDir: ".",
    inputFormat: "auto",
    overwrite: "prompt",
    verbose: false,
    help: false,
  };
  const cliArgs = argv.slice(2);
  let i = 0;
  let positionalCount = 0;
  while (i < cliArgs.length) {
    const arg = cliArgs[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      break;
    } else if (arg === "-i" || arg === "--input-format") {
      if (
        i + 1 < cliArgs.length &&
        !cliArgs[i + 1].startsWith("-") &&
        ["auto", "b64", "utf8"].includes(cliArgs[i + 1].toLowerCase())
      ) {
        args.inputFormat = cliArgs[++i].toLowerCase();
      } else
        throw new Error(
          `Argument ${arg} requires a valid value (auto, b64, utf8).`
        );
    } else if (arg === "-y" || arg === "--yes") args.overwrite = "yes";
    else if (arg === "-n" || arg === "--no") args.overwrite = "no";
    else if (arg === "-v" || arg === "--verbose") args.verbose = true;
    else if (!arg.startsWith("-")) {
      if (positionalCount === 0) args.bundleFile = arg;
      else if (positionalCount === 1) args.outputDir = arg;
      else throw new Error(`Too many positional arguments: ${arg}`);
      positionalCount++;
    } else throw new Error(`Unknown option: ${arg}`);
    i++;
  }
  return args;
}

function printCliHelpDogs() {
  console.log(`dogs.js : Extracts files from a cats.js or LLM-generated (DOGS_) bundle.

Syntax: node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]

Key Options:
  bundle_file             Bundle to extract (default: 'cats_out.bundle' if exists).
  output_directory        Where to extract files (default: current directory './').
  -i {auto|b64|utf8}, --input-format {auto|b64|utf8}
                          Override bundle format: auto (default), b64, or utf8.
  -y, --yes               Overwrite existing files without asking.
  -n, --no                Skip overwriting existing files (default: prompt).
  -v, --verbose           Enable verbose logging for parsing and extraction.
  -h, --help              Show this help message and exit.

Example: node dogs.js my_project.bundle ./extracted_project -y -v`);
}

async function mainCliDogs() {
  try {
    const args = parseCliArgsDogs(process.argv);
    if (args.help) {
      printCliHelpDogs();
      process.exit(0);
    }
    if (args.bundleFile === null) {
      if (fs.existsSync("cats_out.bundle")) {
        args.bundleFile = "cats_out.bundle";
        if (args.verbose)
          console.log(
            "Info: No bundle file specified, defaulting to 'cats_out.bundle'."
          );
      } else {
        console.error(
          "Error: No bundle file specified and default 'cats_out.bundle' not found."
        );
        printCliHelpDogs();
        process.exit(1);
      }
    }
    const absBundlePath = path.resolve(args.bundleFile);
    if (
      !fs.existsSync(absBundlePath) ||
      !(await fs.promises.stat(absBundlePath)).isFile()
    ) {
      console.error(
        `Error: Bundle file not found or is not a file: '${absBundlePath}'`
      );
      process.exit(1);
    }
    let preliminaryFormatDesc = "Parsing...";
    let filesToProcessCount = 0;
    if (args.overwrite === "prompt" && process.stdin.isTTY) {
      const tempContent = await fs.promises.readFile(
        absBundlePath,
        DEFAULT_ENCODING
      );
      const { formatDescription: pd, parsedFiles: pf } = parseBundleContent(
        tempContent,
        args.inputFormat === "auto" ? null : args.inputFormat,
        args.verbose
      );
      preliminaryFormatDesc = pd;
      filesToProcessCount = pf.length;
      console.log("\n--- Bundle Extraction Plan ---");
      console.log(`  Source Bundle:    ${absBundlePath}`);
      console.log(`  Detected Format:  ${preliminaryFormatDesc}`);
      if (args.inputFormat !== "auto")
        console.log(
          `  Format Override:  Will interpret as ${args.inputFormat}`
        );
      console.log(`  Output Directory: ${path.resolve(args.outputDir)}`);
      console.log(
        `  Overwrite Policy: ${args.overwrite.replace(/^\w/, (c) =>
          c.toUpperCase()
        )}`
      );
      console.log(`  Files to be processed: ${filesToProcessCount}`);
      if (args.verbose && filesToProcessCount > 0) {
        console.log("  First few file paths from bundle:");
        pf.slice(0, Math.min(5, pf.length)).forEach((f) =>
          console.log(`    - ${f.path}`)
        );
        if (pf.length > 5) console.log(`    ... and ${pf.length - 5} more.`);
      }
      const rlConfirm = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const proceed = await new Promise((resolve) =>
        rlConfirm.question("\nProceed with extraction? [Y/n]: ", (answer) => {
          rlConfirm.close();
          resolve(answer.trim().toLowerCase());
        })
      );
      if (proceed !== "y" && proceed !== "") {
        console.log("Extraction cancelled by user.");
        process.exit(0);
      }
    } else if (args.verbose) {
      const tempContent = await fs.promises.readFile(
        absBundlePath,
        DEFAULT_ENCODING
      );
      const { formatDescription: pd, parsedFiles: pf } = parseBundleContent(
        tempContent,
        args.inputFormat === "auto" ? null : args.inputFormat,
        args.verbose
      );
      console.log("\n--- Extraction Details ---");
      console.log(`  Source: ${absBundlePath}, Format: ${pd}`);
      if (args.inputFormat !== "auto")
        console.log(`  Format Override: ${args.inputFormat}`);
      console.log(
        `  Output: ${path.resolve(args.outputDir)}, Overwrite: ${
          args.overwrite
        }`
      );
      console.log(`  Files to process: ${pf.length}`);
    }
    console.log("\nStarting extraction process...");
    const extractionResults = await extractToDiskNode({
      bundleFilePath: absBundlePath,
      outputDir: args.outputDir,
      overwritePolicy: args.overwrite,
      inputFormat: args.inputFormat,
      verbose: args.verbose,
    });
    const extractedCount = extractionResults.filter(
      (r) => r.status === "extracted"
    ).length;
    const skippedCount = extractionResults.filter(
      (r) => r.status === "skipped"
    ).length;
    const errorCount = extractionResults.filter(
      (r) => r.status === "error"
    ).length;
    console.log(`\n--- Extraction Summary ---`);
    console.log(`  Files Extracted: ${extractedCount}`);
    if (skippedCount > 0) console.log(`  Files Skipped:   ${skippedCount}`);
    if (errorCount > 0) console.log(`  Errors:          ${errorCount}`);
    if (extractionResults.length === 0 && filesToProcessCount === 0)
      console.log(
        "  No file content was found or parsed in the bundle to attempt extraction."
      );
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    if (
      error.message.includes("Too many positional") ||
      error.message.includes("Unknown option") ||
      error.message.includes("requires a value")
    )
      printCliHelpDogs();
    process.exit(1);
  }
}

module.exports = { extractToMemory, extractToDiskNode, extractFromBrowser };
if (require.main === module) {
  mainCliDogs();
}
