// Standardized Error Handling for REPLOID
// ES6 module - automatically in strict mode

/**
 * Standard error structure for consistent error handling
 */
export class ReploidError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = 'ReploidError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReploidError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Standard error codes for consistency
 */
export const ErrorCodes = {
  // Module errors
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
  MODULE_LOAD_FAILED: 'MODULE_LOAD_FAILED',
  MODULE_INIT_FAILED: 'MODULE_INIT_FAILED',
  DEPENDENCY_FAILED: 'DEPENDENCY_FAILED',
  
  // API errors
  API_REQUEST_FAILED: 'API_REQUEST_FAILED',
  API_RESPONSE_INVALID: 'API_RESPONSE_INVALID',
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  
  // Storage errors
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  
  // DOM errors
  DOM_ELEMENT_NOT_FOUND: 'DOM_ELEMENT_NOT_FOUND',
  DOM_OPERATION_FAILED: 'DOM_OPERATION_FAILED',
  
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  
  // System errors
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  STATE_CORRUPTED: 'STATE_CORRUPTED'
};

/**
 * Standard try-catch wrapper for async functions
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error reporting
 * @param {Object} defaultValue - Default value to return on error
 * @returns {Promise<any>}
 */
export async function tryAsync(fn, context = 'Unknown', defaultValue = null) {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return defaultValue;
  }
}

/**
 * Standard try-catch wrapper for sync functions
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context for error reporting
 * @param {Object} defaultValue - Default value to return on error
 * @returns {any}
 */
export function trySync(fn, context = 'Unknown', defaultValue = null) {
  try {
    return fn();
  } catch (error) {
    handleError(error, context);
    return defaultValue;
  }
}

/**
 * Standard error handler with logging
 * @param {Error} error - Error to handle
 * @param {string} context - Context where error occurred
 * @param {boolean} rethrow - Whether to rethrow the error
 */
export function handleError(error, context = 'Unknown', rethrow = false) {
  // Convert to ReploidError if needed
  const reploidError = error instanceof ReploidError 
    ? error 
    : new ReploidError(
        error.message || 'Unknown error',
        ErrorCodes.SYSTEM_ERROR,
        { originalError: error, context }
      );

  // Log error with context
  console.error(`[${context}] Error occurred:`, {
    message: reploidError.message,
    code: reploidError.code,
    details: reploidError.details,
    timestamp: new Date(reploidError.timestamp).toISOString()
  });

  // Log stack trace in development
  if (reploidError.stack) {
    console.debug('Stack trace:', reploidError.stack);
  }

  // Store error in session for debugging
  storeError(reploidError);

  // Rethrow if requested
  if (rethrow) {
    throw reploidError;
  }

  return reploidError;
}

/**
 * Store error for debugging purposes
 * @param {ReploidError} error - Error to store
 */
function storeError(error) {
  try {
    const errors = JSON.parse(sessionStorage.getItem('reploid_errors') || '[]');
    errors.push(error.toJSON());
    
    // Keep only last 50 errors
    if (errors.length > 50) {
      errors.shift();
    }
    
    sessionStorage.setItem('reploid_errors', JSON.stringify(errors));
  } catch (e) {
    // Silently fail if storage is full or unavailable
    console.debug('Failed to store error:', e);
  }
}

/**
 * Get stored errors for debugging
 * @returns {Array} Array of stored errors
 */
export function getStoredErrors() {
  try {
    return JSON.parse(sessionStorage.getItem('reploid_errors') || '[]');
  } catch (error) {
    return [];
  }
}

/**
 * Clear stored errors
 */
export function clearStoredErrors() {
  try {
    sessionStorage.removeItem('reploid_errors');
  } catch (error) {
    console.debug('Failed to clear errors:', error);
  }
}

/**
 * Wrap a module factory with error handling
 * @param {string} moduleName - Name of the module
 * @param {Function} factory - Module factory function
 * @returns {Function} Wrapped factory
 */
export function wrapModuleFactory(moduleName, factory) {
  return async (deps) => {
    try {
      const result = await factory(deps);
      console.log(`[${moduleName}] Module initialized successfully`);
      return result;
    } catch (error) {
      throw new ReploidError(
        `Failed to initialize module: ${moduleName}`,
        ErrorCodes.MODULE_INIT_FAILED,
        { moduleName, error: error.message, dependencies: Object.keys(deps || {}) }
      );
    }
  };
}

/**
 * Validate required parameters
 * @param {Object} params - Parameters to validate
 * @param {Array<string>} required - Required parameter names
 * @param {string} context - Context for error reporting
 * @throws {ReploidError} If validation fails
 */
export function validateParams(params, required, context = 'Unknown') {
  const missing = required.filter(key => params[key] === undefined || params[key] === null);
  
  if (missing.length > 0) {
    throw new ReploidError(
      `Missing required parameters: ${missing.join(', ')}`,
      ErrorCodes.INVALID_PARAMETER,
      { missing, context, provided: Object.keys(params) }
    );
  }
}

/**
 * Create an error boundary for DOM operations
 * @param {Function} operation - DOM operation to perform
 * @param {string} elementId - Element ID for context
 * @param {any} fallback - Fallback value on error
 * @returns {any} Result or fallback
 */
export function domErrorBoundary(operation, elementId, fallback = null) {
  try {
    return operation();
  } catch (error) {
    handleError(
      new ReploidError(
        `DOM operation failed for element: ${elementId}`,
        ErrorCodes.DOM_OPERATION_FAILED,
        { elementId, originalError: error.message }
      ),
      'DOM Operation'
    );
    return fallback;
  }
}

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - Operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in ms
 * @param {string} context - Context for error reporting
 * @returns {Promise<any>} Result of operation
 */
export async function retryWithBackoff(
  operation,
  maxRetries = 3,
  initialDelay = 1000,
  context = 'Unknown'
) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[${context}] Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new ReploidError(
    `Operation failed after ${maxRetries} attempts`,
    ErrorCodes.SYSTEM_ERROR,
    { context, attempts: maxRetries, lastError: lastError?.message }
  );
}

// Export default object with all utilities
export default {
  ReploidError,
  ErrorCodes,
  tryAsync,
  trySync,
  handleError,
  getStoredErrors,
  clearStoredErrors,
  wrapModuleFactory,
  validateParams,
  domErrorBoundary,
  retryWithBackoff
};