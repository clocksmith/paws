/**
 * Tests for CATSCAN (Codebase Architecture Tracking for Structured Context And Navigation)
 *
 * CATSCAN.md files are documentation contracts for modules containing:
 * - Public API surface (classes, functions, constants)
 * - Function signatures with parameters and return types
 * - Dependencies list
 * - Concise summaries
 */

const { expect } = require('chai');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

// CATSCAN format types
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

/**
 * Parse a CATSCAN.md file into structured data
 */
function parseCatscan(content: string): Partial<CatscanModule> {
  const result: Partial<CatscanModule> = {
    api_surface: [],
    internal_dependencies: [],
    external_dependencies: [],
    functions: [],
    classes: [],
  };

  const lines = content.split('\n');
  let currentSection = '';
  let currentClass: Partial<CatscanClass> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse module name from H1
    if (trimmed.startsWith('# ')) {
      result.name = trimmed.slice(2).trim();
      continue;
    }

    // Parse sections
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.slice(3).toLowerCase();
      currentClass = null;
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
        result.api_surface!.push(item);
      }
      continue;
    }

    // Parse dependencies
    if (currentSection.includes('dependencies')) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const dep = trimmed.slice(2).replace(/`/g, '').trim();
        if (currentSection.includes('internal')) {
          result.internal_dependencies!.push(dep);
        } else if (currentSection.includes('external')) {
          result.external_dependencies!.push(dep);
        }
      }
      continue;
    }

    // Parse functions
    if (currentSection === 'functions') {
      const funcMatch = trimmed.match(/^###\s+`?(\w+)`?\s*$/);
      if (funcMatch) {
        result.functions!.push({
          name: funcMatch[1],
          signature: '',
          description: '',
        });
      }
      continue;
    }
  }

  return result;
}

/**
 * Validate a CATSCAN module against required fields
 */
function validateCatscan(module: Partial<CatscanModule>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!module.name) {
    errors.push('Missing module name');
  }

  if (!module.api_surface || module.api_surface.length === 0) {
    errors.push('Missing or empty API surface');
  }

  if (!module.external_dependencies) {
    errors.push('Missing external dependencies section');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a minimal CATSCAN.md from module info
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

describe('CATSCAN', function () {
  this.timeout(5000);

  describe('parseCatscan', () => {
    it('should parse a valid CATSCAN.md file', () => {
      const content = `# AuthModule

Authentication module for user login and session management.

tier: 2

## API Surface

- \`AuthNotifier\`
- \`AuthRepository\`
- \`authProvider\`

## Internal Dependencies

- \`core/config\`
- \`services/http\`

## External Dependencies

- \`firebase_auth\`
- \`flutter_riverpod\`
`;

      const result = parseCatscan(content);

      expect(result.name).to.equal('AuthModule');
      expect(result.description).to.equal('Authentication module for user login and session management.');
      expect(result.tier).to.equal(2);
      expect(result.api_surface).to.deep.equal(['AuthNotifier', 'AuthRepository', 'authProvider']);
      expect(result.internal_dependencies).to.deep.equal(['core/config', 'services/http']);
      expect(result.external_dependencies).to.deep.equal(['firebase_auth', 'flutter_riverpod']);
    });

    it('should handle CATSCAN with no internal dependencies', () => {
      const content = `# UtilModule

Utility functions.

## API Surface

- \`formatDate\`

## External Dependencies

- \`lodash\`
`;

      const result = parseCatscan(content);

      expect(result.name).to.equal('UtilModule');
      expect(result.api_surface).to.deep.equal(['formatDate']);
      expect(result.internal_dependencies).to.deep.equal([]);
      expect(result.external_dependencies).to.deep.equal(['lodash']);
    });
  });

  describe('validateCatscan', () => {
    it('should validate a complete CATSCAN module', () => {
      const module: Partial<CatscanModule> = {
        name: 'TestModule',
        description: 'Test description',
        api_surface: ['TestClass', 'testFunction'],
        internal_dependencies: [],
        external_dependencies: ['lodash'],
      };

      const result = validateCatscan(module);

      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should fail validation for missing name', () => {
      const module: Partial<CatscanModule> = {
        api_surface: ['TestClass'],
        external_dependencies: [],
      };

      const result = validateCatscan(module);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Missing module name');
    });

    it('should fail validation for empty API surface', () => {
      const module: Partial<CatscanModule> = {
        name: 'TestModule',
        api_surface: [],
        external_dependencies: [],
      };

      const result = validateCatscan(module);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Missing or empty API surface');
    });
  });

  describe('generateCatscan', () => {
    it('should generate valid CATSCAN markdown', () => {
      const module: CatscanModule = {
        name: 'MyModule',
        description: 'A test module for demonstration.',
        tier: 1,
        api_surface: ['MyClass', 'myFunction'],
        internal_dependencies: ['core/utils'],
        external_dependencies: ['express'],
        functions: [
          {
            name: 'myFunction',
            signature: 'function myFunction(x: number): string',
            description: 'Converts a number to a string.',
          },
        ],
      };

      const markdown = generateCatscan(module);

      expect(markdown).to.include('# MyModule');
      expect(markdown).to.include('A test module for demonstration.');
      expect(markdown).to.include('tier: 1');
      expect(markdown).to.include('## API Surface');
      expect(markdown).to.include('- `MyClass`');
      expect(markdown).to.include('- `myFunction`');
      expect(markdown).to.include('## Internal Dependencies');
      expect(markdown).to.include('- `core/utils`');
      expect(markdown).to.include('## External Dependencies');
      expect(markdown).to.include('- `express`');
      expect(markdown).to.include('### `myFunction`');
      expect(markdown).to.include('Converts a number to a string.');
    });

    it('should handle modules with no internal dependencies', () => {
      const module: CatscanModule = {
        name: 'StandaloneModule',
        description: 'A standalone module.',
        api_surface: ['standaloneFunc'],
        internal_dependencies: [],
        external_dependencies: [],
      };

      const markdown = generateCatscan(module);

      expect(markdown).to.include('# StandaloneModule');
      expect(markdown).not.to.include('## Internal Dependencies');
      expect(markdown).to.include('## External Dependencies');
      expect(markdown).to.include('None');
    });
  });

  describe('round-trip', () => {
    it('should parse generated CATSCAN back to original structure', () => {
      const original: CatscanModule = {
        name: 'RoundTripModule',
        description: 'Testing round-trip conversion.',
        api_surface: ['ClassA', 'funcB'],
        internal_dependencies: ['core/base'],
        external_dependencies: ['axios', 'lodash'],
      };

      const markdown = generateCatscan(original);
      const parsed = parseCatscan(markdown);

      expect(parsed.name).to.equal(original.name);
      expect(parsed.description).to.equal(original.description);
      expect(parsed.api_surface).to.deep.equal(original.api_surface);
      expect(parsed.internal_dependencies).to.deep.equal(original.internal_dependencies);
      expect(parsed.external_dependencies).to.deep.equal(original.external_dependencies);
    });
  });
});

// Export utilities for use in converter scripts
module.exports = { parseCatscan, validateCatscan, generateCatscan };
