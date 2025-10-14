// Meta-Tool Creation Patterns Module
// Provides utilities for creating, validating, and managing dynamic tools
const MetaToolCreatorModule = (
  config,
  logger,
  Storage,
  StateManager,
  ToolRunner,
  Errors,
  Utils
) => {
  const { ToolError, ArtifactError } = Errors;
  
  logger.info("[MTCP] Meta-Tool Creator Module initializing...");

  // Tool templates for common patterns
  const TOOL_TEMPLATES = {
    analyzer: {
      name_pattern: "analyze_[domain]",
      schema_template: {
        type: "object",
        properties: {
          target: { type: "string", description: "What to analyze" },
          depth: { type: "number", description: "Analysis depth (1-5)", default: 3 },
          format: { type: "string", enum: ["summary", "detailed", "raw"], default: "summary" }
        },
        required: ["target"]
      }
    },
    transformer: {
      name_pattern: "convert_[from]_to_[to]",
      schema_template: {
        type: "object",
        properties: {
          input: { type: "string", description: "Data to convert" },
          options: { type: "object", description: "Conversion options" }
        },
        required: ["input"]
      }
    },
    validator: {
      name_pattern: "validate_[type]",
      schema_template: {
        type: "object",
        properties: {
          content: { type: "string", description: "Content to validate" },
          rules: { type: "array", description: "Validation rules" },
          strict: { type: "boolean", default: true }
        },
        required: ["content"]
      }
    },
    aggregator: {
      name_pattern: "aggregate_[sources]",
      schema_template: {
        type: "object",
        properties: {
          sources: { type: "array", description: "Data sources to aggregate" },
          method: { type: "string", enum: ["merge", "concat", "intersect"], default: "merge" }
        },
        required: ["sources"]
      }
    }
  };

  // Validate tool definition structure
  const validateToolDefinition = (toolDef) => {
    logger.debug(`[MTCP] Validating tool definition: ${toolDef.name}`);
    
    const errors = [];
    
    // Check required fields
    if (!toolDef.name || typeof toolDef.name !== 'string') {
      errors.push("Tool name is required and must be a string");
    }
    
    if (!toolDef.description || typeof toolDef.description !== 'string') {
      errors.push("Tool description is required and must be a string");
    }
    
    if (!toolDef.inputSchema || typeof toolDef.inputSchema !== 'object') {
      errors.push("Input schema is required and must be an object");
    }
    
    if (!toolDef.implementation || typeof toolDef.implementation !== 'object') {
      errors.push("Implementation is required and must be an object");
    }
    
    // Validate implementation type
    const validTypes = ['javascript', 'composite', 'workflow'];
    if (!validTypes.includes(toolDef.implementation.type)) {
      errors.push(`Implementation type must be one of: ${validTypes.join(', ')}`);
    }
    
    // Type-specific validation
    if (toolDef.implementation.type === 'javascript' && !toolDef.implementation.code) {
      errors.push("JavaScript implementation requires 'code' field");
    }
    
    if (toolDef.implementation.type === 'composite' && !Array.isArray(toolDef.implementation.steps)) {
      errors.push("Composite implementation requires 'steps' array");
    }
    
    if (errors.length > 0) {
      logger.error(`[MTCP] Tool validation failed: ${errors.join('; ')}`);
      return { valid: false, errors };
    }
    
    logger.info(`[MTCP] Tool definition valid: ${toolDef.name}`);
    return { valid: true };
  };

  // Create a new dynamic tool
  const createDynamicTool = async (name, description, inputSchema, implementation, metadata = {}) => {
    logger.info(`[MTCP] Creating dynamic tool: ${name}`);
    
    const toolDef = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      created_cycle: StateManager.getState()?.totalCycles || 0,
      created_reason: metadata.reason || "Created via Meta-Tool Creator",
      declaration: {
        name,
        description,
        inputSchema
      },
      implementation
    };
    
    // Validate before saving
    const validation = validateToolDefinition(toolDef);
    if (!validation.valid) {
      throw new ToolError(`Invalid tool definition: ${validation.errors.join('; ')}`);
    }
    
    // Load existing dynamic tools
    const dynamicToolsPath = "/system/tools-dynamic.json";
    let dynamicTools = [];
    
    try {
      const existing = await Storage.getArtifactContent(dynamicToolsPath);
      if (existing) {
        dynamicTools = JSON.parse(existing);
        logger.debug(`[MTCP] Loaded ${dynamicTools.length} existing dynamic tools`);
      }
    } catch (e) {
      logger.warn(`[MTCP] No existing dynamic tools found, creating new registry`);
    }
    
    // Check for duplicate names
    if (dynamicTools.some(t => t.declaration.name === name)) {
      logger.warn(`[MTCP] Tool '${name}' already exists, updating...`);
      dynamicTools = dynamicTools.filter(t => t.declaration.name !== name);
    }
    
    // Add new tool
    dynamicTools.push(toolDef);
    
    // Save updated tools
    const success = await StateManager.updateArtifact(
      dynamicToolsPath,
      JSON.stringify(dynamicTools, null, 2)
    );
    
    if (!success) {
      // Try creating if update failed
      await StateManager.createArtifact(
        dynamicToolsPath,
        "json",
        JSON.stringify(dynamicTools, null, 2),
        "Dynamic tools registry"
      );
    }
    
    logger.info(`[MTCP] Successfully created tool: ${name}`);
    
    // Emit structured event for tool creation (if UI is available)
    if (UI?.logToAdvanced) {
      UI.logToAdvanced({type: 'tool_created', toolName: name, cycle: toolDef.created_cycle}, 'tool_created');
    }
    
    return toolDef;
  };

  // Generate tool from template
  const generateToolFromTemplate = async (templateType, customizations) => {
    logger.info(`[MTCP] Generating tool from template: ${templateType}`);
    
    const template = TOOL_TEMPLATES[templateType];
    if (!template) {
      throw new ToolError(`Unknown template type: ${templateType}`);
    }
    
    // Apply customizations to template
    const name = customizations.name || template.name_pattern.replace(/\[(\w+)\]/g, customizations.domain || 'custom');
    const description = customizations.description || `Auto-generated ${templateType} tool`;
    const inputSchema = { ...template.schema_template, ...customizations.schema };
    
    // Generate implementation based on type
    let implementation;
    if (templateType === 'analyzer') {
      implementation = {
        type: 'javascript',
        code: customizations.code || `
          // Analyze the target
          const results = [];
          const depth = args.depth || 3;
          
          // Perform analysis based on depth
          for (let i = 0; i < depth; i++) {
            results.push(\`Level \${i + 1} analysis of \${args.target}\`);
          }
          
          return {
            target: args.target,
            depth: depth,
            results: args.format === 'summary' ? results.slice(0, 1) : results
          };
        `
      };
    } else if (templateType === 'validator') {
      implementation = {
        type: 'javascript',
        code: customizations.code || `
          // Validate content against rules
          const errors = [];
          const rules = args.rules || [];
          
          for (const rule of rules) {
            // Apply validation rule
            if (!args.content.includes(rule)) {
              errors.push(\`Failed rule: \${rule}\`);
            }
          }
          
          return {
            valid: errors.length === 0,
            errors: errors,
            strict: args.strict
          };
        `
      };
    } else {
      implementation = customizations.implementation || { type: 'javascript', code: '// TODO: Implement' };
    }
    
    return await createDynamicTool(name, description, inputSchema, implementation, {
      reason: `Generated from ${templateType} template`,
      template: templateType
    });
  };

  // Test a tool implementation before registering
  const testToolImplementation = async (implementation, testCases) => {
    logger.info(`[MTCP] Testing tool implementation with ${testCases.length} cases`);
    
    const results = [];
    
    for (const testCase of testCases) {
      logger.debug(`[MTCP] Running test case: ${JSON.stringify(testCase.input)}`);
      
      try {
        let result;
        
        if (implementation.type === 'javascript') {
          // Execute JavaScript code in sandbox
          const func = new Function('args', 'ToolRunner', 'Storage', 'logger', implementation.code);
          result = await func(testCase.input, ToolRunner, Storage, logger);
        } else if (implementation.type === 'composite') {
          // Execute composite steps
          result = [];
          for (const step of implementation.steps) {
            const stepResult = await ToolRunner.runTool(step.tool, 
              JSON.parse(step.args_template.replace(/\$(\w+)/g, (_, key) => 
                JSON.stringify(testCase.input[key]))));
            result.push(stepResult);
          }
        }
        
        const passed = testCase.shouldError ? false : 
                      testCase.expected ? JSON.stringify(result) === JSON.stringify(testCase.expected) : true;
        
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual: result,
          passed,
          error: null
        });
        
        logger.debug(`[MTCP] Test case ${passed ? 'PASSED' : 'FAILED'}`);
        
      } catch (error) {
        const passed = testCase.shouldError === true;
        
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual: null,
          passed,
          error: error.message
        });
        
        logger.debug(`[MTCP] Test case ${passed ? 'PASSED (expected error)' : 'FAILED'}: ${error.message}`);
      }
    }
    
    const allPassed = results.every(r => r.passed);
    logger.info(`[MTCP] Test results: ${results.filter(r => r.passed).length}/${results.length} passed`);
    
    return {
      passed: allPassed,
      results
    };
  };

  // Analyze existing tools to find patterns
  const analyzeToolPatterns = async () => {
    logger.info("[MTCP] Analyzing existing tool patterns...");
    
    const patterns = {
      naming: {},
      parameters: {},
      implementations: {}
    };
    
    // Load all tools
    const staticTools = JSON.parse(await Storage.getArtifactContent("/modules/tools-read.json") || "[]");
    const writeTools = JSON.parse(await Storage.getArtifactContent("/modules/tools-write.json") || "[]");
    const dynamicTools = JSON.parse(await Storage.getArtifactContent("/system/tools-dynamic.json") || "[]");
    
    const allTools = [...staticTools, ...writeTools, ...dynamicTools.map(t => t.declaration)];
    
    logger.debug(`[MTCP] Analyzing ${allTools.length} total tools`);
    
    // Analyze naming patterns
    for (const tool of allTools) {
      const prefix = tool.name.split('_')[0];
      patterns.naming[prefix] = (patterns.naming[prefix] || 0) + 1;
      
      // Analyze parameters
      if (tool.inputSchema?.properties) {
        for (const param of Object.keys(tool.inputSchema.properties)) {
          patterns.parameters[param] = (patterns.parameters[param] || 0) + 1;
        }
      }
    }
    
    logger.info("[MTCP] Pattern analysis complete");
    return patterns;
  };

  // Suggest improvements for a tool
  const suggestToolImprovements = async (toolName) => {
    logger.info(`[MTCP] Suggesting improvements for tool: ${toolName}`);
    
    const suggestions = [];
    
    // Find the tool
    const dynamicTools = JSON.parse(await Storage.getArtifactContent("/system/tools-dynamic.json") || "[]");
    const tool = dynamicTools.find(t => t.declaration.name === toolName);
    
    if (!tool) {
      logger.warn(`[MTCP] Tool not found: ${toolName}`);
      return { error: "Tool not found" };
    }
    
    // Check for common improvements
    if (!tool.declaration.inputSchema.properties.hasOwnProperty('verbose')) {
      suggestions.push("Add 'verbose' parameter for detailed output control");
    }
    
    if (!tool.declaration.inputSchema.properties.hasOwnProperty('timeout')) {
      suggestions.push("Add 'timeout' parameter for long-running operations");
    }
    
    if (tool.implementation.type === 'javascript' && !tool.implementation.code.includes('try')) {
      suggestions.push("Add error handling with try-catch blocks");
    }
    
    if (!tool.declaration.description.includes('Example')) {
      suggestions.push("Add usage examples to description");
    }
    
    if (!tool.metadata?.version) {
      suggestions.push("Add version tracking for tool evolution");
    }
    
    logger.info(`[MTCP] Generated ${suggestions.length} improvement suggestions`);
    return { suggestions };
  };

  logger.info("[MTCP] Meta-Tool Creator Module initialized successfully");

  return {
    validateToolDefinition,
    createDynamicTool,
    generateToolFromTemplate,
    testToolImplementation,
    analyzeToolPatterns,
    suggestToolImprovements,
    TOOL_TEMPLATES
  };
};