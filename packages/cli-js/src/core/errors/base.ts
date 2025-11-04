/**
 * Base error class for all PAWS errors
 * Provides consistent error handling with codes, context, and recovery suggestions
 */
export abstract class PawsError extends Error {
  /** Unique error code (e.g., PAWS-001) */
  public readonly code: string;

  /** Additional context about the error */
  public readonly context?: Record<string, any>;

  /** Suggested recovery actions */
  public readonly recoverySuggestions: string[];

  /** Whether this error is retryable */
  public readonly retryable: boolean;

  /** Original error if this wraps another error */
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    options?: {
      context?: Record<string, any>;
      recoverySuggestions?: string[];
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = options?.context;
    this.recoverySuggestions = options?.recoverySuggestions || [];
    this.retryable = options?.retryable || false;
    this.cause = options?.cause;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Format error for user display
   */
  toUserString(): string {
    let output = `[${this.code}] ${this.message}`;

    if (this.recoverySuggestions.length > 0) {
      output += '\n\nSuggested actions:';
      this.recoverySuggestions.forEach((suggestion, i) => {
        output += `\n  ${i + 1}. ${suggestion}`;
      });
    }

    return output;
  }

  /**
   * Format error for logging (includes context)
   */
  toLogObject(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      retryable: this.retryable,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
      } : undefined,
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends PawsError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, any>;
      recoverySuggestions?: string[];
      cause?: Error;
    }
  ) {
    super(message, 'PAWS-CONFIG', {
      ...options,
      retryable: false,
    });
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends PawsError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, any>;
      recoverySuggestions?: string[];
      cause?: Error;
      retryable?: boolean;
    }
  ) {
    super(message, 'PAWS-NETWORK', {
      ...options,
      retryable: options?.retryable ?? true, // Network errors are generally retryable
    });
  }
}

/**
 * API-related errors (AI providers, external services)
 */
export class APIError extends PawsError {
  public readonly statusCode?: number;
  public readonly provider?: string;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      provider?: string;
      context?: Record<string, any>;
      recoverySuggestions?: string[];
      cause?: Error;
      retryable?: boolean;
    }
  ) {
    super(message, 'PAWS-API', {
      ...options,
      context: {
        ...options?.context,
        statusCode: options?.statusCode,
        provider: options?.provider,
      },
      retryable: options?.retryable ?? isRetryableStatusCode(options?.statusCode),
    });

    this.statusCode = options?.statusCode;
    this.provider = options?.provider;
  }
}

/**
 * File system errors
 */
export class FileSystemError extends PawsError {
  public readonly path?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    options?: {
      path?: string;
      operation?: string;
      context?: Record<string, any>;
      recoverySuggestions?: string[];
      cause?: Error;
    }
  ) {
    super(message, 'PAWS-FS', {
      ...options,
      context: {
        ...options?.context,
        path: options?.path,
        operation: options?.operation,
      },
      retryable: false,
    });

    this.path = options?.path;
    this.operation = options?.operation;
  }
}

/**
 * Git operation errors
 */
export class GitError extends PawsError {
  public readonly command?: string;

  constructor(
    message: string,
    options?: {
      command?: string;
      context?: Record<string, any>;
      recoverySuggestions?: string[];
      cause?: Error;
    }
  ) {
    super(message, 'PAWS-GIT', {
      ...options,
      context: {
        ...options?.context,
        command: options?.command,
      },
      retryable: false,
    });

    this.command = options?.command;
  }
}

/**
 * Validation errors (user input, config validation, etc.)
 */
export class ValidationError extends PawsError {
  public readonly field?: string;

  constructor(
    message: string,
    options?: {
      field?: string;
      context?: Record<string, any>;
      recoverySuggestions?: string[];
    }
  ) {
    super(message, 'PAWS-VALIDATION', {
      ...options,
      context: {
        ...options?.context,
        field: options?.field,
      },
      retryable: false,
    });

    this.field = options?.field;
  }
}

/**
 * Session management errors
 */
export class SessionError extends PawsError {
  public readonly sessionId?: string;

  constructor(
    message: string,
    options?: {
      sessionId?: string;
      context?: Record<string, any>;
      recoverySuggestions?: string[];
      cause?: Error;
    }
  ) {
    super(message, 'PAWS-SESSION', {
      ...options,
      context: {
        ...options?.context,
        sessionId: options?.sessionId,
      },
      retryable: false,
    });

    this.sessionId = options?.sessionId;
  }
}

/**
 * Cost tracking errors
 */
export class CostTrackingError extends PawsError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, any>;
      recoverySuggestions?: string[];
      cause?: Error;
    }
  ) {
    super(message, 'PAWS-COST', {
      ...options,
      retryable: false,
    });
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends PawsError {
  public readonly timeoutMs: number;

  constructor(
    message: string,
    timeoutMs: number,
    options?: {
      context?: Record<string, any>;
      recoverySuggestions?: string[];
    }
  ) {
    super(message, 'PAWS-TIMEOUT', {
      ...options,
      context: {
        ...options?.context,
        timeoutMs,
      },
      retryable: true,
    });

    this.timeoutMs = timeoutMs;
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends PawsError {
  public readonly retryAfter?: number; // seconds

  constructor(
    message: string,
    options?: {
      retryAfter?: number;
      context?: Record<string, any>;
      recoverySuggestions?: string[];
    }
  ) {
    super(message, 'PAWS-RATELIMIT', {
      ...options,
      context: {
        ...options?.context,
        retryAfter: options?.retryAfter,
      },
      retryable: true,
    });

    this.retryAfter = options?.retryAfter;
  }
}

/**
 * Determine if an HTTP status code indicates a retryable error
 */
function isRetryableStatusCode(statusCode?: number): boolean {
  if (!statusCode) return false;

  // 429 Too Many Requests
  if (statusCode === 429) return true;

  // 5xx Server Errors (except 501 Not Implemented)
  if (statusCode >= 500 && statusCode < 600 && statusCode !== 501) return true;

  // 408 Request Timeout
  if (statusCode === 408) return true;

  return false;
}

/**
 * Type guard to check if error is a PawsError
 */
export function isPawsError(error: unknown): error is PawsError {
  return error instanceof PawsError;
}

/**
 * Wrap a non-PAWS error into a PAWS error
 */
export function wrapError(error: unknown, context?: string): PawsError {
  if (isPawsError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new PawsError(
    context ? `${context}: ${message}` : message,
    'PAWS-UNKNOWN',
    { cause }
  );
}
