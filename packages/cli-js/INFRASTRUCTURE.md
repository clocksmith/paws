# PAWS Core Infrastructure

This document describes the core infrastructure improvements added to PAWS to provide enterprise-grade reliability, observability, and configuration management.

## Overview

The PAWS core infrastructure provides:

- **Error Handling Framework**: Typed error classes with recovery suggestions
- **Structured Logging**: Multi-transport logging with rotation and formatting
- **Configuration Management**: Hierarchical .pawsrc.json support with profiles
- **Cost Tracking Engine**: Per-model pricing and budget management
- **Enhanced Session Management**: Rich metadata and analytics
- **API Client Infrastructure**: Retry, rate limiting, and circuit breaker patterns

## Quick Start

### Using Shared Context

All PAWS commands can use the shared context for integrated infrastructure:

```typescript
import { createPawsContext } from './shared-context';

async function myCommand() {
  const ctx = await createPawsContext();

  // Access configuration
  const apiKey = ctx.getProviderApiKey('anthropic');

  // Use logger
  await ctx.logger.info('Starting operation');

  // Track costs
  if (ctx.costTracker) {
    await ctx.costTracker.trackOperation(
      'claude-3-5-sonnet-20241022',
      'anthropic',
      { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
      { operationType: 'generation' }
    );
  }

  // Clean up
  await ctx.close();
}
```

## Configuration Management

### Configuration Files

PAWS supports hierarchical configuration with multiple levels:

1. **System**: `/etc/pawsrc.json` (Linux/macOS)
2. **User**: `~/.pawsrc.json`
3. **Project**: `.pawsrc.json` in project root
4. **Local**: `.pawsrc.json` in current directory

Configuration files are merged in order, with more specific configs overriding general ones.

### Configuration Structure

```json
{
  "version": "1.0.0",
  "profile": "dev",
  "providers": {
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}",
      "timeout": 60000,
      "maxRetries": 3,
      "rateLimitPerMinute": 50
    }
  },
  "pricing": {
    "claude-3-5-sonnet-20241022": {
      "inputCostPer1kTokens": 0.003,
      "outputCostPer1kTokens": 0.015,
      "contextWindow": 200000,
      "displayName": "Claude 3.5 Sonnet"
    }
  },
  "logging": {
    "level": "INFO",
    "console": true,
    "file": true,
    "fileOptions": {
      "path": "~/.paws/logs/paws.log",
      "maxSize": 10485760,
      "maxFiles": 5,
      "format": "json"
    }
  },
  "cost": {
    "enabled": true,
    "storagePath": "~/.paws/costs",
    "budgetLimit": 100,
    "budgetPeriod": "monthly",
    "warnThreshold": 80
  }
}
```

### Environment Variable Expansion

Use `${VAR_NAME}` syntax for environment variables:

```json
{
  "providers": {
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}"
    }
  }
}
```

### Configuration Profiles

Create multiple profiles for different environments:

```json
{
  "defaultProfile": "dev",
  "profiles": {
    "dev": {
      "logging": { "level": "DEBUG" },
      "cost": { "enabled": false }
    },
    "prod": {
      "logging": { "level": "ERROR" },
      "cost": { "enabled": true, "budgetLimit": 1000 }
    }
  }
}
```

Use profiles with `--profile` flag or `PAWS_PROFILE` environment variable.

### CLI Commands

```bash
# Initialize configuration
paws-config init                    # Create .pawsrc.json
paws-config init --global           # Create ~/.pawsrc.json
paws-config init --profile dev      # Create with profile

# Get/set values
paws-config get providers.anthropic.apiKey
paws-config set providers.anthropic.timeout 30000

# List configuration
paws-config list
paws-config list --profile prod

# Validate
paws-config validate

# View pricing
paws-config pricing

# List profiles
paws-config profiles
```

## Error Handling

### Error Types

All PAWS errors extend `PawsError` and include:
- Unique error codes (e.g., `PAWS-CONFIG`, `PAWS-API`)
- Contextual information
- Recovery suggestions
- Retryable flag

Available error types:
- `ConfigError`: Configuration issues
- `NetworkError`: Network failures (retryable)
- `APIError`: API provider errors
- `FileSystemError`: File operations
- `GitError`: Git operations
- `ValidationError`: Input validation
- `SessionError`: Session management
- `CostTrackingError`: Cost tracking
- `TimeoutError`: Operation timeouts
- `RateLimitError`: Rate limit exceeded

### Error Catalog

Pre-defined errors with helpful messages:

```typescript
import { ErrorCatalog } from './core/errors';

// Config errors
throw ErrorCatalog.config.fileNotFound('/path/to/config');
throw ErrorCatalog.config.missingApiKey('anthropic');

// API errors
throw ErrorCatalog.api.modelNotFound('openai', 'gpt-5');
throw ErrorCatalog.api.quotaExceeded('anthropic');

// Validation errors
throw ErrorCatalog.validation.required('apiKey');
```

### Error Handling

```typescript
import { handleError, isPawsError } from './core/errors';

try {
  // Your code
} catch (error) {
  if (isPawsError(error)) {
    // Handle PAWS error
    console.error(error.toUserString());

    if (error.retryable) {
      // Retry logic
    }
  } else {
    // Handle other errors
    await handleError(error, { logger, exitProcess: true });
  }
}
```

## Logging

### Log Levels

- `DEBUG`: Detailed debug information
- `INFO`: Informational messages
- `WARN`: Warning messages
- `ERROR`: Error messages

### Creating Loggers

```typescript
import { createLogger, ConsoleTransport, FileTransport, LogLevel } from './core/logging';

const logger = createLogger({
  minLevel: LogLevel.INFO,
  transports: [
    new ConsoleTransport({ colorize: true }),
    new FileTransport({
      filePath: '~/.paws/logs/paws.log',
      maxSize: 10 * 1024 * 1024,
      maxFiles: 5,
      json: true,
    }),
  ],
});

// Log messages
await logger.debug('Debug message', { data: 'value' });
await logger.info('Info message');
await logger.warn('Warning message');
await logger.error('Error message', { error });

// Performance tracking
const endTimer = logger.startTimer('operation');
// ... do work ...
await endTimer(); // Logs duration
```

### Child Loggers

Create loggers with specific sources:

```typescript
const arenaLogger = logger.child('arena');
await arenaLogger.info('Arena started');
// Output: [2025-01-04T12:00:00.000Z] INFO [arena] Arena started
```

## Cost Tracking

### Tracking Operations

```typescript
import { CostTracker, FileCostStorage } from './core/cost-tracker';

const storage = new FileCostStorage('~/.paws/costs');
const tracker = new CostTracker({
  storage,
  pricing: new Map([
    ['claude-3-5-sonnet-20241022', {
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.015,
    }],
  ]),
  budgetLimit: 100,
  budgetPeriod: 'monthly',
  warnThreshold: 80,
});

// Track operation
const cost = await tracker.trackOperation(
  'claude-3-5-sonnet-20241022',
  'anthropic',
  { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
  {
    operationType: 'generation',
    sessionId: 'my-session',
  }
);

console.log(`Cost: $${cost.cost.toFixed(4)}`);
```

### Getting Summaries

```typescript
// Overall summary
const summary = await tracker.getSummary();
console.log(`Total cost: $${summary.totalCost.toFixed(2)}`);
console.log(`Total tokens: ${summary.totalTokens.toLocaleString()}`);

// By model
for (const [model, stats] of Object.entries(summary.byModel)) {
  console.log(`${model}: $${stats.cost.toFixed(2)} (${stats.operationCount} ops)`);
}

// Session summary
const sessionSummary = await tracker.getSessionSummary('my-session');

// Model summary
const modelSummary = await tracker.getModelSummary('claude-3-5-sonnet-20241022');
```

### Budget Management

```typescript
// Check budget status
const status = await tracker.getBudgetStatus();

if (status.exceeded) {
  console.error(`Budget exceeded! $${status.usage} / $${status.limit}`);
}

if (status.warning) {
  console.warn(`Budget warning: ${status.usagePercent}% used`);
}

// Export costs
await tracker.export('/path/to/costs.csv'); // CSV format
await tracker.export('/path/to/costs.json'); // JSON format
```

## Session Management

### Enhanced Session Metadata

Sessions now include rich metadata:
- Total cost and tokens
- Models used
- Duration tracking
- Custom tags
- Activity timestamps

### Using Enhanced Sessions

```typescript
import { EnhancedSessionManager, SessionStatus } from './core/session';

const manager = new EnhancedSessionManager('~/.paws/sessions', {
  historyEnabled: true,
  maxHistoryEntries: 100,
});

await manager.initialize();

// Load session
const session = await manager.loadSessionMetadata('session-id');

// Add turn
await manager.addTurn('session-id', {
  turnNumber: 1,
  timestamp: new Date(),
  command: 'cats src/**/*.ts',
  cost: 0.05,
  tokens: 1500,
  model: 'claude-3-5-sonnet-20241022',
});

// Update status
await manager.updateSessionStatus('session-id', SessionStatus.ARCHIVED);

// Get analytics
const analytics = await manager.getAnalytics();
console.log(`Total sessions: ${analytics.totalSessions}`);
console.log(`Total cost: $${analytics.totalCost.toFixed(2)}`);
console.log(`Top models:`, analytics.topModels);

// Export/import
await manager.exportSession('session-id', '/path/to/export.json');
const importedId = await manager.importSession('/path/to/export.json');
```

## API Client

### Creating API Clients

```typescript
import { APIClient } from './core/api-client';

const client = new APIClient({
  provider: 'anthropic',
  defaultTimeout: 60000,
  defaultMaxRetries: 3,
  retryBackoffMultiplier: 2,
  rateLimitPerMinute: 50,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  enableQueue: true,
  maxQueueSize: 100,
  enableLogging: true,
  logger,
});

// Execute request
const response = await client.request({
  operation: 'generate',
  execute: async () => {
    // Your API call
    return await callAPI();
  },
  priority: 1, // Higher priority = processed first
  timeout: 30000,
});

console.log(response.data);
console.log(`Response time: ${response.responseTimeMs}ms`);
```

### Features

- **Automatic Retry**: Exponential backoff for retryable errors
- **Rate Limiting**: Prevents exceeding provider limits
- **Circuit Breaker**: Fails fast when service is down
- **Request Queue**: Priority-based request queuing
- **Timeout Handling**: Configurable per request
- **Logging**: Integrated with logging system

## Testing

Run tests:

```bash
npm test                    # All tests
npm run test:cats           # CATS tests
npm run test:dogs           # DOGS tests
npm run test:integration    # Integration tests
```

New core tests:
- `test/core/errors.test.ts` - Error handling
- `test/core/config.test.ts` - Configuration management
- `test/core/cost-tracker.test.ts` - Cost tracking

## Migration Guide

### Migrating Existing Commands

1. **Import shared context**:
```typescript
import { createPawsContext } from './shared-context';
```

2. **Initialize context**:
```typescript
const ctx = await createPawsContext();
```

3. **Replace direct API calls** with context methods:
```typescript
// Before
const apiKey = process.env.ANTHROPIC_API_KEY;

// After
const apiKey = ctx.getProviderApiKey('anthropic');
```

4. **Replace console.log** with logger:
```typescript
// Before
console.log('Starting operation');

// After
await ctx.logger.info('Starting operation');
```

5. **Track costs**:
```typescript
if (ctx.costTracker) {
  await ctx.costTracker.trackOperation(modelId, provider, tokens);
}
```

6. **Handle errors**:
```typescript
import { handleError } from './core/errors';

try {
  // Your code
} catch (error) {
  await handleError(error, { logger: ctx.logger, exitProcess: true });
}
```

7. **Clean up**:
```typescript
await ctx.close();
```

## Best Practices

1. **Always use context**: Initialize PawsContext at the start of commands
2. **Log appropriately**: Use correct log levels (DEBUG, INFO, WARN, ERROR)
3. **Track costs**: Enable cost tracking for all AI operations
4. **Handle errors**: Use error catalog for consistent error messages
5. **Validate config**: Check configuration validity before operations
6. **Use profiles**: Separate dev/prod configurations
7. **Document metadata**: Add meaningful metadata to sessions and operations

## Performance Considerations

- **Log rotation**: File logs automatically rotate at 10MB by default
- **Cost caching**: Cost data is cached for 1 minute to reduce disk I/O
- **Config caching**: Configuration is loaded once and reused
- **Async operations**: All I/O operations are async for better performance

## Troubleshooting

### Enable Debug Logging

```bash
export PAWS_DEBUG=true
paws-arena run
```

Or in config:
```json
{
  "logging": {
    "level": "DEBUG"
  }
}
```

### View Logs

```bash
tail -f ~/.paws/logs/paws.log
```

### Check Configuration

```bash
paws-config validate
paws-config list
```

### Check Costs

```bash
# View cost data directly
cat ~/.paws/costs/costs-2025-01.json | jq
```

### Reset State

```bash
# Clear cost data
rm -rf ~/.paws/costs/*

# Clear sessions
rm -rf ~/.paws/sessions/*

# Reset configuration
rm ~/.pawsrc.json
paws-config init
```

## Architecture

```
packages/cli-js/src/
├── core/                          # Core infrastructure
│   ├── errors/                    # Error handling framework
│   │   ├── base.ts               # Base error classes
│   │   ├── catalog.ts            # Pre-defined errors
│   │   ├── handler.ts            # Error handling utilities
│   │   └── index.ts
│   ├── logging/                   # Structured logging
│   │   ├── types.ts              # Type definitions
│   │   ├── logger.ts             # Logger implementation
│   │   ├── transports/           # Log transports
│   │   │   ├── console.ts        # Console transport
│   │   │   ├── file.ts           # File transport
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── config/                    # Configuration management
│   │   ├── types.ts              # Config types
│   │   ├── manager.ts            # Config manager
│   │   ├── defaults.ts           # Default config
│   │   ├── validator.ts          # Config validation
│   │   └── index.ts
│   ├── cost-tracker/              # Cost tracking
│   │   ├── types.ts              # Types
│   │   ├── storage.ts            # File storage
│   │   ├── tracker.ts            # Cost tracker
│   │   ├── factory.ts            # Factory methods
│   │   └── index.ts
│   ├── session/                   # Enhanced sessions
│   │   ├── types.ts              # Session types
│   │   ├── manager.ts            # Session manager
│   │   └── index.ts
│   ├── api-client/                # API client infrastructure
│   │   ├── types.ts              # Types
│   │   ├── client.ts             # API client
│   │   ├── rate-limiter.ts       # Rate limiting
│   │   ├── circuit-breaker.ts    # Circuit breaker
│   │   └── index.ts
│   └── index.ts
├── shared-context.ts              # Shared context utility
├── paws-config.ts                 # Config CLI command
└── ...existing commands...
```
