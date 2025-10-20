// @blueprint 0x000018 - Meta-blueprint: How to create new blueprints for knowledge transfer.
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

**Prerequisites:**
- [[PREREQUISITES]]
- **0x00004E** (Module Widget Protocol) - REQUIRED for all upgrades

**Affected Artifacts:** [[ARTIFACTS]]

---

### 1. The Strategic Imperative

[[WHY_SECTION]]

### 2. The Architectural Solution

[[ARCHITECTURE_SECTION]]

### 3. The Implementation Pathway

[[IMPLEMENTATION_SECTION]]

### 4. Web Component Widget (REQUIRED)

**Every upgrade MUST have a widget interface.** See Blueprint 0x00004E for complete protocol.

The widget must:
- Extend \`HTMLElement\` with Shadow DOM
- Implement \`getStatus()\` returning widget status
- Be defined **in the same file** as the module
- Be registered as custom element

\`\`\`javascript
class [[MODULE_NAME]]Widget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    // Clean up intervals/listeners
  }

  // REQUIRED: Status protocol (see 0x00004E)
  getStatus() {
    return {
      state: 'idle', // 'active' | 'idle' | 'error' | 'loading'
      primaryMetric: '0 items',
      secondaryMetric: 'Ready',
      lastActivity: null,
      message: null
    };
  }

  render() {
    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; font-family: monospace; }
        /* Scoped styles */
      </style>
      <div class="panel">
        <h4>[[DISPLAY_NAME]]</h4>
        <!-- Widget UI -->
      </div>
    \`;
  }
}

// Register widget
const elementName = '[[ELEMENT_NAME]]';
if (!customElements.get(elementName)) {
  customElements.define(elementName, [[MODULE_NAME]]Widget);
}

const widget = {
  element: elementName,
  displayName: '[[DISPLAY_NAME]]',
  icon: '[[ICON]]',
  category: '[[CATEGORY]]' // core, tools, ai, storage, ui, analytics, rsi, communication
};
\`\`\`

### 5. [[CUSTOM_SECTION_TITLE]]

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

  // Blueprint creation tracking for widget
  const creationStats = {
    totalCreated: 0,
    byCategory: {},
    recentCreations: [],
    lastCreated: null
  };

  // Wrap createBlueprint to track stats
  const wrappedCreateBlueprint = async (title, category, content) => {
    const result = await createBlueprint(title, category, content);

    creationStats.totalCreated++;
    creationStats.byCategory[category] = (creationStats.byCategory[category] || 0) + 1;
    creationStats.lastCreated = {
      ...result,
      timestamp: Date.now()
    };
    creationStats.recentCreations.unshift({
      ...result,
      timestamp: Date.now()
    });
    if (creationStats.recentCreations.length > 10) {
      creationStats.recentCreations = creationStats.recentCreations.slice(0, 10);
    }

    return result;
  };

  // Wrap generateBlueprintFromTemplate to track stats
  const wrappedGenerateBlueprintFromTemplate = async (params) => {
    const result = await generateBlueprintFromTemplate(params);

    creationStats.totalCreated++;
    creationStats.byCategory[params.category || 'meta'] = (creationStats.byCategory[params.category || 'meta'] || 0) + 1;
    creationStats.lastCreated = {
      ...result,
      timestamp: Date.now()
    };
    creationStats.recentCreations.unshift({
      ...result,
      timestamp: Date.now()
    });
    if (creationStats.recentCreations.length > 10) {
      creationStats.recentCreations = creationStats.recentCreations.slice(0, 10);
    }

    return result;
  };

  // Wrap createBlueprintFromUpgrade to track stats
  const wrappedCreateBlueprintFromUpgrade = async (upgradePath) => {
    const result = await createBlueprintFromUpgrade(upgradePath);

    creationStats.totalCreated++;
    creationStats.byCategory[result.category] = (creationStats.byCategory[result.category] || 0) + 1;
    creationStats.lastCreated = {
      ...result,
      timestamp: Date.now()
    };
    creationStats.recentCreations.unshift({
      ...result,
      timestamp: Date.now()
    });
    if (creationStats.recentCreations.length > 10) {
      creationStats.recentCreations = creationStats.recentCreations.slice(0, 10);
    }

    return result;
  };

  // Web Component Widget
  class BlueprintCreatorWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    set moduleApi(api) {
      this._api = api;
      this.render();
    }

    connectedCallback() {
      this.render();
    }

    disconnectedCallback() {
      // No cleanup needed
    }

    getStatus() {
      const hasRecentCreation = creationStats.lastCreated &&
        (Date.now() - creationStats.lastCreated.timestamp < 60000);

      return {
        state: hasRecentCreation ? 'active' : creationStats.totalCreated > 0 ? 'idle' : 'disabled',
        primaryMetric: creationStats.totalCreated > 0
          ? `${creationStats.totalCreated} created`
          : 'No blueprints',
        secondaryMetric: Object.keys(creationStats.byCategory).length > 0
          ? `${Object.keys(creationStats.byCategory).length} categories`
          : 'Ready',
        lastActivity: creationStats.lastCreated ? creationStats.lastCreated.timestamp : null,
        message: hasRecentCreation
          ? `Created: ${creationStats.lastCreated.title}`
          : null
      };
    }

    getControls() {
      return [
        {
          id: 'list-blueprints',
          label: '☷ List All Blueprints',
          action: async () => {
            try {
              const blueprints = await listBlueprints();
              logger.info(`[Widget] Found ${blueprints.length} blueprints`);
              console.table(blueprints.map(bp => ({
                Number: bp.number,
                Category: bp.category,
                Title: bp.title
              })));
              return { success: true, message: `Found ${blueprints.length} blueprints (check console)` };
            } catch (error) {
              logger.error(`[Widget] List blueprints failed: ${error.message}`);
              return { success: false, message: error.message };
            }
          }
        },
        {
          id: 'show-stats',
          label: '☱ Show Statistics',
          action: async () => {
            try {
              const stats = await getBlueprintStatistics();
              logger.info('[Widget] Blueprint statistics:', stats);
              console.log('Blueprint Statistics:', stats);
              return { success: true, message: `${stats.total} total blueprints` };
            } catch (error) {
              logger.error(`[Widget] Stats failed: ${error.message}`);
              return { success: false, message: error.message };
            }
          }
        }
      ];
    }

    render() {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: monospace;
            font-size: 12px;
          }
          .blueprint-panel {
            padding: 12px;
            color: #fff;
          }
          h4 {
            margin: 0 0 12px 0;
            font-size: 1.1em;
            color: #0ff;
          }
          .summary {
            margin-bottom: 12px;
          }
          .summary-title {
            color: #0ff;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .summary-value {
            color: #e0e0e0;
          }
          .summary-value .highlight {
            color: #0ff;
          }
          .info-box {
            margin-bottom: 12px;
            padding: 8px;
            background: rgba(0,255,255,0.05);
            border: 1px solid rgba(0,255,255,0.2);
          }
          .info-box-title {
            color: #0ff;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .info-box-item {
            color: #aaa;
            padding: 2px 0;
          }
          .info-box-item .value {
            color: #fff;
          }
          .info-box-item .range {
            color: #888;
            font-size: 10px;
          }
          .last-created-box {
            margin-bottom: 12px;
            padding: 8px;
            background: rgba(0,255,255,0.05);
            border: 1px solid rgba(0,255,255,0.2);
          }
          .last-created-title {
            color: #0ff;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .last-created-number {
            color: #fff;
            margin-bottom: 4px;
          }
          .last-created-meta {
            color: #aaa;
            font-size: 10px;
          }
          .last-created-timestamp {
            color: #888;
            font-size: 10px;
          }
          .recent-section {
            margin-top: 12px;
          }
          .recent-title {
            color: #0ff;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .recent-list {
            max-height: 150px;
            overflow-y: auto;
          }
          .recent-item {
            padding: 4px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }
          .recent-item-number {
            color: #0ff;
          }
          .recent-item-title {
            color: #fff;
          }
          .recent-item-category {
            color: #888;
            font-size: 10px;
          }
          .ranges-reference {
            margin-top: 12px;
            padding: 8px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
          }
          .ranges-title {
            color: #888;
            font-weight: bold;
            margin-bottom: 4px;
            font-size: 10px;
          }
          .range-item {
            color: #666;
            font-size: 10px;
            padding: 1px 0;
          }
          .no-blueprints {
            color: #888;
            text-align: center;
            margin-top: 20px;
          }
        </style>
        <div class="blueprint-panel">
          <h4>◧ Blueprint Creator</h4>

          <div class="summary">
            <div class="summary-title">Creation Summary</div>
            <div class="summary-value">Total Created: <span class="highlight">${creationStats.totalCreated}</span></div>
          </div>

          ${Object.keys(creationStats.byCategory).length > 0 ? `
            <div class="info-box">
              <div class="info-box-title">By Category</div>
              ${Object.entries(creationStats.byCategory).map(([category, count]) => {
                const range = BLUEPRINT_RANGES[category];
                return `
                  <div class="info-box-item">
                    <span class="value">${category}</span>: ${count}
                    <span class="range">(${range.start.toString(16)}-${range.end.toString(16)})</span>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          ${creationStats.lastCreated ? `
            <div class="last-created-box">
              <div class="last-created-title">Last Created</div>
              <div class="last-created-number">${creationStats.lastCreated.number}: ${creationStats.lastCreated.title}</div>
              <div class="last-created-meta">Category: ${creationStats.lastCreated.category}</div>
              <div class="last-created-meta">Path: ${creationStats.lastCreated.path}</div>
              <div class="last-created-timestamp">${new Date(creationStats.lastCreated.timestamp).toLocaleString()}</div>
            </div>
          ` : ''}

          ${creationStats.recentCreations.length > 0 ? `
            <div class="recent-section">
              <div class="recent-title">Recent Creations</div>
              <div class="recent-list">
                ${creationStats.recentCreations.slice(0, 5).map(bp => `
                  <div class="recent-item">
                    <span class="recent-item-number">${bp.number}</span> -
                    <span class="recent-item-title">${bp.title}</span>
                    <span class="recent-item-category">(${bp.category})</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="ranges-reference">
            <div class="ranges-title">Blueprint Ranges</div>
            ${Object.entries(BLUEPRINT_RANGES).map(([category, range]) => `
              <div class="range-item">
                ${category}: 0x${range.start.toString(16).toUpperCase()} - 0x${range.end.toString(16).toUpperCase()}
              </div>
            `).join('')}
          </div>

          ${creationStats.totalCreated === 0 ? '<div class="no-blueprints">No blueprints created yet</div>' : ''}
        </div>
      `;
    }
  }

  // Register custom element
  const elementName = 'blueprint-creator-widget';
  if (!customElements.get(elementName)) {
    customElements.define(elementName, BlueprintCreatorWidget);
  }

  return {
    createBlueprint: wrappedCreateBlueprint,
    generateBlueprintFromTemplate: wrappedGenerateBlueprintFromTemplate,
    createBlueprintFromUpgrade: wrappedCreateBlueprintFromUpgrade,
    validateBlueprint,
    listBlueprints,
    getBlueprintStatistics,
    getNextBlueprintNumber,
    BLUEPRINT_RANGES,
    BLUEPRINT_TEMPLATE,

    widget: {
      element: elementName,
      displayName: 'Blueprint Creator',
      icon: '◧',
      category: 'rsi'
    }
  };
};

export default BlueprintCreatorModule;