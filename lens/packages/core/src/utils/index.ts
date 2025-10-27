/**
 * @mwp/core Utilities
 *
 * Re-exports all utility functions.
 */

// Validation utilities
export {
  validateAgainstSchema,
  validateToolArguments,
  validateResourceURI,
  validateCustomElementName,
  validateSemver,
  validateEventName,
  validateWidgetId,
  validateServerName,
  validateHttpUrl,
  validateEmail,
  validateMimeType,
  matchesPattern,
  matchesAnyPattern,
  validateRequiredProperties,
  validateRange,
  validateArrayLength,
  validateStringLength,
  sanitizeString,
  isPlainObject,
  deepMerge,
  deepClone,
} from './validation.js';

export type {
  ValidationResult,
  ValidationError,
} from './validation.js';

// Parsing utilities
export {
  parseResourceURI,
  buildURI,
  parseEventName,
  buildEventName,
  parseToolSchema,
  parsePackageName,
  parseVersionRange,
  parseConfigKeyPath,
  getNestedValue,
  setNestedValue,
  parseMimeType,
  parseHttpHeader,
  parseDuration,
  formatDuration,
  parseByteSize,
  formatByteSize,
} from './parsing.js';

export type {
  ParsedURI,
  ParsedEventName,
  ParsedToolSchema,
  SchemaProperty,
} from './parsing.js';

// Type guards
export {
  isToolResult,
  isToolContent,
  isResourceContent,
  isPromptMessages,
  isPromptMessage,
  isMCPServerInfo,
  isMCPTool,
  isMCPResource,
  isMCPPrompt,
  isJSONRPCRequest,
  isJSONRPCResponse,
  isJSONRPCError,
  isWidgetFactory,
  isWidgetAPI,
  isWidgetMetadata,
  isWidgetStatus,
  isResourceUsage,
  isErrorInfo,
  isError,
  isFunction,
  isPromise,
  isEmpty,
  assertDefined,
  assertType,
  isHTMLElement,
  isCustomElement,
  isValidURL,
  isValidJSON,
  isNotNull,
  isNotUndefined,
  isDefined,
} from './type-guards.js';

// Event name utilities
export {
  EventNamespace,
  EventCategory,
  matchesEventPattern,
  filterEventsByPattern,
  getToolEvents,
  getResourceEvents,
  getPromptEvents,
  getSamplingEvents,
  getServerEvents,
  getWidgetLifecycleEvents,
  getDashboardEvents,
  getAllMCPEvents,
  getAllWidgetEvents,
  getAllEvents,
  isRequestEvent,
  isErrorEvent,
  isLifecycleEvent,
  isListChangedEvent,
  getCompletionEvent,
  getErrorEvent,
  createEventValidator,
  groupEventsByCategory,
  groupEventsByNamespace,
  getEventDescription,
} from './event-names.js';
