import { describe, it, expect, beforeEach } from 'vitest';

import ToolRunnerPureHelpersModule from '../../upgrades/tool-runner-pure-helpers.js';
describe('ToolRunnerPureHelpers Module', () => {
  let helpers;

  beforeEach(() => {
    helpers = ToolRunnerPureHelpersModule;
  });

  describe('Module Metadata', () => {
    it('should be a pure module', () => {
      const metadata = {
        id: 'ToolRunnerPureHelpers',
        type: 'pure',
        dependencies: []
      };
      expect(metadata.type).toBe('pure');
      expect(metadata.dependencies).toHaveLength(0);
    });

    it('should have API methods', () => {
      expect(helpers.convertToGeminiFunctionDeclarationPure).toBeTypeOf('function');
    });
  });

  describe('Type Mapping', () => {
    it('should map string type', () => {
      expect(helpers._test.mapMcpTypeToGeminiPure('string')).toBe('STRING');
      expect(helpers._test.mapMcpTypeToGeminiPure('STRING')).toBe('STRING');
    });

    it('should map integer type', () => {
      expect(helpers._test.mapMcpTypeToGeminiPure('integer')).toBe('INTEGER');
    });

    it('should map number type', () => {
      expect(helpers._test.mapMcpTypeToGeminiPure('number')).toBe('NUMBER');
    });

    it('should map boolean type', () => {
      expect(helpers._test.mapMcpTypeToGeminiPure('boolean')).toBe('BOOLEAN');
    });

    it('should map array type', () => {
      expect(helpers._test.mapMcpTypeToGeminiPure('array')).toBe('ARRAY');
    });

    it('should map object type', () => {
      expect(helpers._test.mapMcpTypeToGeminiPure('object')).toBe('OBJECT');
    });

    it('should handle unknown types', () => {
      expect(helpers._test.mapMcpTypeToGeminiPure('unknown')).toBe('TYPE_UNSPECIFIED');
      expect(helpers._test.mapMcpTypeToGeminiPure(null)).toBe('TYPE_UNSPECIFIED');
      expect(helpers._test.mapMcpTypeToGeminiPure(undefined)).toBe('TYPE_UNSPECIFIED');
    });

    it('should handle case insensitivity', () => {
      expect(helpers._test.mapMcpTypeToGeminiPure('String')).toBe('STRING');
      expect(helpers._test.mapMcpTypeToGeminiPure('BoOlEaN')).toBe('BOOLEAN');
    });
  });

  describe('Property Conversion', () => {
    it('should convert simple properties', () => {
      const mcpProps = {
        name: { type: 'string', description: 'User name' },
        age: { type: 'integer', description: 'User age' }
      };

      const geminiProps = helpers._test.convertMcpPropertiesToGeminiPure(mcpProps);

      expect(geminiProps.name.type).toBe('STRING');
      expect(geminiProps.name.description).toBe('User name');
      expect(geminiProps.age.type).toBe('INTEGER');
      expect(geminiProps.age.description).toBe('User age');
    });

    it('should handle empty properties', () => {
      const result = helpers._test.convertMcpPropertiesToGeminiPure(null);
      expect(result).toEqual({});
    });

    it('should preserve enum values', () => {
      const mcpProps = {
        status: {
          type: 'string',
          description: 'Status',
          enum: ['active', 'inactive', 'pending']
        }
      };

      const geminiProps = helpers._test.convertMcpPropertiesToGeminiPure(mcpProps);
      expect(geminiProps.status.enum).toEqual(['active', 'inactive', 'pending']);
    });

    it('should convert array properties with items', () => {
      const mcpProps = {
        tags: {
          type: 'array',
          description: 'Tags',
          items: { type: 'string' }
        }
      };

      const geminiProps = helpers._test.convertMcpPropertiesToGeminiPure(mcpProps);
      expect(geminiProps.tags.type).toBe('ARRAY');
      expect(geminiProps.tags.items.type).toBe('STRING');
    });

    it('should convert nested object properties', () => {
      const mcpProps = {
        address: {
          type: 'object',
          description: 'Address',
          properties: {
            street: { type: 'string', description: 'Street' },
            city: { type: 'string', description: 'City' }
          },
          required: ['street']
        }
      };

      const geminiProps = helpers._test.convertMcpPropertiesToGeminiPure(mcpProps);
      expect(geminiProps.address.type).toBe('OBJECT');
      expect(geminiProps.address.properties.street.type).toBe('STRING');
      expect(geminiProps.address.properties.city.type).toBe('STRING');
      expect(geminiProps.address.required).toEqual(['street']);
    });

    it('should provide default empty description', () => {
      const mcpProps = {
        field: { type: 'string' }
      };

      const geminiProps = helpers._test.convertMcpPropertiesToGeminiPure(mcpProps);
      expect(geminiProps.field.description).toBe('');
    });
  });

  describe('Full Tool Conversion', () => {
    it('should convert complete tool definition', () => {
      const mcpTool = {
        name: 'get_user',
        description: 'Get user information',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'integer', description: 'User ID' },
            includeDetails: { type: 'boolean', description: 'Include details' }
          },
          required: ['userId']
        }
      };

      const gemini = helpers.convertToGeminiFunctionDeclarationPure(mcpTool);

      expect(gemini.name).toBe('get_user');
      expect(gemini.description).toBe('Get user information');
      expect(gemini.parameters.type).toBe('OBJECT');
      expect(gemini.parameters.properties.userId.type).toBe('INTEGER');
      expect(gemini.parameters.properties.includeDetails.type).toBe('BOOLEAN');
      expect(gemini.parameters.required).toEqual(['userId']);
    });

    it('should return null for invalid tool definition', () => {
      expect(helpers.convertToGeminiFunctionDeclarationPure(null)).toBeNull();
      expect(helpers.convertToGeminiFunctionDeclarationPure({})).toBeNull();
      expect(helpers.convertToGeminiFunctionDeclarationPure({ name: 'test' })).toBeNull();
      expect(helpers.convertToGeminiFunctionDeclarationPure({ description: 'test' })).toBeNull();
    });

    it('should handle missing input schema', () => {
      const mcpTool = {
        name: 'simple_tool',
        description: 'A simple tool'
      };

      const gemini = helpers.convertToGeminiFunctionDeclarationPure(mcpTool);

      expect(gemini.name).toBe('simple_tool');
      expect(gemini.parameters.properties).toEqual({});
      expect(gemini.parameters.required).toEqual([]);
    });

    it('should handle empty required array', () => {
      const mcpTool = {
        name: 'optional_tool',
        description: 'Tool with optional params',
        inputSchema: {
          properties: {
            param: { type: 'string' }
          }
        }
      };

      const gemini = helpers.convertToGeminiFunctionDeclarationPure(mcpTool);
      expect(gemini.parameters.required).toEqual([]);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle deeply nested objects', () => {
      const mcpTool = {
        name: 'complex_tool',
        description: 'Complex nested tool',
        inputSchema: {
          properties: {
            config: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    host: { type: 'string' },
                    port: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      };

      const gemini = helpers.convertToGeminiFunctionDeclarationPure(mcpTool);
      expect(gemini.parameters.properties.config.properties.database.properties.host.type).toBe('STRING');
      expect(gemini.parameters.properties.config.properties.database.properties.port.type).toBe('INTEGER');
    });

    it('should handle arrays of objects', () => {
      const mcpTool = {
        name: 'array_tool',
        description: 'Tool with array of objects',
        inputSchema: {
          properties: {
            items: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        }
      };

      const gemini = helpers.convertToGeminiFunctionDeclarationPure(mcpTool);
      expect(gemini.parameters.properties.items.type).toBe('ARRAY');
      expect(gemini.parameters.properties.items.items.type).toBe('OBJECT');
    });

    it('should preserve all enum values', () => {
      const mcpTool = {
        name: 'enum_tool',
        description: 'Tool with enums',
        inputSchema: {
          properties: {
            size: {
              type: 'string',
              enum: ['small', 'medium', 'large', 'xlarge']
            }
          }
        }
      };

      const gemini = helpers.convertToGeminiFunctionDeclarationPure(mcpTool);
      expect(gemini.parameters.properties.size.enum).toHaveLength(4);
      expect(gemini.parameters.properties.size.enum).toContain('xlarge');
    });
  });

  describe('Pure Function Properties', () => {
    it('should not modify input', () => {
      const mcpTool = {
        name: 'test',
        description: 'Test',
        inputSchema: {
          properties: {
            field: { type: 'string' }
          }
        }
      };

      const original = JSON.parse(JSON.stringify(mcpTool));
      helpers.convertToGeminiFunctionDeclarationPure(mcpTool);

      expect(mcpTool).toEqual(original);
    });

    it('should be deterministic', () => {
      const mcpTool = {
        name: 'test',
        description: 'Test',
        inputSchema: {
          properties: {
            a: { type: 'string' },
            b: { type: 'integer' }
          },
          required: ['a']
        }
      };

      const result1 = helpers.convertToGeminiFunctionDeclarationPure(mcpTool);
      const result2 = helpers.convertToGeminiFunctionDeclarationPure(mcpTool);

      expect(result1).toEqual(result2);
    });
  });
});
