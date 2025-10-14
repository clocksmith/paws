// Blueprint Creation Module
// Provides utilities for creating and managing blueprint documentation
const BlueprintCreatorModule = (
  config,
  logger,
  Storage,
  StateManager,
  Utils,
  Errors
) => {
  const { ArtifactError } = Errors;
  
  logger.info("[BLPR] Blueprint Creator Module initializing...");

  // Blueprint numbering system
  const BLUEPRINT_RANGES = {
    upgrade: { start: 0x000001, end: 0x000FFF, prefix: "Upgrade Blueprint" },
    meta: { start: 0x001000, end: 0x001FFF, prefix: "Meta Blueprint" },
    integration: { start: 0x002000, end: 0x002FFF, prefix: "Integration Blueprint" },
    evolution: { start: 0x003000, end: 0x003FFF, prefix: "Evolution Blueprint" }
  };

  // Blueprint template structure
  const BLUEPRINT_TEMPLATE = `# Blueprint 0x[[NUMBER]]: [[TITLE]]

**Objective:** To [[OBJECTIVE]]

**Target Upgrade:** [[TARGET_ID]] 

**Prerequisites:** [[PREREQUISITES]]

**Affected Artifacts:** [[ARTIFACTS]]

---

### 1. The Strategic Imperative

[[WHY_SECTION]]

### 2. The Architectural Solution

[[ARCHITECTURE_SECTION]]

### 3. The Implementation Pathway

[[IMPLEMENTATION_SECTION]]

### 4. [[CUSTOM_SECTION_TITLE]]

[[CUSTOM_SECTION_CONTENT]]

### 5. Validation and Testing

[[VALIDATION_SECTION]]

### 6. Evolution Opportunities

[[EVOLUTION_SECTION]]`;

  // Get next available blueprint number
  const getNextBlueprintNumber = async (category = 'meta') => {
    logger.debug(`[BLPR] Finding next blueprint number for category: ${category}`);
    
    const range = BLUEPRINT_RANGES[category];
    if (!range) {
      throw new ArtifactError(`Unknown blueprint category: ${category}`);
    }
    
    // List all existing blueprints
    const allMeta = await StateManager.getAllArtifactMetadata();
    const blueprintPaths = Object.keys(allMeta).filter(path => path.startsWith('/docs/0x'));
    
    logger.debug(`[BLPR] Found ${blueprintPaths.length} existing blueprints`);
    
    // Extract numbers and find highest in range
    let highest = range.start - 1;
    
    for (const path of blueprintPaths) {
      const match = path.match(/0x([0-9A-Fa-f]+)/);
      if (match) {
        const num = parseInt(match[1], 16);
        if (num >= range.start && num <= range.end && num > highest) {
          highest = num;
        }
      }
    }
    
    const next = highest + 1;
    
    if (next > range.end) {
      logger.warn(`[BLPR] Blueprint range exhausted for category: ${category}`);
      throw new ArtifactError(`No available blueprint numbers in ${category} range`);
    }
    
    const hexNumber = next.toString(16).toUpperCase().padStart(6, '0');
    logger.info(`[BLPR] Next blueprint number: 0x${hexNumber}`);
    
    return hexNumber;
  };

  // Create a new blueprint
  const createBlueprint = async (title, category, content) => {
    logger.info(`[BLPR] Creating blueprint: ${title} (category: ${category})`);
    
    const number = await getNextBlueprintNumber(category);
    const filename = `0x${number}-${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    const path = `/docs/${filename}`;
    
    logger.debug(`[BLPR] Blueprint path: ${path}`);
    
    // Check if already exists
    const existing = await StateManager.getArtifactMetadata(path);
    if (existing) {
      logger.warn(`[BLPR] Blueprint already exists: ${path}`);
      throw new ArtifactError(`Blueprint already exists: ${path}`);
    }
    
    // Create the blueprint
    const success = await StateManager.createArtifact(
      path,
      'markdown',
      content,
      `${BLUEPRINT_RANGES[category].prefix}: ${title}`
    );
    
    if (!success) {
      throw new ArtifactError(`Failed to create blueprint: ${path}`);
    }
    
    logger.info(`[BLPR] Blueprint created successfully: ${filename}`);
    
    return {
      number: `0x${number}`,
      path,
      filename,
      category,
      title
    };
  };

  // Generate blueprint from template
  const generateBlueprintFromTemplate = async (params) => {
    logger.info("[BLPR] Generating blueprint from template...");
    
    const {
      title,
      category = 'meta',
      objective,
      targetUpgrade = 'Meta-knowledge',
      prerequisites = 'None',
      affectedArtifacts = 'Various',
      whySection,
      architectureSection,
      implementationSection,
      customSectionTitle = 'Additional Considerations',
      customSectionContent = '',
      validationSection,
      evolutionSection
    } = params;
    
    // Get next number
    const number = await getNextBlueprintNumber(category);
    
    // Fill in template
    let content = BLUEPRINT_TEMPLATE
      .replace('[[NUMBER]]', number)
      .replace('[[TITLE]]', title)
      .replace('[[OBJECTIVE]]', objective)
      .replace('[[TARGET_ID]]', targetUpgrade)
      .replace('[[PREREQUISITES]]', prerequisites)
      .replace('[[ARTIFACTS]]', affectedArtifacts)
      .replace('[[WHY_SECTION]]', whySection)
      .replace('[[ARCHITECTURE_SECTION]]', architectureSection)
      .replace('[[IMPLEMENTATION_SECTION]]', implementationSection)
      .replace('[[CUSTOM_SECTION_TITLE]]', customSectionTitle)
      .replace('[[CUSTOM_SECTION_CONTENT]]', customSectionContent)
      .replace('[[VALIDATION_SECTION]]', validationSection)
      .replace('[[EVOLUTION_SECTION]]', evolutionSection);
    
    logger.debug(`[BLPR] Generated blueprint content (${content.length} chars)`);
    
    return await createBlueprint(title, category, content);
  };

  // Analyze existing upgrade to create blueprint
  const createBlueprintFromUpgrade = async (upgradePath) => {
    logger.info(`[BLPR] Creating blueprint from upgrade: ${upgradePath}`);
    
    // Read the upgrade code
    const upgradeContent = await Storage.getArtifactContent(upgradePath);
    if (!upgradeContent) {
      throw new ArtifactError(`Upgrade not found: ${upgradePath}`);
    }
    
    // Extract key information
    const moduleName = upgradePath.split('/').pop().replace('.js', '');
    const analysis = analyzeCode(upgradeContent);
    
    logger.debug(`[BLPR] Analyzed upgrade: ${moduleName}`);
    
    // Generate blueprint content
    const params = {
      title: `${moduleName} Implementation`,
      category: 'upgrade',
      objective: `implement the ${moduleName} module with its core functionality`,
      targetUpgrade: generateUpgradeId(moduleName),
      prerequisites: analysis.dependencies.join(', ') || 'None',
      affectedArtifacts: upgradePath,
      whySection: generateWhySection(moduleName, analysis),
      architectureSection: generateArchitectureSection(analysis),
      implementationSection: generateImplementationSteps(moduleName, analysis),
      validationSection: generateValidationSection(moduleName),
      evolutionSection: generateEvolutionSection(moduleName)
    };
    
    return await generateBlueprintFromTemplate(params);
  };

  // Analyze code structure
  const analyzeCode = (code) => {
    logger.debug("[BLPR] Analyzing code structure...");
    
    const analysis = {
      functions: [],
      dependencies: [],
      exports: [],
      patterns: []
    };
    
    // Find function definitions
    const funcMatches = code.matchAll(/(?:const|let|var|function)\s+(\w+)\s*=?\s*(?:async\s+)?\(/g);
    for (const match of funcMatches) {
      analysis.functions.push(match[1]);
    }
    
    // Find dependencies (modules passed to constructor)
    const depMatch = code.match(/Module\s*\(([^)]+)\)/);
    if (depMatch) {
      analysis.dependencies = depMatch[1].split(',').map(d => d.trim());
    }
    
    // Find exports
    const exportMatch = code.match(/return\s*{([^}]+)}/);
    if (exportMatch) {
      analysis.exports = exportMatch[1].split(',').map(e => e.trim());
    }
    
    // Identify patterns
    if (code.includes('async')) analysis.patterns.push('async/await');
    if (code.includes('try')) analysis.patterns.push('error handling');
    if (code.includes('logger')) analysis.patterns.push('logging');
    if (code.includes('class')) analysis.patterns.push('class-based');
    
    logger.debug(`[BLPR] Found ${analysis.functions.length} functions, ${analysis.dependencies.length} dependencies`);
    
    return analysis;
  };

  // Generate sections based on analysis
  const generateWhySection = (moduleName, analysis) => {
    return `The ${moduleName} module is essential for providing ${analysis.exports.join(', ')} capabilities. ` +
           `It ${analysis.patterns.includes('async/await') ? 'handles asynchronous operations' : 'provides synchronous functionality'} ` +
           `and integrates with ${analysis.dependencies.length} other modules to deliver its functionality.`;
  };

  const generateArchitectureSection = (analysis) => {
    return `The module follows these architectural principles:\n\n` +
           `**Core Functions:**\n${analysis.functions.map(f => `- \`${f}\`: Handles specific functionality`).join('\n')}\n\n` +
           `**Dependencies:**\n${analysis.dependencies.map(d => `- ${d}: Required for operation`).join('\n')}\n\n` +
           `**Patterns Used:**\n${analysis.patterns.map(p => `- ${p}`).join('\n')}`;
  };

  const generateImplementationSteps = (moduleName, analysis) => {
    const steps = [
      `1. Create the module wrapper function that accepts dependencies: ${analysis.dependencies.join(', ')}`,
      `2. Initialize module-level variables and configuration`,
      `3. Implement core functions:\n${analysis.functions.map(f => `   - ${f}()`).join('\n')}`,
      `4. Add error handling and logging throughout`,
      `5. Create the return object with public interface: ${analysis.exports.join(', ')}`,
      `6. Test each function independently`,
      `7. Integrate with other modules`
    ];
    
    return steps.join('\n');
  };

  const generateValidationSection = (moduleName) => {
    return `To validate the ${moduleName} implementation:\n\n` +
           `1. **Unit Tests:** Test each exported function with various inputs\n` +
           `2. **Integration Tests:** Verify interaction with dependencies\n` +
           `3. **Error Cases:** Ensure proper error handling\n` +
           `4. **Performance:** Check for memory leaks and efficiency\n` +
           `5. **Logging:** Verify all operations are properly logged`;
  };

  const generateEvolutionSection = (moduleName) => {
    return `The ${moduleName} module can be enhanced by:\n\n` +
           `- Adding caching for improved performance\n` +
           `- Implementing additional utility functions\n` +
           `- Creating configuration options for flexibility\n` +
           `- Adding metrics and monitoring\n` +
           `- Extending to support new use cases`;
  };

  const generateUpgradeId = (moduleName) => {
    // Generate 4-char ID from module name
    const words = moduleName.split('-');
    if (words.length >= 2) {
      return words.map(w => w[0].toUpperCase()).join('').substring(0, 4);
    }
    return moduleName.substring(0, 4).toUpperCase();
  };

  // Validate blueprint structure
  const validateBlueprint = (content) => {
    logger.debug("[BLPR] Validating blueprint structure...");
    
    const requiredSections = [
      '# Blueprint 0x',
      '**Objective:**',
      '**Target Upgrade:**',
      '**Prerequisites:**',
      'The Strategic Imperative',
      'The Architectural Solution',
      'The Implementation Pathway'
    ];
    
    const missing = [];
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        missing.push(section);
      }
    }
    
    if (missing.length > 0) {
      logger.warn(`[BLPR] Blueprint missing sections: ${missing.join(', ')}`);
      return {
        valid: false,
        missing
      };
    }
    
    logger.debug("[BLPR] Blueprint structure valid");
    return { valid: true };
  };

  // List all blueprints by category
  const listBlueprints = async (category = null) => {
    logger.info(`[BLPR] Listing blueprints${category ? ` for category: ${category}` : ''}`);
    
    const allMeta = await StateManager.getAllArtifactMetadata();
    const blueprints = [];
    
    for (const [path, meta] of Object.entries(allMeta)) {
      if (path.startsWith('/docs/0x')) {
        const match = path.match(/0x([0-9A-Fa-f]+)/);
        if (match) {
          const num = parseInt(match[1], 16);
          let blueprintCategory = null;
          
          // Determine category from number
          for (const [cat, range] of Object.entries(BLUEPRINT_RANGES)) {
            if (num >= range.start && num <= range.end) {
              blueprintCategory = cat;
              break;
            }
          }
          
          if (!category || blueprintCategory === category) {
            blueprints.push({
              path,
              number: `0x${match[1]}`,
              category: blueprintCategory,
              title: path.split('/').pop().replace(/0x[0-9A-Fa-f]+-/, '').replace('.md', ''),
              metadata: meta
            });
          }
        }
      }
    }
    
    logger.info(`[BLPR] Found ${blueprints.length} blueprints`);
    return blueprints;
  };

  // Get blueprint statistics
  const getBlueprintStatistics = async () => {
    logger.debug("[BLPR] Generating blueprint statistics...");
    
    const stats = {
      total: 0,
      by_category: {},
      coverage: {
        upgrades_with_blueprints: 0,
        upgrades_without_blueprints: 0
      },
      newest: null,
      oldest: null
    };
    
    const blueprints = await listBlueprints();
    stats.total = blueprints.length;
    
    for (const bp of blueprints) {
      stats.by_category[bp.category] = (stats.by_category[bp.category] || 0) + 1;
      
      const timestamp = bp.metadata[0]?.versions?.[0]?.timestamp;
      if (timestamp) {
        if (!stats.oldest || timestamp < stats.oldest.timestamp) {
          stats.oldest = { ...bp, timestamp };
        }
        if (!stats.newest || timestamp > stats.newest.timestamp) {
          stats.newest = { ...bp, timestamp };
        }
      }
    }
    
    logger.info(`[BLPR] Statistics: ${stats.total} total blueprints across ${Object.keys(stats.by_category).length} categories`);
    return stats;
  };

  logger.info("[BLPR] Blueprint Creator Module initialized successfully");

  return {
    createBlueprint,
    generateBlueprintFromTemplate,
    createBlueprintFromUpgrade,
    validateBlueprint,
    listBlueprints,
    getBlueprintStatistics,
    getNextBlueprintNumber,
    BLUEPRINT_RANGES,
    BLUEPRINT_TEMPLATE
  };
};