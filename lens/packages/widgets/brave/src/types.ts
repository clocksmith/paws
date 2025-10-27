/**
 * Brave Search Widget Types
 */

/**
 * Brave Widget Configuration
 */
export interface BraveWidgetConfig {
  /** Default number of results */
  defaultCount?: number;

  /** Default safe search setting */
  defaultSafesearch?: 'off' | 'moderate' | 'strict';

  /** Show result snippets */
  showSnippets?: boolean;

  /** Show thumbnails for image results */
  showThumbnails?: boolean;

  /** Show metadata (date, author, etc.) */
  showMetadata?: boolean;

  /** Maximum history items to keep */
  maxHistoryItems?: number;

  /** Save search history */
  saveHistory?: boolean;

  /** Use compact display mode */
  compactMode?: boolean;

  /** Highlight search keywords in results */
  highlightKeywords?: boolean;

  /** Open links in new tab */
  openLinksInNewTab?: boolean;

  /** Show related searches */
  showRelatedSearches?: boolean;
}

/**
 * Search Filters
 */
export interface SearchFilters {
  /** Search type */
  type?: 'all' | 'images' | 'news' | 'videos';

  /** Date filter */
  freshness?: 'day' | 'week' | 'month' | 'year';

  /** Safe search level */
  safesearch?: 'off' | 'moderate' | 'strict';

  /** Results per page */
  count?: number;

  /** Pagination offset */
  offset?: number;

  /** Country/region code */
  country?: string;
}

/**
 * Search Result
 */
export interface SearchResult {
  /** Result position */
  position: number;

  /** Page title */
  title: string;

  /** Page URL */
  url: string;

  /** Result snippet/description */
  snippet: string;

  /** Thumbnail URL (for images/videos) */
  thumbnail?: string;

  /** Metadata */
  metadata?: {
    /** Publication date */
    date?: Date;

    /** Author/source */
    author?: string;

    /** Language */
    language?: string;
  };
}

/**
 * Search Response
 */
export interface SearchResponse {
  /** Search query */
  query: string;

  /** Result items */
  results: SearchResult[];

  /** Total result count */
  totalResults: number;

  /** Current page */
  page: number;

  /** Total pages */
  totalPages: number;

  /** Related searches */
  relatedSearches?: string[];

  /** Search timestamp */
  timestamp: Date;
}

/**
 * Search History Entry
 */
export interface SearchHistory {
  /** Unique ID */
  id: string;

  /** Search query */
  query: string;

  /** Applied filters */
  filters: SearchFilters;

  /** Result count */
  resultCount: number;

  /** Timestamp */
  timestamp: Date;
}
