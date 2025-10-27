#!/usr/bin/env tsx

/**
 * Generate JSON Schema files from Zod schemas
 *
 * This script converts all Zod schema definitions in src/schemas/
 * to JSON Schema format for use by non-TypeScript tools and validators.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Import all Zod schemas
import {
  WidgetMetadataSchema,
  WidgetCapabilitiesSchema,
  AuthorInfoSchema,
} from '../src/schemas/widget-metadata.js';

import {
  WidgetPermissionsSchema,
  ToolPermissionsSchema,
  ResourcePermissionsSchema,
  PromptPermissionsSchema,
  SamplingPermissionsSchema,
  NetworkPermissionsSchema,
  StoragePermissionsSchema,
  CrossWidgetPermissionsSchema,
  RateLimitSchema,
  ToolConstraintsSchema,
  PermissionRequestSchema,
  PermissionGrantSchema,
  PermissionDenialSchema,
} from '../src/schemas/permissions.js';

import {
  DashboardConfigurationSchema,
  ServerConfigurationSchema,
  WidgetConfigurationSchema,
  LayoutConfigurationSchema,
  ThemeConfigurationSchema,
  FeatureFlagsSchema,
} from '../src/schemas/configuration.js';

import {
  ErrorInfoSchema,
  ToolInvokeRequestedPayloadSchema,
  ToolInvokedPayloadSchema,
  ResourceReadRequestedPayloadSchema,
  ServerConnectedPayloadSchema,
  WidgetInitializedPayloadSchema,
  EventMetadataSchema,
} from '../src/schemas/events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = join(__dirname, '..', 'dist', 'schemas');

interface SchemaDefinition {
  name: string;
  schema: any;
  description: string;
}

/**
 * Schema definitions to generate
 */
const schemas: SchemaDefinition[] = [
  // Widget Metadata
  {
    name: 'widget-metadata',
    schema: WidgetMetadataSchema,
    description: 'Widget metadata schema - defines widget identification and display information',
  },
  {
    name: 'widget-capabilities',
    schema: WidgetCapabilitiesSchema,
    description: 'Widget capabilities schema - defines what features a widget supports',
  },
  {
    name: 'author-info',
    schema: AuthorInfoSchema,
    description: 'Author information schema - defines widget author/maintainer details',
  },

  // Permissions
  {
    name: 'widget-permissions',
    schema: WidgetPermissionsSchema,
    description: 'Widget permissions schema - defines complete permission set for a widget',
  },
  {
    name: 'tool-permissions',
    schema: ToolPermissionsSchema,
    description: 'Tool permissions schema - defines MCP tool invocation permissions',
  },
  {
    name: 'resource-permissions',
    schema: ResourcePermissionsSchema,
    description: 'Resource permissions schema - defines MCP resource access permissions',
  },
  {
    name: 'prompt-permissions',
    schema: PromptPermissionsSchema,
    description: 'Prompt permissions schema - defines MCP prompt usage permissions',
  },
  {
    name: 'network-permissions',
    schema: NetworkPermissionsSchema,
    description: 'Network permissions schema - defines external network access permissions',
  },
  {
    name: 'storage-permissions',
    schema: StoragePermissionsSchema,
    description: 'Storage permissions schema - defines local storage access permissions',
  },
  {
    name: 'permission-request',
    schema: PermissionRequestSchema,
    description: 'Permission request schema - used when widgets request new permissions',
  },

  // Configuration
  {
    name: 'dashboard-configuration',
    schema: DashboardConfigurationSchema,
    description: 'Dashboard configuration schema - complete dashboard setup',
  },
  {
    name: 'server-configuration',
    schema: ServerConfigurationSchema,
    description: 'Server configuration schema - MCP server connection settings',
  },
  {
    name: 'widget-configuration',
    schema: WidgetConfigurationSchema,
    description: 'Widget configuration schema - widget instance settings',
  },
  {
    name: 'layout-configuration',
    schema: LayoutConfigurationSchema,
    description: 'Layout configuration schema - dashboard grid layout settings',
  },
  {
    name: 'theme-configuration',
    schema: ThemeConfigurationSchema,
    description: 'Theme configuration schema - visual theme settings',
  },

  // Events
  {
    name: 'error-info',
    schema: ErrorInfoSchema,
    description: 'Error information schema - error details structure',
  },
  {
    name: 'tool-invoke-requested-payload',
    schema: ToolInvokeRequestedPayloadSchema,
    description: 'Tool invoke requested event payload',
  },
  {
    name: 'tool-invoked-payload',
    schema: ToolInvokedPayloadSchema,
    description: 'Tool invoked event payload',
  },
  {
    name: 'resource-read-requested-payload',
    schema: ResourceReadRequestedPayloadSchema,
    description: 'Resource read requested event payload',
  },
  {
    name: 'server-connected-payload',
    schema: ServerConnectedPayloadSchema,
    description: 'Server connected event payload',
  },
  {
    name: 'widget-initialized-payload',
    schema: WidgetInitializedPayloadSchema,
    description: 'Widget initialized event payload',
  },
  {
    name: 'event-metadata',
    schema: EventMetadataSchema,
    description: 'Event metadata schema - common event metadata fields',
  },
];

/**
 * Generate JSON Schema from Zod schema
 */
function generateJsonSchema(definition: SchemaDefinition): object {
  const jsonSchema = zodToJsonSchema(definition.schema, {
    name: definition.name,
    $refStrategy: 'none',
  });

  // Add metadata
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: `https://mwp.dev/schemas/${definition.name}.json`,
    title: definition.name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    description: definition.description,
    ...jsonSchema,
  };
}

/**
 * Main generation function
 */
function main() {
  console.log('Generating JSON Schema files from Zod schemas...\n');

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate each schema
  const generated: string[] = [];

  for (const definition of schemas) {
    const filename = `${definition.name}.schema.json`;
    const filepath = join(OUTPUT_DIR, filename);

    try {
      const jsonSchema = generateJsonSchema(definition);
      const content = JSON.stringify(jsonSchema, null, 2);

      writeFileSync(filepath, content, 'utf-8');

      console.log(`✓ Generated ${filename}`);
      generated.push(filename);
    } catch (error: any) {
      console.error(`✗ Failed to generate ${filename}:`, error.message);
      process.exit(1);
    }
  }

  // Generate index file
  const indexContent = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://mwp.dev/schemas/index.json',
    title: 'MCP Widget Protocol Schemas',
    description: 'JSON Schema definitions for the MCP Widget Protocol',
    version: '1.0.0',
    schemas: schemas.map(def => ({
      name: def.name,
      description: def.description,
      file: `${def.name}.schema.json`,
      url: `https://mwp.dev/schemas/${def.name}.json`,
    })),
  };

  writeFileSync(
    join(OUTPUT_DIR, 'index.json'),
    JSON.stringify(indexContent, null, 2),
    'utf-8'
  );

  console.log(`\n✓ Generated ${generated.length} JSON Schema files`);
  console.log(`✓ Output directory: ${OUTPUT_DIR}`);
  console.log('\n✓ Schema generation complete!');
}

// Run
main();
