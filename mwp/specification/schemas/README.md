# MCP Widget Protocol Schemas

This directory contains JSON Schema definitions for the MCP Widget Protocol (MCP-WP).

## Overview

The schemas are **automatically generated** from Zod validators in `packages/core/src/schemas/` during the build process. They provide:

- **Runtime validation** for widget metadata, permissions, configuration, and events
- **Language-agnostic definitions** for non-TypeScript implementations
- **Documentation** of all protocol contracts in a machine-readable format
- **Tooling support** for validators, code generators, and IDE extensions

## Schema Categories

### Widget Metadata
- `widget-metadata.schema.json` - Widget identification and display information
- `widget-capabilities.schema.json` - Widget feature capabilities
- `author-info.schema.json` - Widget author/maintainer information

### Permissions
- `widget-permissions.schema.json` - Complete permission set for widgets
- `tool-permissions.schema.json` - MCP tool invocation permissions
- `resource-permissions.schema.json` - MCP resource access permissions
- `prompt-permissions.schema.json` - MCP prompt usage permissions
- `network-permissions.schema.json` - External network access permissions
- `storage-permissions.schema.json` - Local storage access permissions
- `permission-request.schema.json` - Permission request structure

### Configuration
- `dashboard-configuration.schema.json` - Complete dashboard configuration
- `server-configuration.schema.json` - MCP server connection settings
- `widget-configuration.schema.json` - Widget instance configuration
- `layout-configuration.schema.json` - Dashboard grid layout settings
- `theme-configuration.schema.json` - Visual theme settings

### Events
- `error-info.schema.json` - Error information structure
- `tool-invoke-requested-payload.schema.json` - Tool invocation request event
- `tool-invoked-payload.schema.json` - Tool invocation complete event
- `resource-read-requested-payload.schema.json` - Resource read request event
- `server-connected-payload.schema.json` - Server connection event
- `widget-initialized-payload.schema.json` - Widget initialization event
- `event-metadata.schema.json` - Common event metadata

## Usage

### TypeScript/JavaScript

```typescript
// Import Zod schemas (recommended)
import { WidgetMetadataSchema } from '@mcp-wp/core/schemas';

// Or import JSON Schema
import widgetMetadataSchema from '@mcp-wp/core/schemas/widget-metadata.json';
```

### Python

```python
import json
import jsonschema

# Load schema
with open('widget-metadata.schema.json') as f:
    schema = json.load(f)

# Validate data
jsonschema.validate(widget_data, schema)
```

### CLI Tools

```bash
# Validate with ajv-cli
ajv validate -s widget-metadata.schema.json -d my-widget.json

# Generate types with json-schema-to-typescript
json2ts widget-metadata.schema.json > widget-metadata.d.ts
```

## Generation

Schemas are automatically generated during the build process:

```bash
# From packages/core
pnpm schemas:generate

# Or as part of build
pnpm build
```

**Source of Truth**: The Zod schemas in `packages/core/src/schemas/` are the canonical definitions. JSON Schemas are derived from them.

## Schema URLs

Schemas are published with stable URLs:

- Base URL: `https://mcp-wp.dev/schemas/`
- Example: `https://mcp-wp.dev/schemas/widget-metadata.json`

These URLs can be used in `$schema` fields for validation and IDE support:

```json
{
  "$schema": "https://mcp-wp.dev/schemas/widget-metadata.json",
  "protocolVersion": "1.0.0",
  "name": "my-widget",
  "displayName": "My Widget"
}
```

## Validation

### Runtime Validation (TypeScript)

Use the Zod schemas from `@mcp-wp/core`:

```typescript
import { validateWidgetMetadata } from '@mcp-wp/core/schemas';

const result = validateWidgetMetadata(data);
if (!result.success) {
  console.error('Validation failed:', result.errors);
}
```

### Static Validation (JSON Schema)

Use any JSON Schema validator:

```bash
# Using ajv-cli
npm install -g ajv-cli ajv-formats
ajv validate -s widget-metadata.schema.json -d widget.json

# Using check-jsonschema
pip install check-jsonschema
check-jsonschema --schemafile widget-metadata.schema.json widget.json
```

## Integration with Specification

These schemas are referenced in the [MCP-WP Specification](../MWP.md) as normative definitions of the protocol contracts. The specification provides:

- **Context** - Why each schema exists
- **Requirements** - Normative MUST/SHOULD/MAY statements
- **Examples** - Usage patterns
- **Rationale** - Design decisions

The schemas provide:

- **Structure** - Exact field definitions
- **Validation** - Automatic conformance checking
- **Tooling** - Machine-readable contracts

## Schema Versioning

Schemas follow the protocol version (currently 1.0.0). Breaking changes to schemas constitute a major version bump of the protocol.

**Current Version**: 1.0.0

## Contributing

To modify schemas:

1. Edit the Zod schemas in `packages/core/src/schemas/`
2. Run `pnpm schemas:generate` to regenerate JSON Schemas
3. Update tests in `packages/core/src/schemas/*.test.ts`
4. Update specification if adding new contracts

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## Related Documentation

- **[Protocol Specification](../MWP.md)** - Complete MCP-WP protocol
- **[Core Package README](../../packages/core/README.md)** - Type and schema documentation
- **[Validator Tool](../../packages/tools/validator/README.md)** - Schema validation CLI
- **[Widget Development Guide](../../GETTING-STARTED.md)** - Using schemas in widgets

---

**Note**: This directory contains generated files. Do not edit JSON Schema files directly - edit the source Zod schemas instead.
