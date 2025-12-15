#!/usr/bin/env node
/**
 * CATSCAN Converter Tools
 *
 * Convert CATSCAN.md files to/from various formats:
 * - MCP (Model Context Protocol) tool definitions
 * - OpenAPI/JSON Schema
 * - TypeScript interfaces
 *
 * Usage:
 *   catscan-converter to-mcp <input.md> [output.json]
 *   catscan-converter to-openapi <input.md> [output.yaml]
 *   catscan-converter from-ts <input.ts> [output.md]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { program } from 'commander';

// CATSCAN types
interface CatscanFunction {
  name: string;
  signature: string;
  description: string;
  parameters?: Array<{ name: string; type: string; description?: string }>;
  returns?: { type: string; description?: string };
}

interface CatscanClass {
  name: string;
  description: string;
  methods: CatscanFunction[];
  properties?: Array<{ name: string; type: string; description?: string }>;
}

interface CatscanModule {
  name: string;
  description: string;
  tier?: number;
  api_surface: string[];
  internal_dependencies: string[];
  external_dependencies: string[];
  consumers?: string[];
  functions?: CatscanFunction[];
  classes?: CatscanClass[];
  constants?: Array<{ name: string; type: string; value?: string }>;
}

// MCP Tool types
interface MCPToolParameter {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
}

interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, MCPToolParameter>;
  required?: string[];
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
}

interface MCPToolSet {
  tools: MCPTool[];
  metadata: {
    source: string;
    generatedAt: string;
    version: string;
  };
}

// OpenAPI types
interface OpenAPIParameter {
  name: string;
  in: 'query' | 'path' | 'body';
  description?: string;
  required?: boolean;
  schema: { type: string };
}

interface OpenAPIOperation {
  operationId: string;
  summary: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  responses: Record<string, { description: string }>;
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  paths: Record<string, Record<string, OpenAPIOperation>>;
}

/**
 * Parse a CATSCAN.md file into structured data
 */
function parseCatscan(content: string): CatscanModule {
  const result: CatscanModule = {
    name: 'Unknown',
    description: '',
    api_surface: [],
    internal_dependencies: [],
    external_dependencies: [],
    functions: [],
    classes: [],
  };

  const lines = content.split('\n');
  let currentSection = '';
  let currentFunction: Partial<CatscanFunction> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Parse module name from H1
    if (trimmed.startsWith('# ')) {
      result.name = trimmed.slice(2).trim();
      continue;
    }

    // Parse sections
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.slice(3).toLowerCase();
      continue;
    }

    // Parse description (first paragraph after H1)
    if (!result.description && trimmed && !trimmed.startsWith('#') && !currentSection) {
      result.description = trimmed;
      continue;
    }

    // Parse tier from metadata
    const tierMatch = trimmed.match(/^tier:\s*(\d+)/i);
    if (tierMatch) {
      result.tier = parseInt(tierMatch[1]);
      continue;
    }

    // Parse API surface
    if (currentSection === 'api surface' || currentSection === 'public api') {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const item = trimmed.slice(2).replace(/`/g, '').trim();
        result.api_surface.push(item);
      }
      continue;
    }

    // Parse dependencies
    if (currentSection.includes('dependencies')) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const dep = trimmed.slice(2).replace(/`/g, '').trim();
        if (currentSection.includes('internal')) {
          result.internal_dependencies.push(dep);
        } else if (currentSection.includes('external')) {
          result.external_dependencies.push(dep);
        }
      }
      continue;
    }

    // Parse functions
    if (currentSection === 'functions') {
      const funcMatch = trimmed.match(/^###\s+`?(\w+)`?\s*$/);
      if (funcMatch) {
        if (currentFunction && currentFunction.name) {
          result.functions!.push(currentFunction as CatscanFunction);
        }
        currentFunction = {
          name: funcMatch[1],
          signature: '',
          description: '',
          parameters: [],
        };
        continue;
      }

      // Parse function signature from code block
      if (currentFunction && trimmed.startsWith('```')) {
        let sig = '';
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          sig += lines[i] + '\n';
          i++;
        }
        currentFunction.signature = sig.trim();
        continue;
      }

      // Parse function description
      if (currentFunction && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
        if (!currentFunction.description) {
          currentFunction.description = trimmed;
        }
      }
    }
  }

  // Add last function
  if (currentFunction && currentFunction.name) {
    result.functions!.push(currentFunction as CatscanFunction);
  }

  return result;
}

/**
 * Convert TypeScript type to JSON Schema type
 */
function tsTypeToJsonSchema(tsType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'any': 'object',
    'void': 'null',
    'null': 'null',
    'undefined': 'null',
    'object': 'object',
    'array': 'array',
  };

  const lower = tsType.toLowerCase().replace(/\[\]$/, '');
  return typeMap[lower] || 'string';
}

/**
 * Parse function signature to extract parameters
 */
function parseSignature(signature: string): { params: Array<{ name: string; type: string }>; returnType: string } {
  const params: Array<{ name: string; type: string }> = [];
  let returnType = 'void';

  // Match function parameters
  const paramsMatch = signature.match(/\(([^)]*)\)/);
  if (paramsMatch) {
    const paramsStr = paramsMatch[1];
    const paramParts = paramsStr.split(',').map(p => p.trim()).filter(p => p);

    for (const part of paramParts) {
      const colonIndex = part.indexOf(':');
      if (colonIndex > 0) {
        const name = part.slice(0, colonIndex).trim().replace('?', '');
        const type = part.slice(colonIndex + 1).trim();
        params.push({ name, type });
      }
    }
  }

  // Match return type
  const returnMatch = signature.match(/\):\s*(.+)$/);
  if (returnMatch) {
    returnType = returnMatch[1].trim();
  }

  return { params, returnType };
}

/**
 * Convert CATSCAN to MCP tool definitions
 */
function toMCP(module: CatscanModule): MCPToolSet {
  const tools: MCPTool[] = [];

  // Convert each function to an MCP tool
  for (const func of module.functions || []) {
    const { params } = parseSignature(func.signature);

    const properties: Record<string, MCPToolParameter> = {};
    const required: string[] = [];

    for (const param of params) {
      properties[param.name] = {
        type: tsTypeToJsonSchema(param.type),
        description: `Parameter: ${param.name}`,
      };

      // Assume parameters without ? are required
      if (!param.type.includes('?')) {
        required.push(param.name);
      }
    }

    // Also add from explicit parameters if available
    for (const param of func.parameters || []) {
      if (!properties[param.name]) {
        properties[param.name] = {
          type: tsTypeToJsonSchema(param.type),
          description: param.description || `Parameter: ${param.name}`,
        };
      }
    }

    tools.push({
      name: `${module.name.toLowerCase()}_${func.name}`,
      description: func.description || `Function ${func.name} from ${module.name}`,
      inputSchema: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
    });
  }

  // If no functions but has API surface, create placeholder tools
  if (tools.length === 0 && module.api_surface.length > 0) {
    for (const item of module.api_surface) {
      // Skip class names (typically PascalCase)
      if (/^[A-Z]/.test(item) && !item.includes('(')) {
        continue;
      }

      tools.push({
        name: `${module.name.toLowerCase()}_${item}`,
        description: `API: ${item} from ${module.name}`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
    }
  }

  return {
    tools,
    metadata: {
      source: `CATSCAN: ${module.name}`,
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

/**
 * Convert CATSCAN to OpenAPI spec
 */
function toOpenAPI(module: CatscanModule): OpenAPISpec {
  const paths: Record<string, Record<string, OpenAPIOperation>> = {};

  // Convert each function to an OpenAPI operation
  for (const func of module.functions || []) {
    const { params, returnType } = parseSignature(func.signature);

    const pathParams: OpenAPIParameter[] = params.map(p => ({
      name: p.name,
      in: 'query' as const,
      description: `Parameter ${p.name}`,
      required: !p.type.includes('?'),
      schema: { type: tsTypeToJsonSchema(p.type) },
    }));

    const pathKey = `/${module.name.toLowerCase()}/${func.name}`;
    paths[pathKey] = {
      post: {
        operationId: func.name,
        summary: func.description || func.name,
        description: func.description,
        parameters: pathParams.length > 0 ? pathParams : undefined,
        responses: {
          '200': {
            description: `Returns ${returnType}`,
          },
        },
      },
    };
  }

  return {
    openapi: '3.0.0',
    info: {
      title: module.name,
      description: module.description,
      version: '1.0.0',
    },
    paths,
  };
}

/**
 * Generate CATSCAN from module info
 */
function generateCatscan(module: CatscanModule): string {
  const lines: string[] = [];

  lines.push(`# ${module.name}`);
  lines.push('');
  lines.push(module.description);
  lines.push('');

  if (module.tier !== undefined) {
    lines.push(`tier: ${module.tier}`);
    lines.push('');
  }

  lines.push('## API Surface');
  lines.push('');
  for (const item of module.api_surface) {
    lines.push(`- \`${item}\``);
  }
  lines.push('');

  if (module.internal_dependencies.length > 0) {
    lines.push('## Internal Dependencies');
    lines.push('');
    for (const dep of module.internal_dependencies) {
      lines.push(`- \`${dep}\``);
    }
    lines.push('');
  }

  lines.push('## External Dependencies');
  lines.push('');
  if (module.external_dependencies.length > 0) {
    for (const dep of module.external_dependencies) {
      lines.push(`- \`${dep}\``);
    }
  } else {
    lines.push('None');
  }
  lines.push('');

  if (module.functions && module.functions.length > 0) {
    lines.push('## Functions');
    lines.push('');
    for (const func of module.functions) {
      lines.push(`### \`${func.name}\``);
      lines.push('');
      lines.push(func.description);
      if (func.signature) {
        lines.push('');
        lines.push('```typescript');
        lines.push(func.signature);
        lines.push('```');
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// CLI
async function main() {
  program
    .name('catscan-converter')
    .description('Convert CATSCAN.md files to/from various formats')
    .version('1.0.0');

  program
    .command('to-mcp <input>')
    .description('Convert CATSCAN.md to MCP tool definitions')
    .argument('[output]', 'Output JSON file (default: stdout)')
    .action(async (input: string, output?: string) => {
      const content = await fs.readFile(input, 'utf-8');
      const module = parseCatscan(content);
      const mcp = toMCP(module);

      const json = JSON.stringify(mcp, null, 2);
      if (output) {
        await fs.writeFile(output, json);
        console.log(`Wrote MCP tools to ${output}`);
      } else {
        console.log(json);
      }
    });

  program
    .command('to-openapi <input>')
    .description('Convert CATSCAN.md to OpenAPI spec')
    .argument('[output]', 'Output YAML/JSON file (default: stdout)')
    .action(async (input: string, output?: string) => {
      const content = await fs.readFile(input, 'utf-8');
      const module = parseCatscan(content);
      const spec = toOpenAPI(module);

      const json = JSON.stringify(spec, null, 2);
      if (output) {
        await fs.writeFile(output, json);
        console.log(`Wrote OpenAPI spec to ${output}`);
      } else {
        console.log(json);
      }
    });

  program
    .command('validate <input>')
    .description('Validate a CATSCAN.md file')
    .action(async (input: string) => {
      const content = await fs.readFile(input, 'utf-8');
      const module = parseCatscan(content);

      const errors: string[] = [];
      if (!module.name || module.name === 'Unknown') {
        errors.push('Missing module name (H1 header)');
      }
      if (!module.description) {
        errors.push('Missing module description');
      }
      if (module.api_surface.length === 0) {
        errors.push('Empty API surface');
      }

      if (errors.length > 0) {
        console.error('Validation errors:');
        errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      } else {
        console.log('CATSCAN file is valid');
        console.log(`  Module: ${module.name}`);
        console.log(`  API Surface: ${module.api_surface.length} items`);
        console.log(`  Functions: ${module.functions?.length || 0}`);
        console.log(`  Internal deps: ${module.internal_dependencies.length}`);
        console.log(`  External deps: ${module.external_dependencies.length}`);
      }
    });

  program
    .command('info <input>')
    .description('Show information about a CATSCAN.md file')
    .action(async (input: string) => {
      const content = await fs.readFile(input, 'utf-8');
      const module = parseCatscan(content);

      console.log(`Module: ${module.name}`);
      console.log(`Description: ${module.description}`);
      if (module.tier !== undefined) {
        console.log(`Tier: ${module.tier}`);
      }
      console.log('');
      console.log('API Surface:');
      module.api_surface.forEach(item => console.log(`  - ${item}`));
      console.log('');
      console.log('Internal Dependencies:');
      module.internal_dependencies.forEach(dep => console.log(`  - ${dep}`));
      console.log('');
      console.log('External Dependencies:');
      module.external_dependencies.forEach(dep => console.log(`  - ${dep}`));

      if (module.functions && module.functions.length > 0) {
        console.log('');
        console.log('Functions:');
        module.functions.forEach(f => console.log(`  - ${f.name}: ${f.description}`));
      }
    });

  await program.parseAsync(process.argv);
}

// Run CLI
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// Export for programmatic use
export {
  parseCatscan,
  toMCP,
  toOpenAPI,
  generateCatscan,
  CatscanModule,
  CatscanFunction,
  MCPTool,
  MCPToolSet,
  OpenAPISpec,
};
