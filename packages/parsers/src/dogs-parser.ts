/**
 * @paws/parsers - Dogs Bundle Parser
 *
 * Shared parsing logic for DOGS bundle format.
 * Can be used by both Node.js (PAWS CLI) and browser (REPLOID).
 */

/**
 * File operation types
 */
const FileOperation = {
  CREATE: 'CREATE' as const,
  MODIFY: 'MODIFY' as const,
  DELETE: 'DELETE' as const
};

export type FileOperationType = typeof FileOperation[keyof typeof FileOperation];

/**
 * Regex patterns for parsing DOGS bundles
 */
const DOGS_MARKER_REGEX = /🐕 --- DOGS_(START|END)_FILE:\s*(.+?)(\s*\(Content:Base64\))?\s*---/;
const CATS_MARKER_REGEX = /🐈 --- CATS_(START|END)_FILE:\s*(.+?)(\s*\(Content:Base64\))?\s*---/;
const PAWS_CMD_REGEX = /@@\s*PAWS_CMD\s+(.+?)\s*@@/;
const DELETE_FILE_REGEX = /DELETE_FILE\(\s*\)/i;

/**
 * Delta command patterns
 */
const DELTA_PATTERNS = {
  REPLACE_LINES: /REPLACE_LINES\((\d+),\s*(\d+)\)/i,
  INSERT_AFTER_LINE: /INSERT_AFTER_LINE\((\d+)\)/i,
  DELETE_LINES: /DELETE_LINES\((\d+),\s*(\d+)\)/i,
  DELETE_FILE: /DELETE_FILE\(\s*\)/i,
  REQUEST_CONTEXT: /REQUEST_CONTEXT\(\s*\)/i,
  EXECUTE_AND_REINVOKE: /EXECUTE_AND_REINVOKE\((.+)\)/i
};

/**
 * Delta command object
 */
interface DeltaCommand {
  type: string;
  match: string;
  args: string[];
}

/**
 * Represents a single file change
 */
class ParsedFileChange {
  public filePath: string;
  public operation: FileOperationType;
  public content: string | null;
  public oldContent: string | null;
  public isBinary: boolean;
  public deltaCommands: DeltaCommand[] | null;

  constructor(
    filePath: string,
    operation: FileOperationType,
    content: string | null,
    oldContent: string | null = null,
    isBinary: boolean = false,
    deltaCommands: DeltaCommand[] | null = null
  ) {
    this.filePath = filePath;
    this.operation = operation;
    this.content = content;
    this.oldContent = oldContent;
    this.isBinary = isBinary;
    this.deltaCommands = deltaCommands;
  }
}

/**
 * Collection of parsed changes
 */
class ParsedChangeSet {
  public changes: ParsedFileChange[];

  constructor() {
    this.changes = [];
  }

  addChange(change: ParsedFileChange): void {
    this.changes.push(change);
  }

  getChanges(): ParsedFileChange[] {
    return this.changes;
  }
}

/**
 * Core parser for DOGS bundle format
 */
class DogsParser {
  /**
   * Parse bundle content into structured changes
   */
  static parse(bundleContent: string): ParsedChangeSet {
    const changeSet = new ParsedChangeSet();
    const lines = bundleContent.split('\n');

    let inFile = false;
    let currentFile: string | null = null;
    let currentContent: string[] = [];
    let isBinary = false;

    for (const line of lines) {
      // Try DOGS marker first, then CATS marker
      let match = DOGS_MARKER_REGEX.exec(line);
      if (!match) {
        match = CATS_MARKER_REGEX.exec(line);
      }

      if (match) {
        if (match[1].toUpperCase() === 'START') {
          inFile = true;
          currentFile = match[2].trim();
          isBinary = Boolean(match[3]);
          currentContent = [];
        } else if (match[1].toUpperCase() === 'END' && inFile) {
          const change = DogsParser.processFile(currentFile!, currentContent, isBinary);
          if (change) {
            changeSet.addChange(change);
          }
          inFile = false;
          currentFile = null;
        }
      } else if (inFile) {
        currentContent.push(line);
      }
    }

    return changeSet;
  }

  /**
   * Process a single file's content into a change object
   */
  static processFile(
    filePath: string,
    contentLines: string[],
    isBinary: boolean
  ): ParsedFileChange | null {
    // Clean up content
    contentLines = DogsParser.cleanContent(contentLines);

    // Check for DELETE_FILE command
    const contentStr = contentLines.join('\n');
    if (PAWS_CMD_REGEX.test(contentStr)) {
      const match = contentStr.match(PAWS_CMD_REGEX);
      if (match && DELETE_FILE_REGEX.test(match[1])) {
        return new ParsedFileChange(
          filePath,
          FileOperation.DELETE,
          null,
          null,
          isBinary
        );
      }
    }

    // Check for delta commands
    const deltaCommands = DogsParser.extractDeltaCommands(contentStr);
    if (deltaCommands.length > 0) {
      return new ParsedFileChange(
        filePath,
        FileOperation.MODIFY,
        contentStr,
        null,
        isBinary,
        deltaCommands
      );
    }

    // Binary content
    if (isBinary) {
      return new ParsedFileChange(
        filePath,
        FileOperation.MODIFY,
        contentStr,
        null,
        true
      );
    }

    // Remove code fence markers if present
    let finalContent = contentStr;
    const codeFencePattern = /^```[\w]*\n([\s\S]*?)\n```$/;
    const codeFenceMatch = contentStr.match(codeFencePattern);
    if (codeFenceMatch) {
      finalContent = codeFenceMatch[1];
    }

    // Determine operation (CREATE vs MODIFY will be determined by caller checking file existence)
    return new ParsedFileChange(
      filePath,
      FileOperation.MODIFY, // Caller will adjust based on file existence
      finalContent,
      null,
      false
    );
  }

  /**
   * Clean content lines (remove leading/trailing blank lines, code fences)
   */
  static cleanContent(lines: string[]): string[] {
    // Remove leading blank lines
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }

    // Remove trailing blank lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }

    // Remove code fence markers
    if (lines.length >= 2) {
      const firstLine = lines[0].trim();
      const lastLine = lines[lines.length - 1].trim();

      if (firstLine.startsWith('```') && lastLine === '```') {
        lines.shift(); // Remove opening fence
        lines.pop();   // Remove closing fence
      }
    }

    return lines;
  }

  /**
   * Extract delta commands from content
   */
  static extractDeltaCommands(content: string): DeltaCommand[] {
    const commands: DeltaCommand[] = [];

    for (const [cmdName, pattern] of Object.entries(DELTA_PATTERNS)) {
      const matches = content.matchAll(new RegExp(pattern.source, 'gi'));
      for (const match of matches) {
        commands.push({
          type: cmdName,
          match: match[0],
          args: Array.from(match.slice(1))
        });
      }
    }

    return commands;
  }

  /**
   * Detect if content is likely binary based on markers
   */
  static isBinaryContent(content: string): boolean {
    // Check for Base64 marker
    if (content.includes('(Content:Base64)')) {
      return true;
    }

    // Check for high ratio of non-printable characters
    const nonPrintable = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
    if (nonPrintable && nonPrintable.length > content.length * 0.3) {
      return true;
    }

    return false;
  }
}

// Export for Node.js (CommonJS)
module.exports = {
  DogsParser,
  ParsedFileChange,
  ParsedChangeSet,
  FileOperation,
  DOGS_MARKER_REGEX,
  CATS_MARKER_REGEX,
  PAWS_CMD_REGEX,
  DELETE_FILE_REGEX,
  DELTA_PATTERNS
};

// Also export as ES modules for TypeScript consumers
export {
  DogsParser,
  ParsedFileChange,
  ParsedChangeSet,
  FileOperation,
  DOGS_MARKER_REGEX,
  CATS_MARKER_REGEX,
  PAWS_CMD_REGEX,
  DELETE_FILE_REGEX,
  DELTA_PATTERNS
};

// Export for browser (global)
declare global {
  interface Window {
    DogsParser: typeof DogsParser;
    ParsedFileChange: typeof ParsedFileChange;
    ParsedChangeSet: typeof ParsedChangeSet;
    FileOperation: typeof FileOperation;
  }
}

if (typeof window !== 'undefined') {
  window.DogsParser = DogsParser;
  window.ParsedFileChange = ParsedFileChange;
  window.ParsedChangeSet = ParsedChangeSet;
  window.FileOperation = FileOperation;
}
