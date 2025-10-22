/**
 * Fetch Widget Types
 */

/**
 * Fetch Widget Configuration
 */
export interface FetchWidgetConfig {
  /** Default raw mode */
  defaultRaw?: boolean;

  /** Default max content length */
  defaultMaxLength?: number;

  /** Enable syntax highlighting */
  syntaxHighlight?: boolean;

  /** Word wrap in content view */
  wordWrap?: boolean;

  /** Show line numbers */
  showLineNumbers?: boolean;

  /** Maximum history items */
  maxHistoryItems?: number;

  /** Save fetch history */
  saveHistory?: boolean;

  /** Auto-refresh content */
  autoRefresh?: boolean;

  /** Auto-refresh interval (ms) */
  refreshInterval?: number;

  /** Export format */
  exportFormat?: 'html' | 'text' | 'markdown';
}

/**
 * Fetch Request
 */
export interface FetchRequest {
  /** URL to fetch */
  url: string;

  /** Maximum content length */
  maxLength?: number;

  /** Start index for partial fetch */
  startIndex?: number;

  /** Return raw content */
  raw?: boolean;
}

/**
 * HTML Fetch Request
 */
export interface HTMLFetchRequest {
  /** URL to fetch */
  url: string;

  /** CSS selector for extraction */
  selector?: string;

  /** Maximum content length */
  maxLength?: number;
}

/**
 * Fetch Result
 */
export interface FetchResult {
  /** Fetched content */
  content: string;

  /** Content type */
  contentType: string;

  /** Content size (bytes) */
  size: number;

  /** Fetch timestamp */
  timestamp: Date;

  /** Source URL */
  url: string;

  /** Selector used (if HTML fetch) */
  selector?: string;

  /** Whether content is raw */
  raw: boolean;
}

/**
 * Fetch History Item
 */
export interface FetchHistoryItem {
  /** History item ID */
  id: string;

  /** Fetch request */
  request: FetchRequest | HTMLFetchRequest;

  /** Fetch result */
  result: FetchResult;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Content Display Options
 */
export interface ContentDisplayOptions {
  /** Syntax highlighting */
  highlight: boolean;

  /** Word wrap */
  wordWrap: boolean;

  /** Line numbers */
  lineNumbers: boolean;

  /** Max lines to display */
  maxLines?: number;
}

/**
 * Export Options
 */
export interface ExportOptions {
  /** Export format */
  format: 'html' | 'text' | 'markdown';

  /** Include metadata */
  includeMetadata?: boolean;

  /** Filename */
  filename?: string;
}
