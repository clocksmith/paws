#!/usr/bin/env node
// dogs.js - Extracts files from a cats.js or LLM-generated (DOGS_) bundle, optionally applying deltas.

const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");
const readline = require("readline");

// Default character encoding for reading and writing text files.
const DEFAULT_ENCODING = "utf-8";

// Default filename for the input bundle if not specified.
const DEFAULT_INPUT_BUNDLE_FILENAME = "dogs_in.bundle";

// Default directory for extracted files.
const DEFAULT_OUTPUT_DIR = ".";

// Header prefixes used in Cats and Dogs bundles for identification.
const CATS_BUNDLE_HEADER_PREFIX = "# Cats Bundle";
const DOGS_BUNDLE_HEADER_PREFIX = "# Dogs Bundle";

// Prefix for the format description line within the bundle header.
const BUNDLE_FORMAT_PREFIX = "# Format: ";

// Prefix for the delta reference hint within the bundle header (from cats.js).
const DELTA_REFERENCE_HINT_PREFIX = "# Delta Reference: ";

// Text indicating Base64 encoded content in file markers.
const BASE64_HINT_TEXT_IN_MARKER = "Content:Base64";

// Regex template for file start markers.
// Captures path in group 1, and optional hint (like Content:Base64) in group 2.
const FILE_START_MARKER_REGEX_TEMPLATE = String.raw`^\s*{emoji}\s*-{{3,}}\s*{type}_START_FILE\s*:\s*(.+?)(?:\s+\(({hint_text_in_marker})\))?\s*-{{3,}}\s*$`;

// Regex for Cats bundle file start markers.
const CATS_FILE_START_MARKER_REGEX = new RegExp(
  FILE_START_MARKER_REGEX_TEMPLATE.replace("{emoji}", "🐈")
    .replace("{type}", "CATS")
    .replace(
      "{hint_text_in_marker}",
      Buffer.from(BASE64_HINT_TEXT_IN_MARKER)
        .toString("hex")
        .replace(/(..)/g, "\\x$1")
    ), // Escape to match literally
  "i"
);

// Regex for Cats bundle file end markers.
const CATS_FILE_END_MARKER_REGEX = /^\s*🐈\s*-{3,}\s*CATS_END_FILE\s*-{3,}$/i;

// Regex for Dogs bundle file start markers (used in LLM output).
const DOGS_FILE_START_MARKER_REGEX = new RegExp(
  FILE_START_MARKER_REGEX_TEMPLATE.replace("{emoji}", "🐕")
    .replace("{type}", "DOGS")
    .replace(
      "{hint_text_in_marker}",
      Buffer.from(BASE64_HINT_TEXT_IN_MARKER)
        .toString("hex")
        .replace(/(..)/g, "\\x$1")
    ),
  "i"
);

// Regex for Dogs bundle file end markers.
const DOGS_FILE_END_MARKER_REGEX = /^\s*🐕\s*-{3,}\s*DOGS_END_FILE\s*-{3,}$/i;

// Regex for PAWS_CMD delta instructions.
const PAWS_CMD_REGEX = /^\s*@@\s*PAWS_CMD\s*(.+?)\s*@@\s*$/;

// Regex for REPLACE_LINES delta command.
const REPLACE_LINES_REGEX = /REPLACE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)/i;

// Regex for INSERT_AFTER_LINE delta command.
const INSERT_AFTER_LINE_REGEX = /INSERT_AFTER_LINE\(\s*(\d+)\s*\)/i;

// Regex for DELETE_LINES delta command.
const DELETE_LINES_REGEX = /DELETE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)/i;

/**
 * Basic sanitization for a single filename or directory name component.
 * Prevents directory traversal or invalid characters.
 *
 * @param {string} comp - A single path component.
 * @returns {string} The sanitized path component.
 */
function sanitizePathComponent(comp) {
  // Handle special dot components.
  if (!comp || comp === "." || comp === "..") {
    return "_sanitized_dots_";
  }

  // Replace invalid characters with underscore.
  let sanitized = comp.replace(/[^\w.\-_~ ]/g, "_");

  // Replace multiple spaces with single underscore, then collapse multiple underscores.
  sanitized = sanitized.replace(/\s+/g, "_");
  sanitized = sanitized.replace(/_+/g, "_");

  // Remove leading/trailing dots or underscores.
  sanitized = sanitized.replace(/^[._]+|[._]+$/g, "");

  // Ensure it's not empty after sanitization.
  return sanitized || "sanitized_empty_comp";
}

/**
 * Sanitizes a full relative path from the bundle, ensuring all components are safe.
 *
 * @param {string} relPathFromBundle - The relative path as provided in the bundle.
 * @returns {string} The sanitized relative path.
 */
function sanitizeRelativePath(relPathFromBundle) {
  // Normalize path separators to forward slashes for consistent splitting.
  const normalizedPath = relPathFromBundle.replace(/\\/g, "/");

  // Split into components and sanitize each one.
  // Filter out empty parts and special dot components.
  const parts = normalizedPath
    .split("/")
    .filter((p) => p && p !== "." && p !== "..");
  const sanitizedParts = parts.map((p) => sanitizePathComponent(p));

  // If no valid parts, fall back to a sanitized version of the original filename.
  if (sanitizedParts.length === 0) {
    return (
      sanitizePathComponent(path.basename(relPathFromBundle)) ||
      "unnamed_file_from_bundle"
    );
  }

  // Reconstruct the path using path.join for platform compatibility.
  return path.join(...sanitizedParts);
}

/**
 * @typedef {Object} ParsedFileFromBundle
 * @property {string} path_in_bundle - Relative path from bundle marker.
 * @property {Buffer|null} contentBytes - Decoded file content as Buffer (null if delta).
 * @property {Array<Object>|null} deltaCommands - Parsed delta commands (null if full content).
 * @property {string} formatUsedForDecode - 'base64', 'utf8', 'utf16le', 'utf16be', or 'delta'.
 * @property {boolean} isBase64MarkedByHint - True if the file's marker had (Content:Base64) hint.
 * @property {boolean} isGloballyBase64 - True if the bundle header declared Base64 format.
 * @property {boolean} hasDeltaCommands - True if delta commands were found in this file block.
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
 * Parses the bundle content lines into a list of file objects.
 * Identifies bundle format, handles encoding, and extracts delta commands.
 *
 * @param {string[]} bundleLines - List of lines from the bundle file.
 * @param {string|null} forcedFormatOverride - User-specified override for
 *                                            the bundle's primary text format ('b64', 'utf8', 'utf16le').
 * @param {boolean} applyDeltaMode - True if delta commands should be parsed.
 * @param {boolean} [verbose=false] - Whether to print verbose log messages.
 * @returns {{parsedFiles: ParsedFileFromBundle[], formatDescription: string, effectiveEncoding: string, bundleIsDeltaReference: boolean, numB64Marked: number}}
 */
function parseBundleContent(
  bundleLines,
  forcedFormatOverride = null,
  applyDeltaMode = false,
  verbose = false
) {
  const parsedFiles = [];
  let bundleIsGloballyB64 = false;
  let bundleTextContentEncoding = DEFAULT_ENCODING; // Node.js 'utf8'
  let formatDescription = "Unknown (Header not found or not recognized)";
  let bundleIsDeltaReference = false;
  let numB64Marked = 0;
  let headerLinesConsumed = 0;
  let headerTypeFound = null;

  // Parse bundle header for format and type within the first 10 lines.
  for (let i = 0; i < Math.min(bundleLines.length, 10); i++) {
    const lineTextTrimmed = bundleLines[i].trim();

    // Detect bundle type (Cats or Dogs).
    if (!headerTypeFound) {
      if (lineTextTrimmed.startsWith(DOGS_BUNDLE_HEADER_PREFIX)) {
        headerTypeFound = "Dogs Bundle";
      } else if (lineTextTrimmed.startsWith(CATS_BUNDLE_HEADER_PREFIX)) {
        headerTypeFound = "Cats Bundle";
      }
      if (headerTypeFound) {
        headerLinesConsumed = Math.max(headerLinesConsumed, i + 1);
        continue;
      }
    }

    // Detect bundle format.
    if (headerTypeFound && lineTextTrimmed.startsWith(BUNDLE_FORMAT_PREFIX)) {
      headerLinesConsumed = Math.max(headerLinesConsumed, i + 1);
      const tempFormatDescVal = lineTextTrimmed
        .substring(BUNDLE_FORMAT_PREFIX.length)
        .trim();
      formatDescription = `${headerTypeFound} - Format: ${tempFormatDescVal}`;
      const fmtLower = tempFormatDescVal.toLowerCase();

      if (fmtLower.includes("base64")) {
        bundleIsGloballyB64 = true;
        bundleTextContentEncoding = "ascii"; // Base64 content uses 'ascii' for decoding
      } else if (
        fmtLower.includes("utf-16le") ||
        fmtLower.includes("utf-16 le")
      ) {
        bundleTextContentEncoding = "utf16le";
      } else if (fmtLower.includes("utf-16be")) {
        // Explicitly check for BE
        bundleTextContentEncoding = "utf16be";
      } else if (fmtLower.includes("utf-8")) {
        bundleTextContentEncoding = "utf8";
      } else {
        // Default to UTF-8 if specific encoding not clearly stated.
        bundleTextContentEncoding = "utf8";
        formatDescription += ` (Unrecognized details, assuming Raw UTF-8 for text)`;
      }
    }

    // Detect if bundle is marked as a delta reference.
    if (lineTextTrimmed.startsWith(DELTA_REFERENCE_HINT_PREFIX)) {
      bundleIsDeltaReference = true;
      headerLinesConsumed = Math.max(headerLinesConsumed, i + 1); // Ensure this line is skipped too
    }
  }

  // Apply user's format override if specified.
  if (forcedFormatOverride) {
    const overrideLower = forcedFormatOverride.toLowerCase();
    const descPrefix = `${headerTypeFound || "Bundle"} - Format:`;
    if (overrideLower === "b64") {
      bundleIsGloballyB64 = true;
      bundleTextContentEncoding = "ascii";
      formatDescription = `${descPrefix} Base64 (User Override)`;
    } else if (overrideLower === "utf16le") {
      bundleIsGloballyB64 = false;
      bundleTextContentEncoding = "utf16le";
      formatDescription = `${descPrefix} Raw UTF-16LE (User Override)`;
    } else if (overrideLower === "utf8") {
      bundleIsGloballyB64 = false;
      bundleTextContentEncoding = "utf8";
      formatDescription = `${descPrefix} Raw UTF-8 (User Override)`;
    }
  }

  // Set default format if no header was found and no override was given.
  if (!headerTypeFound && !forcedFormatOverride) {
    bundleIsGloballyB64 = false; // Default to text-based if no header
    bundleTextContentEncoding = "utf8";
    formatDescription = "Raw UTF-8 (Assumed, no valid bundle header found)";
    if (verbose) {
      console.warn(`  Warning: ${formatDescription}`);
    }
  }

  let currentFileRelativePathFromMarker = null;
  let currentContentLines = [];
  let currentDeltaCommands = [];
  let isCurrentFileBase64ByHint = false;

  // Iterate through bundle lines starting after the header.
  for (
    let lineNum = headerLinesConsumed;
    lineNum < bundleLines.length;
    lineNum++
  ) {
    const lineText = bundleLines[lineNum];
    const strippedLine = lineText.trim();

    // Check for Cats or Dogs file start markers.
    let startMatch =
      DOGS_FILE_START_MARKER_REGEX.exec(strippedLine) ||
      CATS_FILE_START_MARKER_REGEX.exec(strippedLine);

    // Check for Cats or Dogs file end markers.
    let endMatch =
      DOGS_FILE_END_MARKER_REGEX.test(strippedLine) ||
      CATS_FILE_END_MARKER_REGEX.test(strippedLine);

    if (currentFileRelativePathFromMarker) {
      // If currently inside a file block.
      if (endMatch) {
        // End of current file block detected.
        let fileContentBytes = null;
        let deltaCmds = null;
        let formatUsedForDecode = "text";

        // Determine if content should be treated as Base64.
        const isEffectivelyBase64 =
          bundleIsGloballyB64 || isCurrentFileBase64ByHint;

        // Process delta commands if delta mode is active and not a Base64 file.
        if (
          applyDeltaMode &&
          currentDeltaCommands.length > 0 &&
          !isEffectivelyBase64
        ) {
          // Ensure content lines are stored for the last delta command (if not delete).
          if (
            currentDeltaCommands[currentDeltaCommands.length - 1].type !==
            "delete"
          ) {
            currentDeltaCommands[currentDeltaCommands.length - 1].contentLines =
              [...currentContentLines];
          }
          deltaCmds = currentDeltaCommands;
          formatUsedForDecode = "delta";
        } else {
          // If not delta mode or Base64 file, process as raw content.
          const rawContentStr = currentContentLines.join("\n");
          try {
            if (isEffectivelyBase64) {
              // Decode Base64 content. Remove all whitespace before decoding.
              fileContentBytes = Buffer.from(
                rawContentStr.replace(/\s/g, ""),
                "base64"
              );
              formatUsedForDecode = "base64";
            } else {
              // Convert text content to Buffer using the determined encoding.
              fileContentBytes = Buffer.from(
                rawContentStr,
                bundleTextContentEncoding
              );
              formatUsedForDecode = bundleTextContentEncoding;
            }
          } catch (e) {
            console.warn(
              `  Error: Failed to decode content for '${currentFileRelativePathFromMarker}' (format: ${
                isEffectivelyBase64 ? "base64" : bundleTextContentEncoding
              }). Skipping. Error: ${e.message}`
            );
            // In case of decoding error, set bytes to null to indicate failure for this file.
            fileContentBytes = null;
          }
        }

        // Add the parsed file to the list if content or deltas were found.
        if (fileContentBytes !== null || deltaCmds !== null) {
          parsedFiles.push({
            path_in_bundle: currentFileRelativePathFromMarker,
            contentBytes: fileContentBytes,
            deltaCommands: deltaCmds,
            formatUsedForDecode: formatUsedForDecode,
            isBase64MarkedByHint: isCurrentFileBase64ByHint,
            isGloballyBase64: bundleIsGloballyB64,
            hasDeltaCommands: deltaCmds !== null,
          });
          if (isCurrentFileBase64ByHint) {
            numB64Marked++;
          }
        }

        // Reset state for next file.
        currentFileRelativePathFromMarker = null;
        currentContentLines = [];
        currentDeltaCommands = [];
        isCurrentFileBase64ByHint = false;
        continue;
      }

      // Process lines within a file block.
      const isEffectivelyBase64ForBlock =
        bundleIsGloballyB64 || isCurrentFileBase64ByHint;

      // If in delta mode and not a Base64 file, check for PAWS_CMD.
      if (applyDeltaMode && !isEffectivelyBase64ForBlock) {
        const pawsCmdMatch = lineText.match(PAWS_CMD_REGEX);
        if (pawsCmdMatch) {
          const commandStr = pawsCmdMatch[1].trim();
          let deltaCmd = null;

          // Finalize content for the previous command (if any and not a delete).
          if (
            currentDeltaCommands.length > 0 &&
            currentDeltaCommands[currentDeltaCommands.length - 1].type !==
              "delete"
          ) {
            currentDeltaCommands[currentDeltaCommands.length - 1].contentLines =
              [...currentContentLines];
          }
          currentContentLines = []; // Reset for new command's content.

          // Match specific delta command types.
          const replaceMatch = commandStr.match(REPLACE_LINES_REGEX);
          const insertMatch = commandStr.match(INSERT_AFTER_LINE_REGEX);
          const deleteMatch = commandStr.match(DELETE_LINES_REGEX);

          if (replaceMatch) {
            deltaCmd = {
              type: "replace",
              start: parseInt(replaceMatch[1], 10),
              end: parseInt(replaceMatch[2], 10),
            };
          } else if (insertMatch) {
            deltaCmd = {
              type: "insert",
              lineNum: parseInt(insertMatch[1], 10),
            };
          } else if (deleteMatch) {
            deltaCmd = {
              type: "delete",
              start: parseInt(deleteMatch[1], 10),
              end: parseInt(deleteMatch[2], 10),
              contentLines: [],
            }; // Delete commands have no content.
          }

          if (deltaCmd) {
            currentDeltaCommands.push(deltaCmd);
          } else {
            if (verbose) {
              console.warn(
                `  Warning (L${
                  lineNum + 1
                }): Unrecognized PAWS_CMD format: '${commandStr}' in '${currentFileRelativePathFromMarker}'. Treating line as content.`
              );
            }
            currentContentLines.push(lineText); // Treat as content if unrecognized
          }
          continue; // Skip command line itself.
        }
      }

      // If not a start/end/command line, and inside a block, add to buffer.
      currentContentLines.push(lineText);
    } else if (startMatch) {
      // New file block detected.
      currentFileRelativePathFromMarker = startMatch[1].trim();
      currentContentLines = [];
      currentDeltaCommands = [];

      // Check for Base64 hint in the start marker (group 2).
      isCurrentFileBase64ByHint =
        startMatch[2] && startMatch[2].includes(BASE64_HINT_TEXT_IN_MARKER);

      if (verbose) {
        console.log(
          `  Debug (L${
            lineNum + 1
          }): Matched START marker for '${currentFileRelativePathFromMarker}'${
            isCurrentFileBase64ByHint ? " (Base64 hinted)" : ""
          }`
        );
      }
    }
  } // End line loop

  // Handle case where the bundle ends abruptly mid-file.
  if (currentFileRelativePathFromMarker) {
    console.warn(
      `  Warning: Bundle ended before file '${currentFileRelativePathFromMarker}' was closed by an END marker. Block discarded.`
    );
  }

  return {
    parsedFiles,
    formatDescription,
    effectiveEncoding: bundleTextContentEncoding,
    bundleIsDeltaReference,
    numB64Marked,
  };
}

/**
 * Parses an original Cats bundle to create a mapping of file paths to their
 * line content, used as a reference for delta operations.
 *
 * @param {string} originalBundlePath - Absolute path to the original Cats bundle.
 * @param {boolean} verbose - Whether to print verbose log messages.
 * @returns {Promise<Object<string, string[]>>} A dictionary mapping relative file paths to their
 *                                             list of content lines.
 */
async function parseOriginalBundleForDeltaNode(
  originalBundlePath,
  verbose = false
) {
  const originalFiles = {};
  let originalContent = "";
  try {
    originalContent = await fs.promises.readFile(originalBundlePath, {
      encoding: null,
    }); // Read as buffer to detect encoding
  } catch (e) {
    console.error(
      `  Error: Could not read original bundle '${originalBundlePath}' for delta: ${e.message}`
    );
    return {};
  }

  // Detect encoding for the original bundle content
  let detectedEncoding = DEFAULT_ENCODING; // Fallback
  if (originalContent.length >= 2) {
    if (originalContent[0] === 0xff && originalContent[1] === 0xfe)
      detectedEncoding = "utf16le";
    else if (originalContent[0] === 0xfe && originalContent[1] === 0xff)
      detectedEncoding = "utf16be";
  }
  const decodedContent = originalContent.toString(detectedEncoding);

  const lines = decodedContent.split(/\r?\n/);
  let currentFile = null;
  let currentLines = [];

  for (const line of lines) {
    const strippedLine = line.trim();
    const startMatch = CATS_FILE_START_MARKER_REGEX.exec(strippedLine); // Use the updated regex to handle hint
    const endMatch = CATS_FILE_END_MARKER_REGEX.test(strippedLine);

    if (startMatch) {
      if (currentFile) {
        originalFiles[currentFile] = currentLines; // Store previous file if any
        if (verbose)
          console.log(
            `  Debug (Original Parse): Finalized ${currentLines.length} lines for '${currentFile}'`
          );
      }
      currentFile = startMatch[1].trim(); // Path is in group 1
      currentLines = [];
      if (verbose)
        console.log(
          `  Debug (Original Parse): Starting to load lines for '${currentFile}'`
        );
    } else if (endMatch && currentFile) {
      originalFiles[currentFile] = currentLines;
      if (verbose)
        console.log(
          `  Debug (Original Parse): Loaded ${currentLines.length} lines for '${currentFile}'`
        );
      currentFile = null;
      currentLines = [];
    } else if (currentFile !== null) {
      currentLines.push(line);
    }
  }
  // Handle case where bundle ends without a final END marker for the last file.
  if (currentFile) {
    originalFiles[currentFile] = currentLines;
    if (verbose)
      console.log(
        `  Debug (Original Parse): Loaded ${currentLines.length} lines for '${currentFile}' (EOF).`
      );
  }
  return originalFiles;
}

/**
 * Applies a list of delta commands to an original list of text lines.
 *
 * @param {string[]} originalLines - The original content lines of the file.
 * @param {DeltaCommand[]} deltaCommands - The list of delta commands to apply.
 * @param {string} filePathForLog - The file path for logging purposes.
 * @returns {string[]} The new list of content lines after applying deltas.
 */
function applyDeltaCommandsNode(originalLines, deltaCommands, filePathForLog) {
  let newLines = [...originalLines];
  // Track the cumulative change in line numbers due to insertions/deletions.
  let lineOffset = 0;

  for (const cmd of deltaCommands) {
    try {
      const type = cmd.type;
      const content = cmd.contentLines || [];

      if (type === "replace") {
        const start = cmd.start;
        const end = cmd.end;
        // Validate 1-based line numbers. 'end' can be 0 for replacing an empty file (meaning replacing line 1 to 0).
        if (
          !(
            Number.isInteger(start) &&
            Number.isInteger(end) &&
            start > 0 &&
            end >= start - 1
          )
        ) {
          throw new Error(`Invalid line numbers for replace: ${start}-${end}`);
        }

        // Adjust to 0-based indexing and apply cumulative offset.
        const adjStart = start - 1 + lineOffset;
        const adjEnd = end - 1 + lineOffset;

        // Validate adjusted indices against current file length.
        // Special case: replacing line 1 through 0 in an empty array should work (replace empty file).
        if (
          !(
            adjStart >= 0 &&
            adjStart <= newLines.length &&
            (adjEnd < newLines.length ||
              (start === 1 && end === 0 && newLines.length === 0))
          )
        ) {
          throw new Error(
            `Adjusted replace line numbers ${adjStart + 1}-${
              adjEnd + 1
            } out of bounds for current length ${newLines.length}`
          );
        }

        // Calculate number of lines deleted by the replace operation.
        const deleteCount = adjEnd >= adjStart ? adjEnd - adjStart + 1 : 0;

        // Perform replacement in slice.
        newLines.splice(adjStart, deleteCount, ...content);

        // Update offset based on change in line count.
        lineOffset += content.length - deleteCount;
      } else if (type === "insert") {
        const lineNum = cmd.lineNum; // 1-based line number *after* which to insert. lineNum=0 means insert at beginning.
        // Validate 1-based line number for insertion.
        if (!(Number.isInteger(lineNum) && lineNum >= 0)) {
          throw new Error(`Invalid line number for insert: ${lineNum}`);
        }

        // Adjust to 0-based insertion point and apply cumulative offset.
        const adjInsertIdx = lineNum + lineOffset;

        // Validate adjusted insertion point.
        if (!(adjInsertIdx >= 0 && adjInsertIdx <= newLines.length)) {
          throw new Error(
            `Adjusted insert position ${
              adjInsertIdx + 1
            } out of bounds for current length ${newLines.length}`
          );
        }

        // Perform insertion using splice.
        newLines.splice(adjInsertIdx, 0, ...content);

        // Update offset.
        lineOffset += content.length;
      } else if (type === "delete") {
        const start = cmd.start;
        const end = cmd.end;
        // Validate 1-based line numbers for deletion.
        if (
          !(
            Number.isInteger(start) &&
            Number.isInteger(end) &&
            start > 0 &&
            end >= start
          )
        ) {
          throw new Error(`Invalid line numbers for delete: ${start}-${end}`);
        }

        // Adjust to 0-based indices and apply cumulative offset.
        const adjStart = start - 1 + lineOffset;
        const adjEnd = end - 1 + lineOffset;

        // Validate adjusted indices against current file length.
        if (
          !(adjStart >= 0 && adjEnd < newLines.length && adjStart <= adjEnd)
        ) {
          throw new Error(
            `Adjusted delete line numbers ${adjStart + 1}-${
              adjEnd + 1
            } out of bounds for current length ${newLines.length}`
          );
        }

        // Calculate number of lines to delete.
        const deleteCount = adjEnd - adjStart + 1;

        // Perform deletion.
        newLines.splice(adjStart, deleteCount);

        // Update offset.
        lineOffset -= deleteCount;
      } else {
        console.warn(
          `  Warning: Unknown delta command type '${type}' for '${filePathForLog}'. Skipping command.`
        );
      }
    } catch (e) {
      console.warn(
        `  Error applying delta command (${cmd.type}) to '${filePathForLog}': ${e.message}. Skipping this command.`
      );
      // It's safer to continue with the remaining commands if possible,
      // but this file might be inconsistent.
    }
  }
  return newLines;
}

/**
 * Extracts bundle content into memory (as ParsedFile objects) without writing to disk.
 * This API function does not apply delta commands; it only parses full content blocks.
 *
 * @param {Object} options
 * @param {string} [options.bundleFilePath] - Path to the bundle file.
 * @param {string} [options.bundleFileContent] - The bundle content as a string.
 * @param {string} [options.inputFormat='auto'] - Override for bundle's primary text format.
 * @param {boolean} [options.verbose=false] - Whether to enable verbose logging.
 * @returns {Promise<ParsedFileFromBundle[]>} - A list of parsed file dictionaries containing full content bytes.
 */
async function extractToMemory({
  bundleFilePath,
  bundleFileContent,
  inputFormat = "auto",
  verbose = false,
}) {
  let contentStr = bundleFileContent;
  // Read from file if content string is not provided.
  if (!contentStr && bundleFilePath) {
    try {
      contentStr = await fs.promises.readFile(
        path.resolve(bundleFilePath),
        DEFAULT_ENCODING
      );
    } catch (e) {
      console.error(
        `Error reading bundle file '${bundleFilePath}': ${e.message}`
      );
      return [];
    }
  }
  if (contentStr === null || contentStr === undefined) {
    // Check for null and undefined explicitly
    console.error("No bundle content or path provided for memory extraction.");
    return [];
  }

  const formatOverride = inputFormat === "auto" ? null : inputFormat;
  // Force applyDelta=false as this function is for full content memory extraction only.
  const { parsedFiles } = parseBundleContent(
    contentStr,
    formatOverride,
    false,
    verbose
  );

  // Filter out any delta-only results if they somehow slipped through.
  return parsedFiles.filter((f) => f.contentBytes !== null);
}

/**
 * Extracts bundle content to disk from a string or file path.
 * Handles paths, overwriting, and delta application.
 *
 * @param {Object} options
 * @param {string} [options.bundleFilePath] - Path to the bundle file.
 * @param {string} [options.bundleFileContent] - The bundle content as a string.
 * @param {string} options.outputDir - The base directory to extract files into.
 * @param {string} [options.overwritePolicy='prompt'] - How to handle existing files ('yes', 'no', 'prompt').
 * @param {string|null} [options.applyDeltaFromOriginalBundlePath=null] - Path to the original bundle for delta reference.
 * @param {string} [options.inputFormat='auto'] - Override for bundle's primary text format.
 * @param {boolean} [options.verbose=false] - Whether to enable verbose logging.
 * @returns {Promise<Array<{path: string, status: string, message: string}>>} A list of dictionaries detailing the result for each file.
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

  // Load original bundle content if delta mode is active.
  let originalBundleFiles = null;
  if (applyDeltaFromOriginalBundlePath) {
    originalBundleFiles = await parseOriginalBundleForDeltaNode(
      applyDeltaFromOriginalBundlePath,
      verbose
    );
    if (Object.keys(originalBundleFiles).length === 0) {
      console.error(
        `  Warning: Delta application requested, but failed to load/parse original bundle '${applyDeltaFromOriginalBundlePath}'. Delta commands cannot be applied.`
      );
      applyDeltaFromOriginalBundlePath = null; // Disable delta if original failed to load/parse
    }
  }

  // Ensure output directory exists and is a directory.
  if (!fs.existsSync(absOutputDirBase)) {
    try {
      await fs.promises.mkdir(absOutputDirBase, { recursive: true });
      if (verbose)
        console.error(
          `  Info: Created output directory '${absOutputDirBase}'.`
        );
    } catch (e) {
      const msg = `Error creating output directory '${absOutputDirBase}': ${e.message}`;
      console.error(msg);
      return [{ path: outputDir, status: "error", message: msg }];
    }
  } else {
    try {
      const stat = await fs.promises.stat(absOutputDirBase);
      if (!stat.isDirectory()) {
        const msg = `Error: Output path '${absOutputDirBase}' exists but is not a directory.`;
        console.error(msg);
        return [{ path: outputDir, status: "error", message: msg }];
      }
    } catch (e) {
      const msg = `Error checking output path '${absOutputDirBase}': ${e.message}`;
      console.error(msg);
      return [{ path: outputDir, status: "error", message: msg }];
    }
  }
  const realAbsOutputDirBase = fs.realpathSync(absOutputDirBase);

  let contentStr = bundleFileContent;
  // Read bundle content from file if not provided as a string.
  if (!contentStr && bundleFilePath) {
    try {
      // Read as Buffer first to allow encoding detection during parseBundleContent
      contentStr = await fs.promises.readFile(
        path.resolve(bundleFilePath),
        DEFAULT_ENCODING
      );
    } catch (e) {
      const msg = `Error reading bundle file '${bundleFilePath}': ${e.message}`;
      console.error(msg);
      return [{ path: bundleFilePath, status: "error", message: msg }];
    }
  }
  if (contentStr === null || contentStr === undefined) {
    return [
      {
        path: "bundle",
        status: "error",
        message: "No bundle content provided.",
      },
    ];
  }

  const formatOverride = inputFormat === "auto" ? null : inputFormat;
  const { parsedFiles, formatDescription, effectiveEncoding } =
    parseBundleContent(
      contentStr.split(/\r?\n/), // Split content string into lines
      formatOverride,
      !!applyDeltaFromOriginalBundlePath, // Pass true if applyDeltaFromOriginalBundlePath is not null
      verbose
    );

  if (verbose) {
    console.error(
      `  Info: Bundle parsed. Format: ${formatDescription}. Files found: ${parsedFiles.length}.`
    );
  }
  if (parsedFiles.length === 0) {
    return results;
  }

  // Determine auto-overwrite/skip behavior.
  let alwaysYes = overwritePolicy === "yes";
  let alwaysNo = overwritePolicy === "no";
  let userQuitExtraction = false;

  // Set up readline interface for interactive prompts if needed.
  const rl =
    overwritePolicy === "prompt" && process.stdin.isTTY
      ? readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })
      : null;
  const promptUser = rl
    ? (query) => new Promise((resolve) => rl.question(query, resolve))
    : null;

  // In non-interactive mode, if policy is 'prompt', default to 'no' (skip).
  if (overwritePolicy === "prompt" && !process.stdin.isTTY) {
    if (verbose)
      console.error(
        "  Info: Non-interactive mode, 'prompt' defaults to 'no' for overwrite."
      );
    alwaysNo = true;
  }

  for (const fileToExtract of parsedFiles) {
    // If user decided to quit, skip remaining files.
    if (userQuitExtraction) {
      results.push({
        path: fileToExtract.path_in_bundle,
        status: "skipped",
        message: "User quit extraction.",
      });
      continue;
    }

    const originalPathFromMarker = fileToExtract.path_in_bundle;

    // Sanitize path to prevent directory traversal vulnerabilities.
    const sanitizedFinalRelPath = sanitizeRelativePath(originalPathFromMarker);
    const prospectiveAbsOutputPath = path.normalize(
      path.join(realAbsOutputDirBase, sanitizedFinalRelPath)
    );

    // Security check for path traversal (redundant but good practice after sanitize).
    try {
      const prospectiveDir = path.dirname(prospectiveAbsOutputPath);
      if (!fs.existsSync(prospectiveDir)) {
        // Check parent chain if intermediate dirs needed.
        let checkDir = prospectiveDir;
        let currentSegment = path.basename(checkDir);
        while (
          !fs.existsSync(checkDir) &&
          checkDir !== path.dirname(checkDir) &&
          currentSegment !== ""
        ) {
          checkDir = path.dirname(checkDir);
          currentSegment = path.basename(checkDir);
        }
        if (!fs.realpathSync(checkDir).startsWith(realAbsOutputDirBase))
          throw new Error(
            "Path traversal attempt detected in intermediate directories."
          );
      } else {
        // If directory exists, check its real path.
        if (!fs.realpathSync(prospectiveDir).startsWith(realAbsOutputDirBase))
          throw new Error(
            "Path traversal attempt detected in existing directory."
          );
      }
    } catch (e) {
      const msg = `Security Alert: Path '${sanitizedFinalRelPath}' (from '${originalPathFromMarker}') resolved outside base '${realAbsOutputDirBase}'. Skipping. Error: ${e.message}`;
      console.error(`  Error: ${msg}`);
      results.push({
        path: originalPathFromMarker,
        status: "error",
        message: msg,
      });
      continue;
    }

    let fileContentToWrite = null;
    let performActualWrite = true;

    // Determine content: apply delta or use full bytes.
    if (
      applyDeltaFromOriginalBundlePath &&
      fileToExtract.hasDeltaCommands &&
      originalBundleFiles
    ) {
      const originalFileLines = originalBundleFiles[originalPathFromMarker];
      if (originalFileLines !== undefined) {
        // Check for undefined, not just null, as it can be empty array
        if (
          fileToExtract.isBase64MarkedByHint ||
          fileToExtract.isGloballyBase64
        ) {
          // Deltas are not for Base64 files; log a warning and use full content if available.
          console.warn(
            `  Warning: Delta commands found for Base64-marked file '${originalPathFromMarker}'. Deltas cannot be applied to binary content. Using full content from bundle if available.`
          );
          fileContentToWrite = fileToExtract.contentBytes;
        } else {
          if (verbose)
            console.error(
              `  Info: Applying delta for ${originalPathFromMarker}`
            );
          const newLines = applyDeltaCommandsNode(
            originalFileLines,
            fileToExtract.deltaCommands || [],
            originalPathFromMarker
          );
          // Encode using bundle's text format. Default to utf8 for delta results if the bundle itself was binary or delta format.
          const encoding =
            fileToExtract.isGloballyBase64 ||
            fileToExtract.formatUsedForDecode === "delta" ||
            fileToExtract.formatUsedForDecode === "base64"
              ? "utf8"
              : effectiveEncoding;
          try {
            fileContentToWrite = Buffer.from(newLines.join("\n"), encoding);
          } catch (encErr) {
            const msg = `Failed to encode delta result for '${originalPathFromMarker}' using ${encoding}: ${encErr.message}`;
            console.error(`  Error: ${msg}`);
            results.push({
              path: originalPathFromMarker,
              status: "error",
              message: msg,
            });
            performActualWrite = false;
          }
        }
      } else {
        const msg = `Delta commands for '${originalPathFromMarker}' but file not found in original bundle. Cannot apply deltas. Attempting full content write if available.`;
        console.error(`  Error: ${msg}`);
        results.push({
          path: originalPathFromMarker,
          status: "error",
          message: msg,
        });
        fileContentToWrite = fileToExtract.contentBytes; // Fallback to full content.
      }
    } else {
      fileContentToWrite = fileToExtract.contentBytes; // Use full content if no delta applicable.
    }

    // If file content is null at this point, it indicates a prior error, so skip.
    if (fileContentToWrite === null) {
      if (
        !results.some(
          (r) => r.path === originalPathFromMarker && r.status === "error"
        )
      ) {
        // Check if error already logged
        const msg = `No valid content available for '${originalPathFromMarker}'. Write skipped.`;
        console.warn(`  Warning: ${msg}`);
        results.push({
          path: originalPathFromMarker,
          status: "error",
          message: msg,
        });
      }
      performActualWrite = false;
    }

    // Overwrite check
    if (performActualWrite && fileContentToWrite !== null) {
      if (fs.existsSync(prospectiveAbsOutputPath)) {
        const stat = await fs.promises.lstat(prospectiveAbsOutputPath);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          const msg = `Path '${sanitizedFinalRelPath}' exists as directory. Cannot overwrite. Skipping.`;
          console.error(`  Error: ${msg}`);
          results.push({
            path: originalPathFromMarker,
            status: "error",
            message: msg,
          });
          performActualWrite = false;
        } else if (alwaysYes) {
          if (verbose)
            console.error(
              `  Info: Overwriting '${sanitizedFinalRelPath}' (forced yes).`
            );
        } else if (alwaysNo) {
          if (verbose)
            console.error(
              `  Info: Skipping existing file '${sanitizedFinalRelPath}' (forced no).`
            );
          results.push({
            path: originalPathFromMarker,
            status: "skipped",
            message: "Overwrite (policy: no).",
          });
          performActualWrite = false;
        } else if (promptUser) {
          // Interactive prompt for overwrite.
          while (true) {
            const choice = (
              await promptUser(
                `File '${sanitizedFinalRelPath}' exists. Overwrite? [y/N/a/s/q]: `
              )
            )
              .trim()
              .toLowerCase();
            if (choice === "y") {
              break;
            }
            if (choice === "n" || choice === "") {
              // Default to 'no'
              performActualWrite = false;
              results.push({
                path: originalPathFromMarker,
                status: "skipped",
                message: "Overwrite (user: no).",
              });
              break;
            }
            if (choice === "a") {
              // Always yes
              alwaysYes = true;
              break;
            }
            if (choice === "s") {
              // Skip all
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
              // Quit
              userQuitExtraction = true;
              performActualWrite = false;
              break;
            }
            console.error("Invalid choice. Please enter y, n, a, s, or q.");
          }
        } else {
          // This case should ideally not be reached if policies are handled correctly,
          // but as a fallback, assume skip in non-interactive mode.
          performActualWrite = false;
          results.push({
            path: originalPathFromMarker,
            status: "skipped",
            message: "Overwrite (prompt default no).",
          });
        }
      }
    }

    // Ensure not to write if user decided to quit or skip.
    if (userQuitExtraction && !performActualWrite) {
      // Add skipped status if not already added by 's' or 'q'.
      if (
        !results.some(
          (r) => r.path === originalPathFromMarker && r.status === "skipped"
        )
      ) {
        results.push({
          path: originalPathFromMarker,
          status: "skipped",
          message: "User quit extraction.",
        });
      }
      continue;
    }

    // Write file to disk.
    if (performActualWrite && fileContentToWrite !== null) {
      try {
        const outputFileDir = path.dirname(prospectiveAbsOutputPath);
        if (!fs.existsSync(outputFileDir)) {
          await fs.promises.mkdir(outputFileDir, { recursive: true });
        }
        // If it's a symlink, unlink it before writing to avoid writing into the target.
        if (
          fs.existsSync(prospectiveAbsOutputPath) &&
          (await fs.promises.lstat(prospectiveAbsOutputPath)).isSymbolicLink()
        ) {
          await fs.promises.unlink(prospectiveAbsOutputPath);
        }
        await fs.promises.writeFile(
          prospectiveAbsOutputPath,
          fileContentToWrite
        );
        results.push({
          path: originalPathFromMarker,
          status: "extracted",
          message: `Extracted to ${sanitizedFinalRelPath}`,
        });
        if (verbose) console.error(`  Extracted: ${sanitizedFinalRelPath}`);
      } catch (e) {
        const msg = `Error writing file '${sanitizedFinalRelPath}': ${e.message}`;
        console.error(`  Error: ${msg}`);
        results.push({
          path: originalPathFromMarker,
          status: "error",
          message: msg,
        });
      }
    } else if (performActualWrite && fileContentToWrite === null) {
      // Write skipped because content was null (e.g., delta failed to generate content).
      if (
        !results.some(
          (r) => r.path === originalPathFromMarker && r.status === "error"
        )
      ) {
        // Avoid duplicate error
        results.push({
          path: originalPathFromMarker,
          status: "error",
          message:
            "Content generation failed (e.g., delta error), write skipped.",
        });
      }
    }
  } // End file loop

  if (rl) rl.close(); // Close readline interface if it was opened.
  return results;
}

/**
 * Parses command-line arguments for dogs.js.
 * @param {string[]} argv - process.argv.
 * @returns {Object} Parsed arguments.
 * @throws {Error} If arguments are invalid.
 */
function parseCliArgsDogs(argv) {
  const args = {
    bundleFile: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    applyDelta: null, // Path to original bundle
    inputFormat: "auto",
    overwrite: "prompt", // Default policy
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
    } else if (arg === "-d" || arg === "--apply-delta") {
      if (i + 1 < cliArgs.length && !cliArgs[i + 1].startsWith("-")) {
        args.applyDelta = cliArgs[++i];
      } else {
        throw new Error(
          `Argument ${arg} requires the path to the original bundle.`
        );
      }
    } else if (arg === "-i" || arg === "--input-format") {
      if (
        i + 1 < cliArgs.length &&
        !cliArgs[i + 1].startsWith("-") &&
        ["auto", "b64", "utf8", "utf16le"].includes(
          cliArgs[i + 1].toLowerCase()
        )
      ) {
        args.inputFormat = cliArgs[++i].toLowerCase();
      } else {
        throw new Error(
          `Argument ${arg} requires a valid value (auto, b64, utf8, utf16le).`
        );
      }
    } else if (arg === "-y" || arg === "--yes") {
      args.overwrite = "yes";
    } else if (arg === "-n" || arg === "--no") {
      args.overwrite = "no";
    } else if (arg === "-v" || arg === "--verbose") {
      args.verbose = true;
    } else if (!arg.startsWith("-")) {
      // Positional arguments: bundleFile, then outputDir.
      if (positionalCount === 0) {
        args.bundleFile = arg;
      } else if (positionalCount === 1) {
        args.outputDir = arg;
      } else {
        throw new Error(`Too many positional arguments: ${arg}`);
      }
      positionalCount++;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
    i++;
  }
  return args;
}

/**
 * Prints the CLI help message for dogs.js.
 */
function printCliHelpDogs() {
  console.log(`
dogs.js : Extracts files from a PAWS bundle back into a directory structure, optionally applying deltas.

It intelligently decodes text and Base64-encoded binary content.
Supports applying line-based delta changes from an original bundle.

Syntax: node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]

Arguments:
  BUNDLE_FILE             Input bundle to extract (default: '${DEFAULT_INPUT_BUNDLE_FILENAME}' if exists).
  OUTPUT_DIR              Directory to extract files into (default: '${DEFAULT_OUTPUT_DIR}').

Options:
  -d, --apply-delta ORIGINAL_BUNDLE Path to original bundle (e.g., cats_out.bundle) to apply delta commands against.
                                    Deltas apply to text files only; full content is used for binary files.
  -i {auto|b64|utf8|utf16le}, --input-format MODE
                          Override bundle's primary text format detection (default: auto).
                          Affects how non-Base64 marked text content is interpreted.
  -y, --yes               Automatically overwrite any existing files without prompting.
  -n, --no                Automatically skip existing files without prompting.
                          (If neither -y nor -n is used, an interactive prompt will appear for each existing file.)
  -v, --verbose           Enable verbose logging during parsing and extraction.
  -h, --help              Show this help message and exit.

Interactive Overwrite Prompt (Default behavior if -y or -n are not used):
  When 'dogs.js' encounters an existing file in the OUTPUT_DIR and is running in an interactive terminal,
  it will display a prompt: 'File 'path/to/file' exists. Overwrite? [y/N/a/s/q]:'
  - y (Yes): Overwrite the current file.
  - N (No / Default): Skip the current file, leaving the existing file untouched.
  - a (Always yes): Overwrite the current file and all subsequent existing files without further prompts.
  - s (Skip all): Skip the current file and all subsequent existing files without further prompts.
  - q (Quit): Immediately cancel the entire extraction process and exit.

Examples:
  # Extract default 'dogs_in.bundle' to './output', automatically overwriting existing files
  node dogs.js -y ./output

  # Extract 'llm_refactor_output.bundle' into a new directory 'my_project_v2', overwriting existing files
  node dogs.js llm_refactor_output.bundle ./my_project_v2 -y

  # Apply delta changes from 'llm_delta.bundle', using 'original_codebase.bundle' as the base reference,
  # extracting to './project_with_updates' and showing verbose output
  node dogs.js llm_delta.bundle ./project_with_updates -v -d original_codebase.bundle

  # Extract 'ai_generated_files.bundle' to 'new_feature_branch', skipping any files that already exist
  node dogs.js ai_generated_files.bundle ./new_feature_branch -n

  # Extract 'malformed_bundle.txt' to the current directory, forcing interpretation as Base64 (ignoring headers)
  node dogs.js malformed_bundle.txt . -i b64
`);
}

/**
 * Main command-line interface function for dogs.js.
 * Handles argument parsing, bundle parsing, and file extraction.
 */
async function mainCliDogs() {
  try {
    const args = parseCliArgsDogs(process.argv);
    if (args.help) {
      printCliHelpDogs();
      process.exit(0);
    }

    // Determine bundle file path.
    if (args.bundleFile === null) {
      if (fs.existsSync(DEFAULT_INPUT_BUNDLE_FILENAME)) {
        args.bundleFile = DEFAULT_INPUT_BUNDLE_FILENAME;
        if (args.verbose)
          console.error(
            `Info: Defaulting to bundle file '${DEFAULT_INPUT_BUNDLE_FILENAME}'.`
          );
      } else {
        console.error(
          `Error: No bundle file specified and default '${DEFAULT_INPUT_BUNDLE_FILENAME}' not found.`
        );
        printCliHelpDogs();
        process.exit(1);
      }
    }
    const absBundlePath = path.resolve(args.bundleFile);
    try {
      if (
        !fs.existsSync(absBundlePath) ||
        !(await fs.promises.stat(absBundlePath)).isFile()
      ) {
        console.error(`Error: Bundle file not found: '${absBundlePath}'`);
        process.exit(1);
      }
    } catch (e) {
      console.error(
        `Error accessing bundle file '${absBundlePath}': ${e.message}`
      );
      process.exit(1);
    }

    // Determine original bundle path for delta.
    let absOriginalBundlePath = null;
    if (args.applyDelta) {
      absOriginalBundlePath = path.resolve(args.applyDelta);
      try {
        if (
          !fs.existsSync(absOriginalBundlePath) ||
          !(await fs.promises.stat(absOriginalBundlePath)).isFile()
        ) {
          console.error(
            `Error: Original bundle file for delta not found: '${absOriginalBundlePath}'`
          );
          process.exit(1);
        }
      } catch (e) {
        console.error(
          `Error accessing original bundle file '${absOriginalBundlePath}': ${e.message}`
        );
        process.exit(1);
      }
    }

    // Determine effective overwrite policy for non-interactive mode.
    let effectiveOverwritePolicy = args.overwrite;
    if (args.overwrite === "prompt" && !process.stdin.isTTY) {
      if (args.verbose)
        console.error(
          "Info: Non-interactive mode, 'prompt' defaults to 'no' for overwrite."
        );
      effectiveOverwritePolicy = "no";
    }

    // Preliminary parse for confirmation prompt and summary display.
    let numFilesPrelim = 0;
    let numDeltaFilesPrelim = 0;
    let numB64MarkedPrelim = 0;
    let prelimFormatDesc = "Parsing...";
    let bundleIsDeltaRefHint = false;

    try {
      const tempContent = await fs.promises.readFile(absBundlePath, {
        encoding: null,
      }); // Read as Buffer for encoding detection
      const decodedTempContent = tempContent.toString(DEFAULT_ENCODING); // Decode as UTF-8 for line splitting (safe for most headers)
      const {
        parsedFiles: pf,
        formatDescription: pd,
        bundleIsDeltaReference: bd,
        numB64Marked: nb,
      } = parseBundleContent(
        decodedTempContent.split(/\r?\n/),
        args.inputFormat === "auto" ? null : args.inputFormat,
        !!absOriginalBundlePath, // Check if delta mode is active for preliminary parse
        false // No verbose output for preliminary parse
      );
      numFilesPrelim = pf.length;
      numDeltaFilesPrelim = pf.filter((f) => f.hasDeltaCommands).length;
      numB64MarkedPrelim = nb;
      prelimFormatDesc = pd;
      bundleIsDeltaRefHint = bd;
    } catch (e) {
      // Ignore read/parse error here, main extract call will handle and report properly.
      // console.error(`Warning during preliminary parse: ${e.message}`);
    }

    // Display pre-extraction summary if in interactive 'prompt' mode.
    if (args.overwrite === "prompt" && process.stdin.isTTY) {
      console.error("\n--- Bundle Extraction Plan ---");
      console.error(`  Source Bundle:    '${absBundlePath}'`);
      console.error(`  Output Directory: '${path.resolve(args.outputDir)}'`);
      console.error(`  Detected Format:  ${prelimFormatDesc}`);
      if (args.inputFormat !== "auto") {
        console.error(
          `  Format Override:  Interpreting primary text as ${args.inputFormat.toUpperCase()}`
        );
      }
      if (bundleIsDeltaRefHint) {
        console.error(
          `  Delta Reference:  Bundle is marked as suitable for delta operations.`
        );
      }
      if (absOriginalBundlePath) {
        console.error(
          `  Original Bundle:  '${absOriginalBundlePath}' (for Delta Application)`
        );
      }
      console.error(
        `  Overwrite Policy: ${args.overwrite.replace(/^\w/, (c) =>
          c.toUpperCase()
        )}`
      );
      console.error(
        `  Files to process: ${numFilesPrelim}` +
          (numDeltaFilesPrelim > 0
            ? ` (${numDeltaFilesPrelim} with delta commands)`
            : "") +
          (numB64MarkedPrelim > 0
            ? ` (${numB64MarkedPrelim} marked Base64)`
            : "")
      );

      const rlConfirm = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        const proceed = await new Promise((resolve) =>
          rlConfirm.question("\nProceed with extraction? [Y/n]: ", (answer) => {
            rlConfirm.close();
            resolve(answer.trim().toLowerCase());
          })
        );
        if (proceed !== "y" && proceed !== "") {
          console.error("Extraction cancelled by user.");
          process.exit(0);
        }
      } finally {
        rlConfirm.close();
      }
    } else if (args.verbose) {
      // Print details for non-interactive verbose mode too.
      console.error("\n--- Extraction Details ---");
      console.error(`  Source Bundle:    '${absBundlePath}'`);
      console.error(`  Output Directory: '${path.resolve(args.outputDir)}'`);
      console.error(`  Detected Format:  ${prelimFormatDesc}`);
      if (args.inputFormat !== "auto")
        console.error(
          `  Format Override:  Will interpret as ${args.inputFormat}`
        );
      if (bundleIsDeltaRefHint)
        console.error(
          `  Delta Reference:  Bundle is marked as suitable for delta operations.`
        );
      if (absOriginalBundlePath)
        console.error(
          `  Original Bundle:  '${absOriginalBundlePath}' (for Delta Application)`
        );
      console.error(`  Overwrite Policy: ${effectiveOverwritePolicy}`);
      console.error(
        `  Files to process: ${numFilesPrelim}` +
          (numDeltaFilesPrelim > 0 ? ` (${numDeltaFilesPrelim} delta)` : "") +
          (numB64MarkedPrelim > 0 ? ` (${numB64MarkedPrelim} Base64)` : "")
      );
    }

    console.error("\nStarting extraction process...");
    const extractionResults = await extractToDiskNode({
      bundleFilePath: absBundlePath,
      outputDir: args.outputDir,
      overwritePolicy: effectiveOverwritePolicy,
      applyDeltaFromOriginalBundlePath: absOriginalBundlePath,
      inputFormat: args.inputFormat,
      verbose: args.verbose,
    });

    // Summarize results.
    const extractedCount = extractionResults.filter(
      (r) => r.status === "extracted"
    ).length;
    const skippedCount = extractionResults.filter(
      (r) => r.status === "skipped"
    ).length;
    const errorCount = extractionResults.filter(
      (r) => r.status === "error"
    ).length;
    console.error(`\n--- Extraction Summary ---`);
    console.error(`  Files Extracted: ${extractedCount}`);
    if (skippedCount > 0) console.error(`  Files Skipped:   ${skippedCount}`);
    if (errorCount > 0) console.error(`  Errors:          ${errorCount}`);

    // Inform if no content was successfully parsed.
    if (
      numFilesPrelim === 0 &&
      extractedCount === 0 &&
      skippedCount === 0 &&
      errorCount === 0
    ) {
      console.error("  No file content was found or parsed in the bundle.");
    }

    // Exit with error code if any errors occurred.
    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    // Provide help message for common argument parsing errors.
    if (
      error.message.includes("Unknown option") ||
      error.message.includes("requires a value") ||
      error.message.includes("Too many positional")
    ) {
      printCliHelpDogs();
    }
    process.exit(1);
  }
}

// Export high-level API functions for library usage.
module.exports = {
  extractToMemory,
  extractToDiskNode,
};

// If the script is run directly from the command line.
if (require.main === module) {
  mainCliDogs().catch((error) => {
    if (error.name === "AbortError") {
      // Catch specific readline abort, e.g., Ctrl+C during prompt
      console.error("\nOperation cancelled.");
      process.exit(130);
    } else {
      console.error(
        "\nAn unexpected critical error occurred in dogs.js main:",
        error
      );
      // In a real scenario, might want to print stack trace: console.error(error.stack);
      process.exit(1);
    }
  });
}
