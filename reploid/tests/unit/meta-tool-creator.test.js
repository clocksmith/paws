import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import MetaToolCreatorModule from '../../upgrades/meta-tool-creator.js';

describe('MetaToolCreatorModule', () => {
  let mockDeps;
  let instance;

  beforeEach(() => {
    mockDeps = {
      config: {
        toolsPath: '/system/tools-dynamic.json'
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      },
      Storage: {
        getArtifactContent: vi.fn(),
        saveArtifact: vi.fn()
      },
      StateManager: {
        getState: vi.fn(() => ({ totalCycles: 10 })),
        updateArtifact: vi.fn(),
        createArtifact: vi.fn()
      },
      ToolRunner: {
        runTool: vi.fn()
      },
      Errors: {
        ToolError: class ToolError extends Error {
          constructor(message) {
            super(message);
            this.name = 'ToolError';
          }
        },
        ArtifactError: class ArtifactError extends Error {
          constructor(message) {
            super(message);
            this.name = 'ArtifactError';
          }
        }
      },
      Utils: {
        generateId: vi.fn(() => 'test-id-123')
      }
    };

  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should initialize with correct dependencies', () => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );

      expect(instance).toBeDefined();
      expect(mockDeps.logger.info).toHaveBeenCalledWith(expect.stringContaining('initializing'));
    });

    it('should expose TOOL_TEMPLATES', () => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );

      expect(instance.TOOL_TEMPLATES).toBeDefined();
      expect(instance.TOOL_TEMPLATES.analyzer).toBeDefined();
      expect(instance.TOOL_TEMPLATES.validator).toBeDefined();
    });
  });

  describe('Tool Validation', () => {
    beforeEach(() => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );
    });

    it('should validate complete tool definition', () => {
      const toolDef = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: { type: 'object' },
        implementation: { type: 'javascript', code: 'return true;' }
      };

      const result = instance.validateToolDefinition(toolDef);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject tool without name', () => {
      const toolDef = {
        description: 'Test tool',
        inputSchema: {},
        implementation: { type: 'javascript' }
      };

      const result = instance.validateToolDefinition(toolDef);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tool name is required and must be a string');
    });

    it('should reject tool without description', () => {
      const toolDef = {
        name: 'test_tool',
        inputSchema: {},
        implementation: { type: 'javascript' }
      };

      const result = instance.validateToolDefinition(toolDef);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tool description is required and must be a string');
    });

    it('should reject tool without inputSchema', () => {
      const toolDef = {
        name: 'test_tool',
        description: 'Test tool',
        implementation: { type: 'javascript' }
      };

      const result = instance.validateToolDefinition(toolDef);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Input schema is required and must be an object');
    });

    it('should reject tool with invalid implementation type', () => {
      const toolDef = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {},
        implementation: { type: 'invalid' }
      };

      const result = instance.validateToolDefinition(toolDef);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Implementation type must be one of');
    });

    it('should accept javascript implementation type', () => {
      const toolDef = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {},
        implementation: { type: 'javascript', code: 'return 42;' }
      };

      const result = instance.validateToolDefinition(toolDef);
      expect(result.valid).toBe(true);
    });

    it('should accept composite implementation type', () => {
      const toolDef = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {},
        implementation: { type: 'composite', steps: [] }
      };

      const result = instance.validateToolDefinition(toolDef);
      expect(result.valid).toBe(true);
    });

    it('should accept workflow implementation type', () => {
      const toolDef = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {},
        implementation: { type: 'workflow' }
      };

      const result = instance.validateToolDefinition(toolDef);
      expect(result.valid).toBe(true);
    });
  });

  describe('Dynamic Tool Creation', () => {
    beforeEach(() => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );

      mockDeps.Storage.getArtifactContent.mockResolvedValue('[]');
      mockDeps.StateManager.updateArtifact.mockResolvedValue(true);
    });

    it('should create a new dynamic tool', async () => {
      const tool = await instance.createDynamicTool(
        'test_tool',
        'Test tool description',
        { type: 'object' },
        { type: 'javascript', code: 'return true;' }
      );

      expect(tool).toBeDefined();
      expect(tool.declaration.name).toBe('test_tool');
      expect(mockDeps.logger.info).toHaveBeenCalledWith(expect.stringContaining('Creating dynamic tool'));
    });

    it('should generate tool ID from name', async () => {
      const tool = await instance.createDynamicTool(
        'Test Tool Name',
        'Description',
        { type: 'object' },
        { type: 'javascript', code: 'return true;' }
      );

      expect(tool.id).toBe('test_tool_name');
    });

    it('should include creation metadata', async () => {
      mockDeps.StateManager.getState.mockReturnValue({ totalCycles: 42 });

      const tool = await instance.createDynamicTool(
        'test_tool',
        'Description',
        { type: 'object' },
        { type: 'javascript', code: 'return true;' },
        { reason: 'Test creation' }
      );

      expect(tool.created_cycle).toBe(42);
      expect(tool.created_reason).toBe('Test creation');
    });

    it('should throw error for invalid tool definition', async () => {
      await expect(
        instance.createDynamicTool(
          '',
          'Description',
          { type: 'object' },
          { type: 'invalid' }
        )
      ).rejects.toThrow('Invalid tool definition');
    });

    it('should update existing tool with same name', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue(
        JSON.stringify([{
          declaration: { name: 'test_tool' },
          implementation: { type: 'javascript' }
        }])
      );

      await instance.createDynamicTool(
        'test_tool',
        'Updated description',
        { type: 'object' },
        { type: 'javascript', code: 'return true;' }
      );

      expect(mockDeps.logger.warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    it('should fallback to createArtifact if update fails', async () => {
      mockDeps.StateManager.updateArtifact.mockResolvedValue(false);
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      await instance.createDynamicTool(
        'test_tool',
        'Description',
        { type: 'object' },
        { type: 'javascript', code: 'return true;' }
      );

      expect(mockDeps.StateManager.createArtifact).toHaveBeenCalled();
    });
  });

  describe('Template-based Generation', () => {
    beforeEach(() => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );

      mockDeps.Storage.getArtifactContent.mockResolvedValue('[]');
      mockDeps.StateManager.updateArtifact.mockResolvedValue(true);
    });

    it('should generate tool from analyzer template', async () => {
      const tool = await instance.generateToolFromTemplate('analyzer', {
        name: 'analyze_code',
        description: 'Analyze code quality'
      });

      expect(tool).toBeDefined();
      expect(tool.declaration.name).toBe('analyze_code');
    });

    it('should generate tool from validator template', async () => {
      const tool = await instance.generateToolFromTemplate('validator', {
        name: 'validate_json',
        description: 'Validate JSON format'
      });

      expect(tool).toBeDefined();
      expect(tool.declaration.name).toBe('validate_json');
    });

    it('should throw error for unknown template', async () => {
      await expect(
        instance.generateToolFromTemplate('unknown', {})
      ).rejects.toThrow('Unknown template type');
    });

    it('should merge custom schema with template', async () => {
      const tool = await instance.generateToolFromTemplate('analyzer', {
        name: 'custom_analyzer',
        schema: { properties: { custom: { type: 'string' } } }
      });

      expect(tool.declaration.inputSchema).toHaveProperty('properties');
    });

    it('should use custom implementation if provided', async () => {
      const customCode = 'return "custom";';
      const tool = await instance.generateToolFromTemplate('analyzer', {
        name: 'custom_analyzer',
        code: customCode
      });

      expect(tool.implementation.code).toContain('custom');
    });
  });

  describe('Tool Testing', () => {
    beforeEach(() => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );
    });

    it('should test tool implementation with test cases', async () => {
      const implementation = {
        type: 'javascript',
        code: 'return args.value * 2;'
      };

      const testCases = [
        { input: { value: 5 }, expected: 10 }
      ];

      const result = await instance.testToolImplementation(implementation, testCases);

      expect(result.passed).toBeDefined();
      expect(result.results).toHaveLength(1);
    });

    it('should mark passing tests', async () => {
      const implementation = {
        type: 'javascript',
        code: 'return args.value;'
      };

      const testCases = [
        { input: { value: 42 }, expected: 42 }
      ];

      const result = await instance.testToolImplementation(implementation, testCases);

      expect(result.results[0].passed).toBe(true);
    });

    it('should mark failing tests', async () => {
      const implementation = {
        type: 'javascript',
        code: 'return args.value;'
      };

      const testCases = [
        { input: { value: 42 }, expected: 100 }
      ];

      const result = await instance.testToolImplementation(implementation, testCases);

      expect(result.results[0].passed).toBe(false);
    });

    it('should handle test errors', async () => {
      const implementation = {
        type: 'javascript',
        code: 'throw new Error("Test error");'
      };

      const testCases = [
        { input: {}, shouldError: true }
      ];

      const result = await instance.testToolImplementation(implementation, testCases);

      expect(result.results[0].passed).toBe(true);
      expect(result.results[0].error).toBe('Test error');
    });

    it('should test multiple cases', async () => {
      const implementation = {
        type: 'javascript',
        code: 'return args.value * 2;'
      };

      const testCases = [
        { input: { value: 1 }, expected: 2 },
        { input: { value: 5 }, expected: 10 },
        { input: { value: 10 }, expected: 20 }
      ];

      const result = await instance.testToolImplementation(implementation, testCases);

      expect(result.results).toHaveLength(3);
      expect(result.passed).toBe(true);
    });
  });

  describe('Pattern Analysis', () => {
    beforeEach(() => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );

      mockDeps.Storage.getArtifactContent.mockImplementation((path) => {
        if (path === '/modules/tools-read.json') {
          return Promise.resolve(JSON.stringify([
            { name: 'read_file', inputSchema: { properties: { path: {} } } },
            { name: 'read_artifact', inputSchema: { properties: { path: {} } } }
          ]));
        }
        return Promise.resolve('[]');
      });
    });

    it('should analyze tool naming patterns', async () => {
      const patterns = await instance.analyzeToolPatterns();

      expect(patterns).toHaveProperty('naming');
      expect(patterns.naming.read).toBe(2);
    });

    it('should analyze parameter patterns', async () => {
      const patterns = await instance.analyzeToolPatterns();

      expect(patterns).toHaveProperty('parameters');
      expect(patterns.parameters.path).toBe(2);
    });

    it('should handle empty tool list', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue('[]');

      const patterns = await instance.analyzeToolPatterns();

      expect(patterns.naming).toEqual({});
      expect(patterns.parameters).toEqual({});
    });
  });

  describe('Tool Improvement Suggestions', () => {
    beforeEach(() => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );
    });

    it('should suggest adding verbose parameter', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue(
        JSON.stringify([{
          declaration: {
            name: 'test_tool',
            description: 'Test',
            inputSchema: { properties: {} }
          },
          implementation: { type: 'javascript', code: 'return true;' }
        }])
      );

      const result = await instance.suggestToolImprovements('test_tool');

      expect(result.suggestions).toContain("Add 'verbose' parameter for detailed output control");
    });

    it('should suggest adding examples', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue(
        JSON.stringify([{
          declaration: {
            name: 'test_tool',
            description: 'Test tool',
            inputSchema: { properties: { verbose: {} } }
          },
          implementation: { type: 'javascript', code: 'return true;' }
        }])
      );

      const result = await instance.suggestToolImprovements('test_tool');

      expect(result.suggestions).toContain('Add usage examples to description');
    });

    it('should return error for non-existent tool', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue('[]');

      const result = await instance.suggestToolImprovements('non_existent');

      expect(result.error).toBe('Tool not found');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );
    });

    it('should handle Storage errors gracefully', async () => {
      mockDeps.Storage.getArtifactContent.mockRejectedValue(new Error('Storage error'));

      // Should create new registry
      mockDeps.StateManager.updateArtifact.mockResolvedValue(false);
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      const tool = await instance.createDynamicTool(
        'test_tool',
        'Description',
        { type: 'object' },
        { type: 'javascript', code: 'return true;' }
      );

      expect(tool).toBeDefined();
      expect(mockDeps.logger.warn).toHaveBeenCalled();
    });

    it('should throw ToolError for validation failures', async () => {
      await expect(
        instance.createDynamicTool('', '', {}, {})
      ).rejects.toThrow(mockDeps.Errors.ToolError);
    });

    it('should log errors during pattern analysis', async () => {
      mockDeps.Storage.getArtifactContent.mockRejectedValue(new Error('Analysis failed'));

      await expect(
        instance.analyzeToolPatterns()
      ).rejects.toThrow();
    });
  });

  describe('API Exposure', () => {
    beforeEach(() => {
      instance = MetaToolCreatorModule(
        mockDeps.config,
        mockDeps.logger,
        mockDeps.Storage,
        mockDeps.StateManager,
        mockDeps.ToolRunner,
        mockDeps.Errors,
        mockDeps.Utils
      );
    });

    it('should expose all public methods', () => {
      expect(typeof instance.validateToolDefinition).toBe('function');
      expect(typeof instance.createDynamicTool).toBe('function');
      expect(typeof instance.generateToolFromTemplate).toBe('function');
      expect(typeof instance.testToolImplementation).toBe('function');
      expect(typeof instance.analyzeToolPatterns).toBe('function');
      expect(typeof instance.suggestToolImprovements).toBe('function');
    });

    it('should expose TOOL_TEMPLATES constant', () => {
      expect(instance.TOOL_TEMPLATES).toBeDefined();
      expect(typeof instance.TOOL_TEMPLATES).toBe('object');
    });
  });
});
