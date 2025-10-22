import type { MCPPrompt, MCPResource, MCPTool } from '@mcp-wp/core';

export type SupabaseView = 'overview' | 'schema' | 'query' | 'realtime' | 'metrics';

export interface SupabaseColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
}

export interface SupabaseRLSPolicy {
  name: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  definition?: string;
  check?: string;
  enabled: boolean;
}

export interface SupabaseTableDefinition {
  name: string;
  schema: string;
  rowCount?: number;
  sizeBytes?: number;
  columns: SupabaseColumn[];
  policies: SupabaseRLSPolicy[];
  rows?: Array<Record<string, unknown>>;
}

export interface SupabaseSchemaOverview {
  schemas: string[];
  tables: SupabaseTableDefinition[];
}

export interface SupabaseQueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs?: number;
}

export interface SupabaseQueryState {
  sql: string;
  parameters: Record<string, string>;
  executing: boolean;
  error: string | null;
  lastResult?: SupabaseQueryResult;
  lastExecutedAt?: Date;
}

export interface SupabaseRealtimeMessage {
  table: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SupabaseMetricsSnapshot {
  activeConnections: number;
  averageLatencyMs: number;
  throughputPerMinute: number;
  replicationLagMs: number;
}

export interface SupabaseFilters {
  schema: string;
  search: string;
}

export interface SupabaseState {
  loading: boolean;
  error: string | null;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  view: SupabaseView;
  lastUpdated?: Date;
  schema: SupabaseSchemaOverview;
  selectedTable?: SupabaseTableDefinition | null;
  filters: SupabaseFilters;
  query: SupabaseQueryState;
  realtimeMessages: SupabaseRealtimeMessage[];
  metrics: SupabaseMetricsSnapshot;
  liveSubscriptionId?: string | null;
}
