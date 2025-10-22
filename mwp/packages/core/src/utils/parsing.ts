/**
 * Parsing Utilities
 *
 * Helper functions for parsing MWP data structures.
 */

import type { JSONSchema } from '../types/dependencies.js';

/**
 * Parsed URI Structure
 */
export interface ParsedURI {
  scheme: string;
  path: string;
  query?: Record<string, string>;
  fragment?: string;
}

/**
 * Parsed Event Name
 */
export interface ParsedEventName {
  namespace: string;
  category: string;
  action: string;
}

/**
 * Parsed Tool Schema
 */
export interface ParsedToolSchema {
  properties: Map<string, SchemaProperty>;
  required: Set<string>;
  additionalProperties: boolean;
}

/**
 * Schema Property
 */
export interface SchemaProperty {
  type: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: JSONSchema;
  properties?: Record<string, JSONSchema>;
}

/**
 * Parse resource URI
 *
 * @param uri - Resource URI (e.g., "file:///path/to/file", "github://user/repo/issues/123")
 * @returns Parsed URI components
 */
export function parseResourceURI(uri: string): ParsedURI {
  // Match URI pattern: scheme://path or scheme:path
  const match = uri.match(/^([a-z][a-z0-9+.-]*):\/?\/?(.*)$/i);

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid URI format: ${uri}`);
  }

  const scheme = match[1];
  const rest = match[2];

  // Split path, query, and fragment
  const fragmentIndex = rest.indexOf('#');
  const queryIndex = rest.indexOf('?');

  let path: string;
  let queryString: string | undefined;
  let fragment: string | undefined;

  if (fragmentIndex !== -1) {
    fragment = rest.slice(fragmentIndex + 1);
    if (queryIndex !== -1 && queryIndex < fragmentIndex) {
      queryString = rest.slice(queryIndex + 1, fragmentIndex);
      path = rest.slice(0, queryIndex);
    } else {
      path = rest.slice(0, fragmentIndex);
    }
  } else if (queryIndex !== -1) {
    queryString = rest.slice(queryIndex + 1);
    path = rest.slice(0, queryIndex);
  } else {
    path = rest;
  }

  // Parse query string
  const query = queryString
    ? Object.fromEntries(
        queryString.split('&').map(pair => {
          const [key, value] = pair.split('=');
          return [
            decodeURIComponent(key || ''),
            decodeURIComponent(value || ''),
          ];
        })
      )
    : undefined;

  return {
    scheme: scheme.toLowerCase(),
    path: decodeURIComponent(path),
    query,
    fragment: fragment ? decodeURIComponent(fragment) : undefined,
  };
}

/**
 * Build URI from components
 *
 * @param components - URI components
 * @returns URI string
 */
export function buildURI(components: ParsedURI): string {
  let uri = `${components.scheme}://${encodeURIComponent(components.path)}`;

  if (components.query && Object.keys(components.query).length > 0) {
    const queryString = Object.entries(components.query)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    uri += `?${queryString}`;
  }

  if (components.fragment) {
    uri += `#${encodeURIComponent(components.fragment)}`;
  }

  return uri;
}

/**
 * Parse event name
 *
 * @param eventName - Event name (e.g., "mcp:tool:invoked")
 * @returns Parsed event name components
 */
export function parseEventName(eventName: string): ParsedEventName {
  const parts = eventName.split(':');

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error(
      `Invalid event name format: ${eventName}. Expected format: namespace:category:action`
    );
  }

  return {
    namespace: parts[0],
    category: parts[1],
    action: parts[2],
  };
}

/**
 * Build event name from components
 *
 * @param components - Event name components
 * @returns Event name string
 */
export function buildEventName(components: ParsedEventName): string {
  return `${components.namespace}:${components.category}:${components.action}`;
}

/**
 * Parse JSON Schema into structured format
 *
 * @param schema - JSON Schema
 * @returns Parsed schema structure
 */
export function parseToolSchema(schema: JSONSchema): ParsedToolSchema {
  const properties = new Map<string, SchemaProperty>();
  const required = new Set<string>(schema.required || []);

  if (schema.properties) {
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      properties.set(name, parseSchemaProperty(propSchema));
    }
  }

  return {
    properties,
    required,
    additionalProperties: schema.additionalProperties !== false,
  };
}

/**
 * Parse individual schema property
 *
 * @param schema - Property schema
 * @returns Parsed property
 */
function parseSchemaProperty(schema: JSONSchema): SchemaProperty {
  return {
    type: schema.type || 'any',
    description: schema.description,
    default: schema.default,
    enum: schema.enum,
    format: schema.format as string | undefined,
    minimum: schema.minimum as number | undefined,
    maximum: schema.maximum as number | undefined,
    minLength: schema.minLength as number | undefined,
    maxLength: schema.maxLength as number | undefined,
    pattern: schema.pattern as string | undefined,
    items: schema.items as JSONSchema | undefined,
    properties: schema.properties as Record<string, JSONSchema> | undefined,
  };
}

/**
 * Parse package name
 *
 * @param packageName - Package name (e.g., "@mwp/widget-github")
 * @returns Parsed package components
 */
export function parsePackageName(packageName: string): {
  scope?: string;
  name: string;
} {
  const match = packageName.match(/^(@([^/]+)\/)?(.+)$/);

  if (!match || !match[3]) {
    throw new Error(`Invalid package name: ${packageName}`);
  }

  return {
    scope: match[2] || undefined,
    name: match[3],
  };
}

/**
 * Parse version range
 *
 * @param range - Version range (e.g., "^1.0.0", ">=1.2.3 <2.0.0")
 * @returns Parsed version constraints
 */
export function parseVersionRange(range: string): {
  operator?: string;
  version: string;
} {
  const match = range.match(/^([~^>=<]+)?(\d+\.\d+\.\d+.*)$/);

  if (!match || !match[2]) {
    throw new Error(`Invalid version range: ${range}`);
  }

  return {
    operator: match[1] || undefined,
    version: match[2],
  };
}

/**
 * Parse configuration key path
 *
 * @param keyPath - Dot-notation key path (e.g., "widget.github.token")
 * @returns Array of key segments
 */
export function parseConfigKeyPath(keyPath: string): string[] {
  return keyPath.split('.').filter(segment => segment.length > 0);
}

/**
 * Get nested value from object using key path
 *
 * @param obj - Object to traverse
 * @param keyPath - Dot-notation key path
 * @returns Value at key path, or undefined
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  keyPath: string
): unknown {
  const segments = parseConfigKeyPath(keyPath);
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Set nested value in object using key path
 *
 * @param obj - Object to modify
 * @param keyPath - Dot-notation key path
 * @param value - Value to set
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  keyPath: string,
  value: unknown
): void {
  const segments = parseConfigKeyPath(keyPath);
  let current = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;

    if (!(segment in current) || typeof current[segment] !== 'object') {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1]!;
  current[lastSegment] = value;
}

/**
 * Parse MIME type
 *
 * @param mimeType - MIME type string (e.g., "application/json; charset=utf-8")
 * @returns Parsed MIME type components
 */
export function parseMimeType(mimeType: string): {
  type: string;
  subtype: string;
  parameters: Record<string, string>;
} {
  const [typeSubtype, ...paramParts] = mimeType.split(';').map(s => s.trim());
  const [type, subtype] = (typeSubtype || '').split('/');

  if (!type || !subtype) {
    throw new Error(`Invalid MIME type: ${mimeType}`);
  }

  const parameters: Record<string, string> = {};
  for (const part of paramParts) {
    const [key, value] = part.split('=').map(s => s.trim());
    if (key && value) {
      parameters[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return {
    type,
    subtype,
    parameters,
  };
}

/**
 * Parse HTTP header value
 *
 * @param header - Header value
 * @returns Parsed header components
 */
export function parseHttpHeader(header: string): {
  value: string;
  parameters: Record<string, string>;
} {
  const [value, ...paramParts] = header.split(';').map(s => s.trim());

  const parameters: Record<string, string> = {};
  for (const part of paramParts) {
    const [key, val] = part.split('=').map(s => s.trim());
    if (key && val) {
      parameters[key] = val.replace(/^["']|["']$/g, '');
    }
  }

  return {
    value: value || '',
    parameters,
  };
}

/**
 * Parse duration string
 *
 * @param duration - Duration string (e.g., "5s", "10m", "1h", "2d")
 * @returns Duration in milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const [, value, unit] = match;
  const numValue = parseFloat(value!);

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return numValue * multipliers[unit!]!;
}

/**
 * Format duration as human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  if (ms < 60 * 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  if (ms < 60 * 60 * 1000) {
    return `${(ms / (60 * 1000)).toFixed(1)}m`;
  }

  if (ms < 24 * 60 * 60 * 1000) {
    return `${(ms / (60 * 60 * 1000)).toFixed(1)}h`;
  }

  return `${(ms / (24 * 60 * 60 * 1000)).toFixed(1)}d`;
}

/**
 * Parse byte size string
 *
 * @param size - Size string (e.g., "5KB", "10MB", "1GB")
 * @returns Size in bytes
 */
export function parseByteSize(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);

  if (!match) {
    throw new Error(`Invalid byte size format: ${size}`);
  }

  const [, value, unit = 'B'] = match;
  const numValue = parseFloat(value!);

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return Math.floor(numValue * multipliers[unit.toUpperCase()]!);
}

/**
 * Format byte size as human-readable string
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
