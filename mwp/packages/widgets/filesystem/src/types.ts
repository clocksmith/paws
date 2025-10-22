/**
 * Filesystem Widget Types
 */

/**
 * Filesystem Widget Configuration
 */
export interface FilesystemWidgetConfig {
  /** Initial directory to show */
  initialPath?: string;

  /** Show hidden files (starting with .) */
  showHidden?: boolean;

  /** File size format */
  fileSizeFormat?: 'human' | 'bytes';

  /** Editor settings */
  editor?: {
    tabSize?: number;
    insertSpaces?: boolean;
    lineNumbers?: boolean;
    syntaxHighlighting?: boolean;
  };

  /** Custom file type icons */
  fileIcons?: Record<string, string>;

  /** Confirm before delete */
  confirmDelete?: boolean;

  /** Max file size to open in editor (bytes) */
  maxFileSize?: number;
}

/**
 * File Entry
 */
export interface FileEntry {
  name: string;
  path: string;
  type: 'file';
  size: number;
  extension: string;
  modified: Date;
  permissions?: string;
  icon?: string;
}

/**
 * Directory Entry
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'directory';
  modified: Date;
  permissions?: string;
  children?: Entry[];
}

/**
 * Entry (file or directory)
 */
export type Entry = FileEntry | DirectoryEntry;

/**
 * File Content
 */
export interface FileContent {
  path: string;
  content: string;
  size: number;
  encoding?: string;
}

/**
 * Search Result
 */
export interface SearchResult {
  path: string;
  type: 'file' | 'directory';
  matches?: number;
  preview?: string;
}

/**
 * Breadcrumb
 */
export interface Breadcrumb {
  name: string;
  path: string;
}
