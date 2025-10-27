/**
 * Validation Utilities
 *
 * Helper functions for validating MWP data structures.
 */

import type { JSONSchema } from '../types/dependencies.js';
import Ajv from 'ajv';

/**
 * AJV instance for JSON Schema validation
 */
let ajvInstance: Ajv | null = null;

/**
 * Get or create AJV instance
 */
function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      validateFormats: true,
    });
  }
  return ajvInstance;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * Validation Error
 */
export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

/**
 * Validate data against JSON Schema
 *
 * @param data - Data to validate
 * @param schema - JSON Schema
 * @returns Validation result
 */
export function validateAgainstSchema(
  data: unknown,
  schema: JSONSchema
): ValidationResult {
  const ajv = getAjv();
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true };
  }

  const errors = (validate.errors || []).map(err => ({
    path: err.instancePath || '/',
    message: err.message || 'Validation failed',
    keyword: err.keyword,
    params: err.params,
  }));

  return { valid: false, errors };
}

/**
 * Validate tool arguments against input schema
 *
 * @param args - Tool arguments
 * @param schema - Tool input schema
 * @returns True if valid
 */
export function validateToolArguments(
  args: Record<string, unknown>,
  schema: JSONSchema
): boolean {
  const result = validateAgainstSchema(args, schema);
  return result.valid;
}

/**
 * Validate resource URI format
 *
 * @param uri - Resource URI
 * @returns True if valid URI format
 */
export function validateResourceURI(uri: string): boolean {
  // Basic URI validation
  // Format: scheme://path or scheme:path
  const uriRegex = /^[a-z][a-z0-9+.-]*:.+$/i;
  return uriRegex.test(uri);
}

/**
 * Validate custom element name
 *
 * @param name - Element name
 * @returns True if valid custom element name
 */
export function validateCustomElementName(name: string): boolean {
  // Must contain hyphen, start with lowercase letter, only lowercase and hyphens
  const regex = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
  return regex.test(name);
}

/**
 * Validate semantic version
 *
 * @param version - Version string
 * @returns True if valid semver
 */
export function validateSemver(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$/i;
  return semverRegex.test(version);
}

/**
 * Validate event name format
 *
 * @param eventName - Event name
 * @returns True if valid event name
 */
export function validateEventName(eventName: string): boolean {
  // Format: namespace:category:action (e.g., "mcp:tool:invoked")
  const eventRegex = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
  return eventRegex.test(eventName);
}

/**
 * Validate widget ID format
 *
 * @param id - Widget ID
 * @returns True if valid ID
 */
export function validateWidgetId(id: string): boolean {
  // Widget ID can be any non-empty string, but recommended format is kebab-case
  return id.length > 0 && id.length <= 100;
}

/**
 * Validate server name format
 *
 * @param name - Server name
 * @returns True if valid server name
 */
export function validateServerName(name: string): boolean {
  // Server name: lowercase letters, numbers, hyphens, underscores
  const regex = /^[a-z][a-z0-9_-]*$/;
  return regex.test(name) && name.length > 0 && name.length <= 100;
}

/**
 * Validate HTTP URL
 *
 * @param url - URL string
 * @returns True if valid HTTP/HTTPS URL
 */
export function validateHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate email address
 *
 * @param email - Email address
 * @returns True if valid email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate MIME type format
 *
 * @param mimeType - MIME type string
 * @returns True if valid MIME type
 */
export function validateMimeType(mimeType: string): boolean {
  const mimeRegex = /^[a-z]+\/[a-z0-9][a-z0-9._+-]*$/i;
  return mimeRegex.test(mimeType);
}

/**
 * Validate pattern matching (supports wildcards)
 *
 * @param pattern - Pattern with wildcards (*, **)
 * @param value - Value to test
 * @returns True if value matches pattern
 */
export function matchesPattern(pattern: string, value: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')  // Escape dots
    .replace(/\*\*/g, '§')  // Temporarily replace **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/§/g, '.*');    // ** matches anything including /

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(value);
}

/**
 * Validate if value matches any pattern in list
 *
 * @param patterns - Array of patterns
 * @param value - Value to test
 * @returns True if value matches any pattern
 */
export function matchesAnyPattern(patterns: string[], value: string): boolean {
  return patterns.some(pattern => matchesPattern(pattern, value));
}

/**
 * Check if object has required properties
 *
 * @param obj - Object to check
 * @param required - Required property names
 * @returns Validation result
 */
export function validateRequiredProperties(
  obj: Record<string, unknown>,
  required: string[]
): ValidationResult {
  const missing = required.filter(prop => !(prop in obj));

  if (missing.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: missing.map(prop => ({
      path: `/${prop}`,
      message: `Missing required property: ${prop}`,
      keyword: 'required',
    })),
  };
}

/**
 * Validate value is within range
 *
 * @param value - Numeric value
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns True if within range
 */
export function validateRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate array has valid length
 *
 * @param arr - Array to validate
 * @param minLength - Minimum length
 * @param maxLength - Maximum length (optional)
 * @returns True if length is valid
 */
export function validateArrayLength(
  arr: unknown[],
  minLength: number,
  maxLength?: number
): boolean {
  if (arr.length < minLength) return false;
  if (maxLength !== undefined && arr.length > maxLength) return false;
  return true;
}

/**
 * Validate string length
 *
 * @param str - String to validate
 * @param minLength - Minimum length
 * @param maxLength - Maximum length (optional)
 * @returns True if length is valid
 */
export function validateStringLength(
  str: string,
  minLength: number,
  maxLength?: number
): boolean {
  if (str.length < minLength) return false;
  if (maxLength !== undefined && str.length > maxLength) return false;
  return true;
}

/**
 * Sanitize string for safe display
 *
 * @param str - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if value is plain object
 *
 * @param value - Value to check
 * @returns True if plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Deep merge objects
 *
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    const targetValue = result[key];
    const sourceValue = source[key];

    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Clone object deeply
 *
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}
