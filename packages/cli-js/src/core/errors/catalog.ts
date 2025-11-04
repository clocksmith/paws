/**
 * Error catalog with predefined error codes, messages, and recovery suggestions
 */

import {
  ConfigError,
  NetworkError,
  APIError,
  FileSystemError,
  GitError,
  ValidationError,
  SessionError,
  CostTrackingError,
  TimeoutError,
  RateLimitError,
} from './base';

/**
 * Error factory functions for common scenarios
 */
export const ErrorCatalog = {
  // Configuration errors
  config: {
    fileNotFound: (path: string) =>
      new ConfigError(`Configuration file not found: ${path}`, {
        context: { path },
        recoverySuggestions: [
          `Run 'paws config init' to create a default configuration`,
          `Create ${path} manually with valid configuration`,
          `Check if you're in the correct directory`,
        ],
      }),

    invalidJson: (path: string, cause?: Error) =>
      new ConfigError(`Invalid JSON in configuration file: ${path}`, {
        context: { path },
        cause,
        recoverySuggestions: [
          'Validate JSON syntax using a linter or editor',
          'Check for trailing commas or missing quotes',
          'Restore from backup if available',
        ],
      }),

    validationFailed: (errors: string[]) =>
      new ConfigError(`Configuration validation failed:\n${errors.join('\n')}`, {
        context: { validationErrors: errors },
        recoverySuggestions: [
          'Review the configuration schema documentation',
          'Fix the validation errors listed above',
          'Run with --verbose to see detailed validation output',
        ],
      }),

    missingApiKey: (provider: string) =>
      new ConfigError(`Missing API key for provider: ${provider}`, {
        context: { provider },
        recoverySuggestions: [
          `Set ${provider.toUpperCase()}_API_KEY environment variable`,
          `Add apiKey in .pawsrc.json under providers.${provider}`,
          `Run 'paws config set providers.${provider}.apiKey YOUR_KEY'`,
        ],
      }),

    profileNotFound: (profile: string) =>
      new ConfigError(`Configuration profile not found: ${profile}`, {
        context: { profile },
        recoverySuggestions: [
          `List available profiles with 'paws config list-profiles'`,
          `Create profile with 'paws config create-profile ${profile}'`,
          'Check for typos in profile name',
        ],
      }),
  },

  // Network errors
  network: {
    connectionFailed: (url: string, cause?: Error) =>
      new NetworkError(`Failed to connect to ${url}`, {
        context: { url },
        cause,
        retryable: true,
        recoverySuggestions: [
          'Check your internet connection',
          'Verify the URL is correct and accessible',
          'Check if a firewall is blocking the connection',
          'The operation will be automatically retried',
        ],
      }),

    timeout: (url: string, timeoutMs: number) =>
      new TimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`, timeoutMs, {
        context: { url },
        recoverySuggestions: [
          'Increase timeout in configuration',
          'Check your network speed',
          'Try again later if the service is experiencing issues',
        ],
      }),

    dnsResolutionFailed: (hostname: string, cause?: Error) =>
      new NetworkError(`Failed to resolve DNS for ${hostname}`, {
        context: { hostname },
        cause,
        retryable: true,
        recoverySuggestions: [
          'Check your DNS settings',
          'Verify the hostname is correct',
          'Try using a different DNS server (e.g., 8.8.8.8)',
        ],
      }),
  },

  // API errors
  api: {
    providerError: (provider: string, message: string, statusCode?: number, cause?: Error) =>
      new APIError(`${provider} API error: ${message}`, {
        provider,
        statusCode,
        cause,
        recoverySuggestions: [
          statusCode === 401 ? 'Check your API key is valid and not expired' : '',
          statusCode === 403 ? 'Verify you have access to this API endpoint' : '',
          statusCode === 429 ? 'Rate limit exceeded, will retry automatically' : '',
          statusCode && statusCode >= 500 ? 'Provider is experiencing issues, will retry automatically' : '',
          'Check provider status page for ongoing incidents',
        ].filter(Boolean),
      }),

    invalidResponse: (provider: string, cause?: Error) =>
      new APIError(`Received invalid response from ${provider}`, {
        provider,
        cause,
        retryable: false,
        recoverySuggestions: [
          'The provider may have changed their API format',
          'Check if you need to update PAWS to the latest version',
          'Report this issue if the problem persists',
        ],
      }),

    modelNotFound: (provider: string, modelId: string) =>
      new APIError(`Model not found: ${modelId} (provider: ${provider})`, {
        provider,
        context: { modelId },
        retryable: false,
        recoverySuggestions: [
          'Verify the model ID is correct',
          `Check ${provider} documentation for available models`,
          'You may not have access to this model',
        ],
      }),

    quotaExceeded: (provider: string) =>
      new APIError(`API quota exceeded for ${provider}`, {
        provider,
        statusCode: 429,
        retryable: false,
        recoverySuggestions: [
          'Check your API usage dashboard',
          'Upgrade your API plan if needed',
          'Wait until your quota resets',
          'Use a different provider in the meantime',
        ],
      }),

    contextLengthExceeded: (provider: string, maxTokens: number, actualTokens: number) =>
      new APIError(
        `Context length exceeded for ${provider}: ${actualTokens} tokens (max: ${maxTokens})`,
        {
          provider,
          context: { maxTokens, actualTokens },
          retryable: false,
          recoverySuggestions: [
            'Reduce the size of your context bundle',
            'Use --ai-curate to intelligently select files',
            'Split the task into smaller chunks',
            'Use a model with a larger context window',
          ],
        }
      ),
  },

  // File system errors
  fs: {
    fileNotFound: (path: string, operation: string) =>
      new FileSystemError(`File not found: ${path}`, {
        path,
        operation,
        recoverySuggestions: [
          'Check the file path is correct',
          'Verify the file exists',
          'Check file permissions',
        ],
      }),

    permissionDenied: (path: string, operation: string) =>
      new FileSystemError(`Permission denied: ${path}`, {
        path,
        operation,
        recoverySuggestions: [
          'Check file permissions',
          'Run with appropriate user permissions',
          'Verify you have write access to the directory',
        ],
      }),

    directoryNotEmpty: (path: string) =>
      new FileSystemError(`Directory not empty: ${path}`, {
        path,
        operation: 'delete',
        recoverySuggestions: [
          'Use --force flag to delete non-empty directories',
          'Manually clean up the directory contents first',
        ],
      }),

    diskFull: (path: string) =>
      new FileSystemError(`No space left on device: ${path}`, {
        path,
        operation: 'write',
        recoverySuggestions: [
          'Free up disk space',
          'Check disk usage with df -h',
          'Clean up temporary files or old sessions',
        ],
      }),
  },

  // Git errors
  git: {
    notARepository: (path: string) =>
      new GitError(`Not a git repository: ${path}`, {
        context: { path },
        recoverySuggestions: [
          'Initialize a git repository with: git init',
          'Navigate to a directory containing a git repository',
        ],
      }),

    dirtyWorkingTree: (path: string) =>
      new GitError('Cannot proceed with uncommitted changes', {
        context: { path },
        recoverySuggestions: [
          'Commit your changes: git add . && git commit -m "message"',
          'Stash your changes: git stash',
          'Use --force flag to proceed anyway (use with caution)',
        ],
      }),

    branchAlreadyExists: (branch: string) =>
      new GitError(`Branch already exists: ${branch}`, {
        command: 'git branch',
        context: { branch },
        recoverySuggestions: [
          'Use a different branch name',
          `Delete the existing branch: git branch -D ${branch}`,
          'Switch to the existing branch instead',
        ],
      }),

    mergeConflict: (files: string[]) =>
      new GitError(`Merge conflicts in ${files.length} file(s)`, {
        context: { conflictFiles: files },
        recoverySuggestions: [
          'Resolve conflicts manually in the listed files',
          'Use git mergetool for assistance',
          'Abort the merge: git merge --abort',
        ],
      }),

    commandFailed: (command: string, exitCode: number, stderr: string) =>
      new GitError(`Git command failed: ${command}`, {
        command,
        context: { exitCode, stderr },
        recoverySuggestions: [
          'Check the git error message above',
          'Verify git is installed and accessible',
          'Ensure the git repository is in a valid state',
        ],
      }),
  },

  // Validation errors
  validation: {
    required: (field: string) =>
      new ValidationError(`Required field missing: ${field}`, {
        field,
        recoverySuggestions: [`Provide a value for ${field}`],
      }),

    invalidFormat: (field: string, expected: string, actual: string) =>
      new ValidationError(`Invalid format for ${field}: expected ${expected}, got ${actual}`, {
        field,
        context: { expected, actual },
        recoverySuggestions: [
          `Provide ${field} in the format: ${expected}`,
          'Check documentation for valid formats',
        ],
      }),

    outOfRange: (field: string, min: number, max: number, actual: number) =>
      new ValidationError(`${field} out of range: ${actual} (must be between ${min} and ${max})`, {
        field,
        context: { min, max, actual },
        recoverySuggestions: [`Set ${field} to a value between ${min} and ${max}`],
      }),

    invalidOption: (field: string, value: string, validOptions: string[]) =>
      new ValidationError(`Invalid option for ${field}: ${value}`, {
        field,
        context: { value, validOptions },
        recoverySuggestions: [
          `Valid options for ${field}: ${validOptions.join(', ')}`,
          'Check documentation for all available options',
        ],
      }),
  },

  // Session errors
  session: {
    notFound: (sessionId: string) =>
      new SessionError(`Session not found: ${sessionId}`, {
        sessionId,
        recoverySuggestions: [
          'List available sessions: paws session list',
          'Check if the session ID is correct',
          'The session may have been deleted',
        ],
      }),

    alreadyExists: (sessionId: string) =>
      new SessionError(`Session already exists: ${sessionId}`, {
        sessionId,
        recoverySuggestions: [
          'Use a different session name',
          'Resume the existing session: paws session resume ' + sessionId,
          'Delete the existing session first: paws session delete ' + sessionId,
        ],
      }),

    corruptedMetadata: (sessionId: string, cause?: Error) =>
      new SessionError(`Session metadata corrupted: ${sessionId}`, {
        sessionId,
        cause,
        recoverySuggestions: [
          'Try to restore from backup if available',
          'Delete and recreate the session',
          'Check .paws/sessions/' + sessionId + '/session.json',
        ],
      }),

    cannotRestore: (sessionId: string, reason: string) =>
      new SessionError(`Cannot restore session ${sessionId}: ${reason}`, {
        sessionId,
        context: { reason },
        recoverySuggestions: [
          'Check if the session workspace directory still exists',
          'Verify git repository state is valid',
          'Create a new session instead',
        ],
      }),
  },

  // Cost tracking errors
  cost: {
    unknownModel: (modelId: string) =>
      new CostTrackingError(`Unknown model for cost calculation: ${modelId}`, {
        context: { modelId },
        recoverySuggestions: [
          'Add pricing information to config: paws config set pricing.' + modelId,
          'Check if the model ID is correct',
          'Cost will be reported as $0.00 until pricing is configured',
        ],
      }),

    invalidPricing: (modelId: string) =>
      new CostTrackingError(`Invalid pricing configuration for model: ${modelId}`, {
        context: { modelId },
        recoverySuggestions: [
          'Pricing must include inputCostPer1kTokens and outputCostPer1kTokens',
          'Update config with valid pricing data',
        ],
      }),

    storageError: (operation: string, cause?: Error) =>
      new CostTrackingError(`Failed to ${operation} cost data`, {
        context: { operation },
        cause,
        recoverySuggestions: [
          'Check file permissions for ~/.paws/costs/',
          'Ensure sufficient disk space',
          'Verify JSON format if editing manually',
        ],
      }),
  },

  // Rate limit errors
  rateLimit: {
    providerRateLimit: (provider: string, retryAfter?: number) =>
      new RateLimitError(`Rate limit exceeded for ${provider}`, {
        retryAfter,
        context: { provider },
        recoverySuggestions: [
          retryAfter ? `Wait ${retryAfter} seconds before retrying` : 'Wait before retrying',
          'Consider using a different provider',
          'Upgrade your API plan for higher rate limits',
        ],
      }),

    concurrencyLimit: (limit: number) =>
      new RateLimitError(`Concurrency limit reached: ${limit} concurrent requests`, {
        context: { limit },
        recoverySuggestions: [
          'Wait for some requests to complete',
          'Reduce concurrent operations',
          'Increase concurrency limit in config',
        ],
      }),
  },
};
