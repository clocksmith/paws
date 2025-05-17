#!/usr/bin/env node
// dogs.js - Extracts files from a cats.js or LLM-generated (DOGS_) bundle.
const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");
const readline = require("readline");

const DEFAULT_ENCODING = "utf-8";
const DEFAULT_INPUT_BUNDLE_FILENAME = "dogs_in.bundle"; // Changed default

const CATS_BUNDLE_HEADER_PREFIX = "# Cats Bundle";
const DOGS_BUNDLE_HEADER_PREFIX = "# Dogs Bundle";
const BUNDLE_FORMAT_PREFIX = "# Format: ";

// Regex with Emoji
const CATS_FILE_START_MARKER_REGEX = /^\s*🐈\s*-{3,}\s*CATS_START_FILE\s*:\s*(.+?)\s*-{3,}$/i;
const CATS_FILE_END_MARKER_REGEX = /^\s*🐈\s*-{3,}\s*CATS_END_FILE\s*-{3,}$/i;
const DOGS_FILE_START_MARKER_REGEX = /^\s*🐕\s*-{3,}\s*DOGS_START_FILE\s*:\s*(.+?)\s*-{3,}$/i;
const DOGS_FILE_END_MARKER_REGEX = /^\s*🐕\s*-{3,}\s*DOGS_END_FILE\s*-{3,}$/i;

// Delta Command Regex (simpler parsing in JS)
const PAWS_CMD_REGEX = /^\s*@@\s*PAWS_CMD\s*(.+?)\s*@@\s*$/;
const REPLACE_LINES_REGEX = /REPLACE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)/i;
const INSERT_AFTER_LINE_REGEX = /INSERT_AFTER_LINE\(\s*(\d+)\s*\)/i;
const DELETE_LINES_REGEX = /DELETE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)/i;


/**
 * Basic sanitization for a single filename or directory name component.
 */
function sanitizePathComponent(comp) {
  if (!comp || comp === "." || comp === "..") return "_sanitized_dots_";
  let sanitized = comp.replace(/[^\w.\-_~ ]/g, "_");
  sanitized = sanitized.replace(/\s+/g, "_");
  sanitized = sanitized.replace(/_+/g, "_");
  sanitized = sanitized.replace(/^[._]+|[._]+$/g, "");
  return sanitized || "sanitized_empty_comp";
}

/**
 * Sanitizes a relative path from the bundle, ensuring components are safe.
 */
function sanitizeRelativePath(relPathFromBundle) {
  const normalizedPath = relPathFromBundle.replace(/\\/g, "/");
  const parts = normalizedPath.split("/");
  const sanitizedParts = parts.map(p => sanitizePathComponent(p)).filter(p => p && p !== "." && p !== "..");
  if (sanitizedParts.length === 0) {
    return sanitizePathComponent(path.basename(relPathFromBundle)) || "unnamed_file_from_bundle";
  }
  return path.join(...sanitizedParts);
}

/**
 * @typedef {Object} ParsedFileFromBundle
 * @property {string} path_in_bundle - Relative path from bundle marker.
 * @property {Buffer|null} contentBytes - Decoded file content as Buffer (null if delta).
 * @property {Array<Object>|null} deltaCommands - Parsed delta commands (null if full content).
 * @property {string} formatUsedForDecode - 'b64', 'utf8', 'utf16le', or 'delta'.
 * @property {boolean} hasDeltaCommands - True if delta commands were found.
 */
/**
 * @typedef {Object} DeltaCommand
 * @property {string} type - 'replace', 'insert', 'delete'.
 * @property {number} [start] - 1-based start line (for replace/delete).
 * @property {number} [end] - 1-based end line (for replace/delete).
 * @property {number} [lineNum] - 1-based line number (for insert).
 * @property {string[]} [contentLines] - Lines for replace/insert.
 */


/**
 * Parses the bundle string into file objects or delta commands.
 * Prioritizes DOGS_ markers, then CATS_. Does not do heuristic LLM parsing.
 * @param {string} bundleContent - The entire bundle string.
 * @param {string|null} forcedFormatOverride - 'b64', 'utf8', 'utf16le', or null for auto.
 * @param {boolean} applyDelta - Whether to parse for delta commands.
 * @param {boolean} [verbose=false] - Enable verbose logging.
 * @returns {{parsedFiles: ParsedFileFromBundle[], formatDescription: string, effectiveEncoding: string}}
 */
function parseBundleContent(
  bundleContent,
  forcedFormatOverride = null,
  applyDelta = false,
  verbose = false
) {
  const lines = bundleContent.split(/\r?\n/);
  const parsedFiles = [];
  let bundleFormatIsB64 = null;
  let bundleFormatEncoding = 'utf8'; // Default node encoding name
  let formatDescription = "Unknown (Header not found or not recognized)";
  let headerLinesConsumed = 0;
  const possibleHeaders = [
    { prefix: DOGS_BUNDLE_HEADER_PREFIX, desc: "Dogs Bundle (LLM Output)" },
    { prefix: CATS_BUNDLE_HEADER_PREFIX, desc: "Cats Bundle (Original Source)" },
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
      const tempFormatDesc = lineTextTrimmed.substring(BUNDLE_FORMAT_PREFIX.length).trim();
      formatDescription = `${headerTypeFound} - Format: ${tempFormatDesc}`;
      const fmtLower = tempFormatDesc.toLowerCase();
      if (fmtLower.includes("base64")) {
        bundleFormatIsB64 = true; bundleFormatEncoding = 'base64'; // Node uses 'base64'
      } else if (fmtLower.includes("utf-16le") || fmtLower.includes("utf-16 le")) {
        bundleFormatIsB64 = false; bundleFormatEncoding = 'utf16le';
      } else if (fmtLower.includes("utf-8")) {
        bundleFormatIsB64 = false; bundleFormatEncoding = 'utf8';
      } else {
        bundleFormatIsB64 = false; bundleFormatEncoding = 'utf8';
        formatDescription += ` (Unrecognized format details, defaulting to Raw UTF-8)`;
        if (verbose) console.warn(`  Warning: Unrecognized format details: '${tempFormatDesc}'. Defaulting to UTF-8.`);
      }
      break;
    }
  }

  if (forcedFormatOverride) {
      const overrideLower = forcedFormatOverride.toLowerCase();
      if (overrideLower === 'b64') { bundleFormatIsB64 = true; bundleFormatEncoding = 'base64'; formatDescription = `${headerTypeFound || 'Bundle'} - Format: Base64 (Overridden)`; }
      else if (overrideLower === 'utf16le') { bundleFormatIsB64 = false; bundleFormatEncoding = 'utf16le'; formatDescription = `${headerTypeFound || 'Bundle'} - Format: Raw UTF-16LE (Overridden)`; }
      else if (overrideLower === 'utf8') { bundleFormatIsB64 = false; bundleFormatEncoding = 'utf8'; formatDescription = `${headerTypeFound || 'Bundle'} - Format: Raw UTF-8 (Overridden)`; }
  }

  if (bundleFormatIsB64 === null) {
    bundleFormatIsB64 = false; bundleFormatEncoding = 'utf8';
    formatDescription = `Raw UTF-8 (Assumed, no valid header found)`;
    if (verbose) console.warn(`  Warning: ${formatDescription}`);
  }
  const effectiveEncoding = bundleFormatIsB64 ? 'base64' : bundleFormatEncoding;

  let currentFileRelativePathFromMarker = null;
  let contentBufferLines = [];
  let currentDeltaCommands = [];
  let hasDeltaCommandsInBlock = false;

  for (let lineNum = headerLinesConsumed; lineNum < lines.length; lineNum++) {
    const lineText = lines[lineNum];
    const strippedLine = lineText.trim();
    let startMatch = DOGS_FILE_START_MARKER_REGEX.exec(strippedLine) || CATS_FILE_START_MARKER_REGEX.exec(strippedLine);
    let endMatch = DOGS_FILE_END_MARKER_REGEX.test(strippedLine) || CATS_FILE_END_MARKER_REGEX.test(strippedLine);

    if (startMatch) {
      if (currentFileRelativePathFromMarker && verbose) {
        console.warn(`  Warning (L${lineNum + 1}): New file started before '${currentFileRelativePathFromMarker}' ended. Previous block discarded.`);
      }
      currentFileRelativePathFromMarker = startMatch[1].trim();
      contentBufferLines = [];
      currentDeltaCommands = [];
      hasDeltaCommandsInBlock = false;
      if (verbose) console.log(`  Debug (L${lineNum + 1}): Matched START marker for '${currentFileRelativePathFromMarker}'`);
      continue;
    }

    if (endMatch && currentFileRelativePathFromMarker) {
       let fileContentBytes = null;
       let deltaCmds = null;
       let finalFormat = effectiveEncoding;

       if (applyDelta && hasDeltaCommandsInBlock) {
           if (currentDeltaCommands.length > 0 && currentDeltaCommands[currentDeltaCommands.length - 1].type !== 'delete') {
                currentDeltaCommands[currentDeltaCommands.length - 1].contentLines = [...contentBufferLines];
           }
           deltaCmds = currentDeltaCommands;
           finalFormat = 'delta';
       } else {
           const rawContentStr = contentBufferLines.join("\n");
           try {
               fileContentBytes = Buffer.from(rawContentStr, effectiveEncoding === 'base64' ? 'base64' : (effectiveEncoding === 'utf16le' ? 'utf16le' : 'utf8'));
           } catch (e) {
               console.warn(`  Error (L${lineNum + 1}): Failed to decode content for '${currentFileRelativePathFromMarker}' (format: ${effectiveEncoding}). Skipping. Error: ${e.message}`);
               currentFileRelativePathFromMarker = null; contentBufferLines = []; currentDeltaCommands = []; hasDeltaCommandsInBlock = false;
               continue; // Skip this file
           }
       }

        parsedFiles.push({
          path_in_bundle: currentFileRelativePathFromMarker,
          contentBytes: fileContentBytes,
          deltaCommands: deltaCmds,
          formatUsedForDecode: finalFormat,
          hasDeltaCommands: hasDeltaCommandsInBlock,
        });

      if (verbose) console.log(`  Debug (L${lineNum + 1}): Matched END marker for '${currentFileRelativePathFromMarker}', decoded as ${finalFormat}.`);
      currentFileRelativePathFromMarker = null; contentBufferLines = []; currentDeltaCommands = []; hasDeltaCommandsInBlock = false;
      continue;
    }

    // Delta Command Parsing (only if in a block and delta mode is on)
    if (currentFileRelativePathFromMarker && applyDelta) {
         const pawsCmdMatch = lineText.match(PAWS_CMD_REGEX);
         if (pawsCmdMatch) {
              const commandStr = pawsCmdMatch[1].trim();
              let deltaCmd = null;
              let replaceMatch = commandStr.match(REPLACE_LINES_REGEX);
              let insertMatch = commandStr.match(INSERT_AFTER_LINE_REGEX);
              let deleteMatch = commandStr.match(DELETE_LINES_REGEX);

              // Finalize previous command content
              if (currentDeltaCommands.length > 0 && currentDeltaCommands[currentDeltaCommands.length - 1].type !== 'delete') {
                  currentDeltaCommands[currentDeltaCommands.length - 1].contentLines = [...contentBufferLines];
              }
              contentBufferLines = []; // Reset for next command

              if (replaceMatch) deltaCmd = { type: 'replace', start: parseInt(replaceMatch[1], 10), end: parseInt(replaceMatch[2], 10) };
              else if (insertMatch) deltaCmd = { type: 'insert', lineNum: parseInt(insertMatch[1], 10) };
              else if (deleteMatch) deltaCmd = { type: 'delete', start: parseInt(deleteMatch[1], 10), end: parseInt(deleteMatch[2], 10) };

              if (deltaCmd) {
                   if (verbose) console.log(`  Debug (L${lineNum + 1}): Parsed PAWS_CMD: ${deltaCmd.type}`);
                   currentDeltaCommands.push(deltaCmd);
                   hasDeltaCommandsInBlock = true;
              } else {
                   if (verbose) console.warn(`  Warning (L${lineNum + 1}): Unrecognized PAWS_CMD format: '${commandStr}'. Treating line as content.`);
                   contentBufferLines.push(lineText); // Treat as content if unrecognized
              }
              continue; // Skip command line itself
         }
    }

    // If not a start/end/command line, and inside a block, add to buffer
    if (currentFileRelativePathFromMarker !== null) {
      contentBufferLines.push(lineText);
    }
  } // End line loop

  if (currentFileRelativePathFromMarker) {
    console.warn(`  Warning: Bundle ended before file '${currentFileRelativePathFromMarker}' was closed by an END marker. Block discarded.`);
  }
  return { parsedFiles, formatDescription, effectiveEncoding };
}

/**
 * Parses the original bundle into memory { path: lines[] }
 * @param {string} originalBundlePath
 * @param {boolean} verbose
 * @returns {Promise<Object<string, string[]>>}
 */
async function parseOriginalBundleForDeltaNode(originalBundlePath, verbose = false) {
    const originalFiles = {};
    let originalContent = "";
    try {
        originalContent = await fs.promises.readFile(originalBundlePath, DEFAULT_ENCODING);
    } catch (e) {
        console.error(`  Error: Could not read original bundle '${originalBundlePath}' for delta: ${e.message}`);
        return {};
    }

    const lines = originalContent.split(/\r?\n/);
    let currentFile = null;
    let currentLines = [];
    for (const line of lines) {
        const startMatch = line.trim().match(CATS_FILE_START_MARKER_REGEX); // Only CATS
        const endMatch = line.trim().match(CATS_FILE_END_MARKER_REGEX);
        if (startMatch) {
            if (currentFile) originalFiles[currentFile] = currentLines; // Store previous
            currentFile = startMatch[1].trim();
            currentLines = [];
        } else if (endMatch && currentFile) {
            originalFiles[currentFile] = currentLines;
            if (verbose) console.log(`  Debug (Original Parse): Loaded ${currentLines.length} lines for '${currentFile}'`);
            currentFile = null;
            currentLines = [];
        } else if (currentFile !== null) {
            currentLines.push(line);
        }
    }
    if (currentFile) originalFiles[currentFile] = currentLines; // EOF case
    return originalFiles;
}

/**
 * Applies delta commands to original lines.
 * @param {string[]} originalLines
 * @param {DeltaCommand[]} deltaCommands
 * @param {string} filePathForLog
 * @returns {string[]} New lines array.
 */
function applyDeltaCommandsNode(originalLines, deltaCommands, filePathForLog) {
    let newLines = [...originalLines];
    let offset = 0;

    for (const cmd of deltaCommands) {
        try {
             const type = cmd.type;
             if (type === 'replace') {
                 const start = cmd.start; const end = cmd.end;
                 if (start <= 0 || end < start) throw new Error("Invalid line numbers");
                 const start0 = start - 1; const end0 = end - 1;
                 const adjStart = start0 + offset; const adjEnd = end0 + offset;
                 if (adjStart < 0 || adjEnd >= newLines.length) throw new Error("Line numbers out of bounds");
                 const deleteCount = adjEnd - adjStart + 1;
                 const insertContent = cmd.contentLines || [];
                 newLines.splice(adjStart, deleteCount, ...insertContent);
                 offset += insertContent.length - deleteCount;
             } else if (type === 'insert') {
                  const lineNum = cmd.lineNum;
                  if (lineNum < 0) throw new Error("Invalid line number");
                  const insertIdx0 = (lineNum === 0) ? 0 : lineNum; // Insert at 0 for lineNum=0, else after lineNum (at index lineNum)
                  const adjInsertIdx = insertIdx0 + offset;
                   if (adjInsertIdx < 0 || adjInsertIdx > newLines.length) throw new Error("Line number out of bounds");
                  const insertContent = cmd.contentLines || [];
                  newLines.splice(adjInsertIdx, 0, ...insertContent);
                  offset += insertContent.length;
             } else if (type === 'delete') {
                  const start = cmd.start; const end = cmd.end;
                  if (start <= 0 || end < start) throw new Error("Invalid line numbers");
                  const start0 = start - 1; const end0 = end - 1;
                  const adjStart = start0 + offset; const adjEnd = end0 + offset;
                  if (adjStart < 0 || adjEnd >= newLines.length) throw new Error("Line numbers out of bounds");
                  const deleteCount = adjEnd - adjStart + 1;
                  newLines.splice(adjStart, deleteCount);
                  offset -= deleteCount;
             }
        } catch (e) {
             console.warn(`  Error applying delta command ${JSON.stringify(cmd)} to '${filePathForLog}': ${e.message}. Skipping command.`);
        }
    }
    return newLines;
}


/**
 * Extracts bundle content to memory. Does not apply deltas.
 * @param {Object} options
 * @param {string} [options.bundleFilePath]
 * @param {string} [options.bundleFileContent]
 * @param {string} [options.inputFormat='auto'] - 'auto', 'b64', 'utf8', 'utf16le'.
 * @param {boolean} [options.verbose=false]
 * @returns {Promise<ParsedFileFromBundle[]>} - Array includes full content bytes.
 */
async function extractToMemory({
    bundleFilePath,
    bundleFileContent,
    inputFormat = 'auto',
    verbose = false,
}) {
    let contentStr = bundleFileContent;
    if (!contentStr && bundleFilePath) {
        try { contentStr = await fs.promises.readFile(path.resolve(bundleFilePath), DEFAULT_ENCODING); }
        catch (e) { console.error(`Error reading bundle file '${bundleFilePath}': ${e.message}`); return []; }
    }
    if (!contentStr && contentStr !== "") { console.error("No bundle content provided."); return []; }

    const formatOverride = inputFormat === "auto" ? null : inputFormat;
    const { parsedFiles } = parseBundleContent(contentStr, formatOverride, false, verbose); // Force applyDelta=false
    // Filter out delta-only results if any snuck through (shouldn't with applyDelta=false)
    return parsed_files.filter(f => f.contentBytes !== null);
}


/**
 * Extracts bundle to disk, handles deltas.
 * @param {Object} options
 * @param {string} [options.bundleFilePath]
 * @param {string} [options.bundleFileContent]
 * @param {string} options.outputDir
 * @param {string} [options.overwritePolicy='prompt'] - 'yes', 'no', 'prompt'.
 * @param {string|null} [options.applyDeltaFromOriginalBundlePath=null] - Path to original bundle.
 * @param {string} [options.inputFormat='auto'] - 'auto', 'b64', 'utf8', 'utf16le'.
 * @param {boolean} [options.verbose=false]
 * @returns {Promise<Array<{path: string, status: string, message: string}>>}
 */
async function extractToDiskNode({
  bundleFilePath,
  bundleFileContent,
  outputDir,
  overwritePolicy = "prompt",
  applyDeltaFromOriginalBundlePath = null,
  inputFormat = "auto",
  verbose = false,
}) {
  const results = [];
  const absOutputDirBase = path.resolve(outputDir);
  let originalBundleFiles = null;

  if (applyDeltaFromOriginalBundlePath) {
      originalBundleFiles = await parseOriginalBundleForDeltaNode(applyDeltaFromOriginalBundlePath, verbose);
      if (Object.keys(originalBundleFiles).length === 0) {
          console.warn(`  Warning: Delta application requested, but failed to load/parse original bundle '${applyDeltaFromOriginalBundlePath}'. Delta commands cannot be applied.`);
          applyDeltaFromOriginalBundlePath = null; // Disable delta if original failed
      }
  }

  if (!fs.existsSync(absOutputDirBase)) {
    try { await fs.promises.mkdir(absOutputDirBase, { recursive: true }); if (verbose) console.log(`  Info: Created output directory '${absOutputDirBase}'.`); }
    catch (e) { const msg = `Error creating output directory '${absOutputDirBase}': ${e.message}`; console.error(msg); return [{ path: outputDir, status: "error", message: msg }]; }
  } else if (!(await fs.promises.stat(absOutputDirBase)).isDirectory()) {
    const msg = `Error: Output path '${absOutputDirBase}' exists but is not a directory.`; console.error(msg); return [{ path: outputDir, status: "error", message: msg }];
  }
  const realAbsOutputDirBase = fs.realpathSync(absOutputDirBase);

  let contentStr = bundleFileContent;
  if (!contentStr && bundleFilePath) {
    try { contentStr = await fs.promises.readFile(path.resolve(bundleFilePath), DEFAULT_ENCODING); }
    catch (e) { const msg = `Error reading bundle file '${bundleFilePath}': ${e.message}`; console.error(msg); return [{ path: bundleFilePath, status: "error", message: msg }]; }
  }
  if (!contentStr && contentStr !== "") { return [{ path: "bundle", status: "error", message: "No bundle content provided." }]; }

  const formatOverride = inputFormat === "auto" ? null : inputFormat;
  const { parsedFiles, formatDescription, effectiveEncoding } = parseBundleContent(
    contentStr, formatOverride, !!applyDeltaFromOriginalBundlePath, verbose
  );
  if (verbose) console.log(`  Info: Bundle parsed. Format: ${formatDescription}. Files: ${parsedFiles.length}.`);
  if (parsedFiles.length === 0) return results;

  let alwaysYes = overwritePolicy === "yes";
  let alwaysNo = overwritePolicy === "no";
  let userQuitExtraction = false;
  const rl = (overwritePolicy === "prompt" && process.stdin.isTTY) ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
  const promptUser = rl ? (query) => new Promise(resolve => rl.question(query, resolve)) : null;
  if (overwritePolicy === "prompt" && !process.stdin.isTTY) { if (verbose) console.log("Info: Non-interactive, 'prompt' defaults to 'no'."); alwaysNo = true; }


  for (const fileToExtract of parsedFiles) {
    if (userQuitExtraction) { results.push({ path: fileToExtract.path_in_bundle, status: "skipped", message: "User quit extraction." }); continue; }

    const originalPathFromMarker = fileToExtract.path_in_bundle;
    const sanitizedFinalRelPath = sanitizeRelativePath(originalPathFromMarker);
    const prospectiveAbsOutputPath = path.normalize(path.join(realAbsOutputDirBase, sanitizedFinalRelPath));

    // Security check
    try {
        const prospectiveDir = path.dirname(prospectiveAbsOutputPath);
        if (!fs.existsSync(prospectiveDir)) {
             // Check parent chain if intermediate dirs needed
             let checkDir = prospectiveDir;
             while (!fs.existsSync(checkDir) && checkDir !== path.dirname(checkDir)) {
                  checkDir = path.dirname(checkDir);
             }
             if (!fs.realpathSync(checkDir).startsWith(realAbsOutputDirBase)) throw new Error("Path traversal attempt");
        } else {
             if (!fs.realpathSync(prospectiveDir).startsWith(realAbsOutputDirBase)) throw new Error("Path traversal attempt");
        }
     } catch (e) {
         const msg = `Security Alert: Path '${sanitizedFinalRelPath}' (from '${originalPathFromMarker}') resolved outside base '${realAbsOutputDirBase}'. Skipping.`;
         console.error(`  Error: ${msg}`); results.push({ path: originalPathFromMarker, status: "error", message: msg }); continue;
     }


    let performActualWrite = true;
    let fileContentToWrite = null;

    // Determine content: apply delta or use full bytes
     if (applyDeltaFromOriginalBundlePath && fileToExtract.hasDeltaCommands && originalBundleFiles) {
          const originalFileLines = originalBundleFiles[originalPathFromMarker];
          if (originalFileLines) {
               if (verbose) console.log(`  Info: Applying delta for ${originalPathFromMarker}`);
               const newLines = applyDeltaCommandsNode(originalFileLines, fileToExtract.deltaCommands || [], originalPathFromMarker);
               // Encode using bundle's text format (assume text for delta files)
               const encoding = (effectiveEncoding === 'b64' || effectiveEncoding === 'delta') ? 'utf8' : effectiveEncoding; // Default to utf8 if delta format
                try {
                    fileContentToWrite = Buffer.from(newLines.join('\n'), encoding);
                } catch (encErr) {
                     const msg = `Failed to encode delta result for '${originalPathFromMarker}' using ${encoding}: ${encErr.message}`;
                     console.error(`  Error: ${msg}`); results.push({ path: originalPathFromMarker, status: "error", message: msg }); performActualWrite = false;
                }
          } else {
               const msg = `Delta commands for '${originalPathFromMarker}' but file not in original bundle. Cannot apply.`;
               console.error(`  Error: ${msg}`); results.push({ path: originalPathFromMarker, status: "error", message: msg }); performActualWrite = false;
          }
     } else {
          fileContentToWrite = fileToExtract.contentBytes; // Use full content
           if (fileContentToWrite === null) { // If delta was expected but couldn't be applied, this might be null
                if (!results.some(r => r.path === originalPathFromMarker && r.status === 'error')) { // Check if error already logged
                     const msg = `No content available for '${originalPathFromMarker}' (possibly failed delta operation). Write skipped.`;
                     console.warn(`  Warning: ${msg}`); results.push({ path: originalPathFromMarker, status: "skipped", message: msg });
                }
                performActualWrite = false;
           }
     }


    // Overwrite check
    if (performActualWrite && fileContentToWrite !== null) {
        if (fs.existsSync(prospectiveAbsOutputPath)) {
            const stat = await fs.promises.lstat(prospectiveAbsOutputPath);
            if (stat.isDirectory() && !stat.isSymbolicLink()) {
                const msg = `Path '${sanitizedFinalRelPath}' exists as directory. Cannot overwrite. Skipping.`;
                if (verbose) console.warn(`  Warning: ${msg}`); results.push({ path: originalPathFromMarker, status: "error", message: msg }); performActualWrite = false;
            } else if (alwaysYes) { if (verbose) console.log(`  Info: Overwriting '${sanitizedFinalRelPath}' (forced yes).`); }
            else if (alwaysNo) { if (verbose) console.log(`  Info: Skipping existing file '${sanitizedFinalRelPath}' (forced no).`); results.push({ path: originalPathFromMarker, status: "skipped", message: "Overwrite (policy: no)." }); performActualWrite = false; }
            else if (promptUser) {
                while (true) {
                    const choice = (await promptUser(`File '${sanitizedFinalRelPath}' exists. Overwrite? [(y)es/(N)o/(a)ll yes/(s)kip all/(q)uit]: `)).trim().toLowerCase();
                    if (choice === 'y') break;
                    if (choice === 'n' || choice === '') { performActualWrite = false; results.push({ path: originalPathFromMarker, status: "skipped", message: "Overwrite (user: no)." }); break; }
                    if (choice === 'a') { alwaysYes = true; break; }
                    if (choice === 's') { alwaysNo = true; performActualWrite = false; results.push({ path: originalPathFromMarker, status: "skipped", message: "Overwrite (user: skip all)." }); break; }
                    if (choice === 'q') { userQuitExtraction = true; performActualWrite = false; break; }
                    console.log("Invalid choice.");
                }
            } else { /* Should be covered by alwaysNo in non-interactive */ performActualWrite = false; results.push({ path: originalPathFromMarker, status: "skipped", message: "Overwrite (prompt default no)." }); }
        }
    }

    if (userQuitExtraction && !performActualWrite) { if (!results.find(r => r.path === originalPathFromMarker && r.status === "skipped")) results.push({ path: originalPathFromMarker, status: "skipped", message: "User quit extraction." }); continue; }

    // Write file
    if (performActualWrite && fileContentToWrite !== null) {
      try {
        const outputFileDir = path.dirname(prospectiveAbsOutputPath);
        if (!fs.existsSync(outputFileDir)) await fs.promises.mkdir(outputFileDir, { recursive: true });
        if (fs.existsSync(prospectiveAbsOutputPath) && (await fs.promises.lstat(prospectiveAbsOutputPath)).isSymbolicLink()) {
             await fs.promises.unlink(prospectiveAbsOutputPath);
        }
        await fs.promises.writeFile(prospectiveAbsOutputPath, fileContentToWrite);
        results.push({ path: originalPathFromMarker, status: "extracted", message: `Extracted to ${sanitizedFinalRelPath}` });
        if (verbose) console.log(`  Extracted: ${sanitizedFinalRelPath}`);
      } catch (e) {
        const msg = `Error writing file '${sanitizedFinalRelPath}': ${e.message}`; console.error(`  Error: ${msg}`); results.push({ path: originalPathFromMarker, status: "error", message: msg });
      }
    } else if (performActualWrite && fileContentToWrite === null) {
         // Write skipped because content was null (e.g., delta failed)
          if (!results.some(r => r.path === originalPathFromMarker && r.status === 'error')) { // Avoid duplicate error
                results.push({"path": originalPathFromMarker, "status": "error", "message": "Content generation failed (e.g., delta error), write skipped."});
           }
    }
  } // End file loop

  if (rl) rl.close();
  return results;
}


// Browser functions omitted for brevity as they weren't part of the update focus

function parseCliArgsDogs(argv) {
  const args = {
    bundleFile: null,
    outputDir: ".",
    applyDelta: null, // Path to original bundle
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
    if (arg === "-h" || arg === "--help") { args.help = true; break; }
    else if (arg === "-d" || arg === "--apply-delta") {
      if (i + 1 < cliArgs.length && !cliArgs[i + 1].startsWith("-")) args.applyDelta = cliArgs[++i];
      else throw new Error(`Argument ${arg} requires the path to the original bundle.`);
    }
    else if (arg === "-i" || arg === "--input-format") {
      if (i + 1 < cliArgs.length && !cliArgs[i + 1].startsWith("-") && ["auto", "b64", "utf8", "utf16le"].includes(cliArgs[i + 1].toLowerCase())) args.inputFormat = cliArgs[++i].toLowerCase();
      else throw new Error(`Argument ${arg} requires a valid value (auto, b64, utf8, utf16le).`);
    }
    else if (arg === "-y" || arg === "--yes") args.overwrite = "yes";
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
  console.log(`dogs.js : Extracts files from bundle, optionally applying deltas.

Syntax: node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]

Arguments:
  BUNDLE_FILE             Bundle to extract (default: '${DEFAULT_INPUT_BUNDLE_FILENAME}' if exists).
  OUTPUT_DIR              Where to extract files (default: './').

Options:
  -d, --apply-delta ORIGINAL_BUNDLE Path to original bundle (e.g., cats_out.bundle) to apply delta commands against.
  -i {auto|b64|utf8|utf16le}, --input-format MODE
                          Override bundle format detection (default: auto).
  -y, --yes               Overwrite existing files without asking.
  -n, --no                Skip overwriting existing files (default: prompt).
  -v, --verbose           Enable verbose logging.
  -h, --help              Show this help message and exit.

Example (Delta): node dogs.js llm_deltas.bundle ./out -y -d project_orig.bundle
Example (Full): node dogs.js llm_full.bundle ./out -y`);
}

async function mainCliDogs() {
  try {
    const args = parseCliArgsDogs(process.argv);
    if (args.help) { printCliHelpDogs(); process.exit(0); }

    if (args.bundleFile === null) {
      if (fs.existsSync(DEFAULT_INPUT_BUNDLE_FILENAME)) {
        args.bundleFile = DEFAULT_INPUT_BUNDLE_FILENAME;
        if (args.verbose) console.log(`Info: Defaulting to bundle file '${DEFAULT_INPUT_BUNDLE_FILENAME}'.`);
      } else { console.error(`Error: No bundle file specified and default '${DEFAULT_INPUT_BUNDLE_FILENAME}' not found.`); printCliHelpDogs(); process.exit(1); }
    }
    const absBundlePath = path.resolve(args.bundleFile);
    if (!fs.existsSync(absBundlePath) || !(await fs.promises.stat(absBundlePath)).isFile()) { console.error(`Error: Bundle file not found: '${absBundlePath}'`); process.exit(1); }

    let absOriginalBundlePath = null;
    if (args.applyDelta) {
         absOriginalBundlePath = path.resolve(args.applyDelta);
          if (!fs.existsSync(absOriginalBundlePath) || !(await fs.promises.stat(absOriginalBundlePath)).isFile()) { console.error(`Error: Original bundle file for delta not found: '${absOriginalBundlePath}'`); process.exit(1); }
    }

    let effectiveOverwritePolicy = args.overwrite;
    if (args.overwrite === "prompt" && !process.stdin.isTTY) {
      if (args.verbose) console.log("Info: Non-interactive, 'prompt' defaults to 'no'.");
      effectiveOverwritePolicy = "no";
    }

    // Preliminary parse for confirmation prompt
     let numFilesPrelim = 0; let numDeltaFilesPrelim = 0; let prelimFormatDesc = "Parsing...";
     try {
         const tempContent = await fs.promises.readFile(absBundlePath, DEFAULT_ENCODING);
         const { parsedFiles: pf, formatDescription: pd } = parseBundleContent(tempContent, args.inputFormat === "auto" ? null : args.inputFormat, !!absOriginalBundlePath, false);
         numFilesPrelim = pf.length;
         numDeltaFilesPrelim = pf.filter(f => f.hasDeltaCommands).length;
         prelimFormatDesc = pd;
     } catch (e) { /* Ignore read error here, main extract call will handle */ }


    if (args.overwrite === "prompt" && process.stdin.isTTY) {
       console.log("\n--- Bundle Extraction Plan ---");
       console.log(`  Source Bundle:    ${absBundlePath}`);
       if(absOriginalBundlePath) console.log(`  Original Bundle:  ${absOriginalBundlePath} (for Delta)`);
       console.log(`  Detected Format:  ${prelimFormatDesc}`);
       if (args.inputFormat !== 'auto') console.log(`  Format Override:  Will interpret as ${args.inputFormat}`);
       console.log(`  Output Directory: ${path.resolve(args.outputDir)}`);
       console.log(`  Overwrite Policy: ${args.overwrite.replace(/^\w/, c => c.toUpperCase())}`);
       console.log(`  Files to process: ${numFilesPrelim}` + (numDeltaFilesPrelim > 0 ? ` (${numDeltaFilesPrelim} with delta commands)` : ""));

      const rlConfirm = readline.createInterface({ input: process.stdin, output: process.stdout });
      const proceed = await new Promise(resolve => rlConfirm.question("\nProceed with extraction? [Y/n]: ", answer => { rlConfirm.close(); resolve(answer.trim().toLowerCase()); }));
      if (proceed !== 'y' && proceed !== '') { console.log("Extraction cancelled."); process.exit(0); }
    } else if (args.verbose) {
         console.log("\n--- Extraction Details ---");
         console.log(`  Source: ${absBundlePath}`+ (absOriginalBundlePath ? `, Original: ${absOriginalBundlePath}` : ""));
         console.log(`  Format: ${prelimFormatDesc}` + (args.inputFormat !== 'auto' ? `, Override: ${args.inputFormat}` : ""));
         console.log(`  Output: ${path.resolve(args.outputDir)}, Overwrite: ${effectiveOverwritePolicy}`);
         console.log(`  Files to process: ${numFilesPrelim}`+ (numDeltaFilesPrelim > 0 ? ` (${numDeltaFilesPrelim} delta)` : ""));
    }


    console.log("\nStarting extraction process...");
    const extractionResults = await extractToDiskNode({
      bundleFilePath: absBundlePath,
      outputDir: args.outputDir,
      overwritePolicy: effectiveOverwritePolicy,
      applyDeltaFromOriginalBundlePath: absOriginalBundlePath,
      inputFormat: args.inputFormat,
      verbose: args.verbose,
    });

    const extractedCount = extractionResults.filter(r => r.status === "extracted").length;
    const skippedCount = extractionResults.filter(r => r.status === "skipped").length;
    const errorCount = extractionResults.filter(r => r.status === "error").length;
    console.log(`\n--- Extraction Summary ---`);
    console.log(`  Files Extracted: ${extractedCount}`);
    if (skippedCount > 0) console.log(`  Files Skipped:   ${skippedCount}`);
    if (errorCount > 0) console.log(`  Errors:          ${errorCount}`);
    if (numFilesPrelim === 0) console.log("  No file content was found or parsed in the bundle.");

  } catch (error) {
    console.error(`\nError: ${error.message}`);
    if (error.message.includes("Unknown option") || error.message.includes("requires a value") || error.message.includes("Too many positional")) printCliHelpDogs();
    process.exit(1);
  }
}

module.exports = { extractToMemory, extractToDiskNode }; // Browser func removed
if (require.main === module) {
  mainCliDogs();
}