# @mcp-wp/core

Core types, JSON schemas, and utilities for the MCP Widget Protocol.

## Overview

This package provides the foundational types and utilities used by all MCP-WP packages. It defines:

- **TypeScript Types** - All protocol interfaces and types
- **JSON Schemas** - Validation schemas for widget metadata, configurations, etc.
- **Utilities** - Shared helper functions for validation, parsing, etc.

## Installation

```bash
pnpm add @mcp-wp/core
```

## Usage

### Types

```typescript
import type {
  WidgetFactory,
  Dependencies,
  MCPServerInfo,
  WidgetMetadata,
  EventBus,
  MCPBridge
} from '@mcp-wp/core';

// Use in your widget
export default function createWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  // ...
}
```

### Schemas

```typescript
import { WidgetMetadataSchema, validateWidgetMetadata } from '@mcp-wp/core/schemas';

// Validate widget metadata
const result = validateWidgetMetadata(metadata);
if (!result.success) {
  console.error('Invalid metadata:', result.errors);
}
```

### Utilities

```typescript
import { parseToolSchema, validateToolArgs } from '@mcp-wp/core/utils';

// Validate tool arguments against JSON Schema
const valid = validateToolArgs(args, tool.inputSchema);
```

## Exports

### Main Exports (`@mcp-wp/core`)

All types, schemas, and utilities are available from the main entry point.

### Sub-path Exports

For tree-shaking optimization:

- `@mcp-wp/core/types` - TypeScript types only
- `@mcp-wp/core/schemas` - JSON schemas and validators
- `@mcp-wp/core/utils` - Utility functions

## Type Definitions

### Widget Factory Contract

```typescript
export interface WidgetFactory {
  api: WidgetAPI;
  widget: WidgetMetadata;
}

export interface WidgetAPI {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  refresh(): Promise<void>;
}

export interface WidgetMetadata {
  protocolVersion: string;
  element: string;
  displayName: string;
  description?: string;
  capabilities: WidgetCapabilities;
  permissions?: WidgetPermissions;
}
```

### Dependencies

```typescript
export interface Dependencies {
  EventBus: EventBus;
  MCPBridge: MCPBridge;
  Configuration: Configuration;
  Theme?: ThemeInterface;
  A11yHelper?: AccessibilityHelper;
  OfflineCache?: OfflineCache;
  Telemetry?: Telemetry;
  I18n?: InternationalizationInterface;
}
```

### EventBus

```typescript
export interface EventBus {
  emit(event: string, data: unknown): void;
  on(event: string, handler: EventHandler): UnsubscribeFunction;
  off(event: string, handler: EventHandler): void;
}

export type EventHandler = (data: unknown) => void | Promise<void>;
export type UnsubscribeFunction = () => void;
```

### MCPBridge

```typescript
export interface MCPBridge {
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
  readResource(serverName: string, uri: string): Promise<ResourceContent>;
  getPrompt(serverName: string, promptName: string, args: Record<string, string>): Promise<PromptMessages>;
  listTools(serverName: string): Promise<Tool[]>;
  listResources(serverName: string): Promise<Resource[]>;
  listPrompts(serverName: string): Promise<Prompt[]>;
}
```

### MCP Server Info

```typescript
export interface MCPServerInfo {
  serverName: string;
  transport: 'stdio' | 'http';
  protocolVersion: string;
  capabilities: MCPCapabilities;
  tools: Tool[];
  resources: Resource[];
  prompts: Prompt[];
}

export interface MCPCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  sampling?: {};
}
```

## JSON Schemas

All schemas are defined using Zod for runtime validation and TypeScript inference.

### Widget Metadata Schema

```typescript
import { z } from 'zod';

export const WidgetMetadataSchema = z.object({
  protocolVersion: z.string(),
  element: z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/),
  displayName: z.string(),
  description: z.string().optional(),
  capabilities: z.object({
    tools: z.boolean(),
    resources: z.boolean(),
    prompts: z.boolean()
  }),
  permissions: z.object({
    // ...
  }).optional()
});

export type WidgetMetadata = z.infer<typeof WidgetMetadataSchema>;
```

## Utilities

### Validation

```typescript
export function validateWidgetMetadata(metadata: unknown): ValidationResult<WidgetMetadata>;
export function validateToolArgs(args: unknown, schema: JSONSchema): boolean;
export function validatePermissions(permissions: unknown): ValidationResult<WidgetPermissions>;
```

### Parsing

```typescript
export function parseToolSchema(schema: JSONSchema): ParsedSchema;
export function parseResourceURI(uri: string): ParsedURI;
export function parseEventName(event: string): ParsedEvent;
```

### Type Guards

```typescript
export function isValidWidgetElement(element: string): boolean;
export function isToolResult(result: unknown): result is ToolResult;
export function isResourceContent(content: unknown): content is ResourceContent;
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## Implementation Checklist

### Phase 1: Core Types (Priority 1) ✅ COMPLETE

- [x] `src/types/widget.ts` - Widget factory and API types
- [x] `src/types/dependencies.ts` - Dependencies interface types
- [x] `src/types/mcp.ts` - MCP server info and primitives
- [x] `src/types/events.ts` - Event system types
- [x] `src/types/permissions.ts` - Permission model types
- [x] `src/types/configuration.ts` - Configuration types
- [x] `src/types/index.ts` - Re-export all types

### Phase 2: JSON Schemas (Priority 1) ✅ COMPLETE

- [x] `src/schemas/widget-metadata.ts` - Widget metadata validation
- [x] `src/schemas/permissions.ts` - Permissions validation
- [x] `src/schemas/configuration.ts` - Configuration validation
- [x] `src/schemas/events.ts` - Event payload validation
- [x] `src/schemas/index.ts` - Re-export all schemas

### Phase 3: Utilities (Priority 2) ✅ COMPLETE

- [x] `src/utils/validation.ts` - Validation helpers
- [x] `src/utils/parsing.ts` - Parsing utilities
- [x] `src/utils/type-guards.ts` - Type guard functions
- [x] `src/utils/event-names.ts` - Event naming helpers
- [x] `src/utils/index.ts` - Re-export all utilities

### Phase 4: Tests (Priority 1) ✅ COMPLETE

- [x] `test/schemas.test.ts` - Schema validation tests
- [x] `test/utils.test.ts` - Utility function tests

### Phase 5: Documentation (Priority 2) ✅ COMPLETE

- [x] API documentation (JSDoc comments in all source files)
- [x] Usage examples in README
- [x] Comprehensive package documentation

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## License

MIT
