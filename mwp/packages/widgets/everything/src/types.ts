import type { MCPPrompt, MCPResource, MCPTool } from '@mcp-wp/core';

export type EverythingTab = 'overview' | 'tools' | 'resources' | 'prompts' | 'search';

export interface DesktopSearchFilters {
  rootPaths: string[];
  fileTypes: string[];
  includeHidden: boolean;
  matchCase: boolean;
  maxResults: number;
  modifiedAfter?: string;
  modifiedBefore?: string;
}

export interface DesktopFileMetadata {
  path: string;
  name: string;
  extension: string;
  type: 'file' | 'directory';
  sizeInBytes?: number;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  icon?: string;
}

export interface SearchSnippetSegment {
  text: string;
  highlight: boolean;
  lineNumber?: number;
}

export interface DesktopSearchResult {
  id: string;
  score: number;
  metadata: DesktopFileMetadata;
  snippet: SearchSnippetSegment[];
  resourceUri?: string;
}

export interface ResourcePreviewState {
  metadata?: DesktopFileMetadata;
  snippet?: SearchSnippetSegment[];
  rawContent?: string;
  loading: boolean;
  error: string | null;
}

export interface SearchExecutionState {
  query: string;
  filters: DesktopSearchFilters;
  debounceMs: number;
  lastExecutedQuery?: string;
  searching: boolean;
  results: DesktopSearchResult[];
  selectedResult?: DesktopSearchResult | null;
  preview: ResourcePreviewState;
}

export interface EverythingState {
  loading: boolean;
  error: string | null;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  activeTab: EverythingTab;
  lastUpdated?: Date;
  search: SearchExecutionState;
}
