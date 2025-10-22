# Blueprint 0x000041: Tool Documentation Generator

**Objective:** Ensure tool schemas are automatically documented into comprehensive markdown references.

**Target Upgrade:** TDOC (`tool-doc-generator.js`)

**Prerequisites:** 0x000010 (Static Tool Manifest), 0x00000A (Tool Runner Engine), 0x000031 (Toast Notification System)

**Affected Artifacts:** `/upgrades/tool-doc-generator.js`, `/upgrades/tools-read.json`, `/upgrades/tools-write.json`, `/docs/tools/*.md`

---

### 1. The Strategic Imperative
Tool discovery and trust require clear documentation. Manual docs drift quickly, especially as tools evolve through RSI. Automated documentation:
- Keeps schema changes in sync with references.
- Provides personas with up-to-date capabilities tables.
- Supplies onboarding material for humans and swarm peers.

### 2. Architectural Overview

The ToolDocGenerator module provides automated markdown documentation generation from tool JSON schemas with real-time statistics and monitoring through a Web Component widget. It implements a factory pattern with encapsulated documentation logic and Shadow DOM-based UI.

**Module Architecture:**
```javascript
const ToolDocGenerator = {
  metadata: {
    id: 'ToolDocGenerator',
    version: '1.0.0',
    dependencies: ['Utils', 'StateManager'],
    async: true,
    type: 'documentation'
  },
  factory: (deps) => {
    const { Utils, StateManager } = deps;
    const { logger } = Utils;

    // Internal state (accessible to widget via closure)
    const _generationHistory = [];
    let _lastGeneration = null;
    let _cachedStats = null;

    // Schema loading
    const loadToolSchemas = async () => {
      const schemas = { read: [], write: [] };
      // Fetch tools-read.json and tools-write.json
      return schemas;
    };

    // Documentation generation
    const generateDocs = async () => {
      const schemas = await loadToolSchemas();
      // Build markdown with TOC, tool sections, parameter tables
      return markdownContent;
    };

    const generateAndSave = async () => {
      // Generate all docs and save to VFS
      const results = await Promise.all([
        saveDocs(`/docs/tools/TOOL-REFERENCE.md`, fullDocs),
        saveDocs(`/docs/tools/TOOL-SUMMARY.md`, summary),
        saveDocs(`/docs/tools/READ-TOOLS.md`, readDocs),
        saveDocs(`/docs/tools/WRITE-TOOLS.md`, writeDocs)
      ]);

      // Track generation
      _lastGeneration = { timestamp, success, duration, filesGenerated };
      _generationHistory.push(_lastGeneration);

      return { success, generated, paths };
    };

    // Web Component Widget (defined inside factory to access closure state)
    class ToolDocGeneratorWidget extends HTMLElement {
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
        // No auto-refresh for this widget
      }

      render() {
        this.shadowRoot.innerHTML = `<style>...</style>${this.renderPanel()}`;
      }
    }

    customElements.define('tool-doc-generator-widget', ToolDocGeneratorWidget);

    return {
      init,
      api: {
        generateDocs,
        generateSummary,
        generateByCategory,
        saveDocs,
        generateAndSave,
        getStats
      },
      widget: {
        element: 'tool-doc-generator-widget',
        displayName: 'Tool Doc Generator',
        icon: '◰',
        category: 'documentation',
        updateInterval: null
      }
    };
  }
};
```

**Documentation Generation Workflow:**

- **Schema Loading**
  - Fetch `/upgrades/tools-read.json` and `/upgrades/tools-write.json` via fetch API
  - Non-fatal error handling if fetch fails (missing file or network issue)
  - Return structured object with read/write tool arrays

- **Markdown Generation**
  - `generateDocs()`: Builds master reference with TOC, read/write sections, parameter tables, outputs, examples
  - `generateSummary()`: Provides condensed table for quick review
  - `generateByCategory('read'|'write')`: Breaks out category-specific docs
  - `formatParameter()`: Renders table rows with type, required flag, description
  - `generateToolDoc()`: Creates comprehensive per-tool documentation with examples

- **Persistence**
  - `saveDocs(path, content)`: Writes to VFS via `StateManager.createArtifact()`
  - `generateAndSave()`: Orchestrates generation and produces four markdown artifacts under `/docs/tools/`
  - Tracks generation history and success/failure status

- **Statistics & Tracking**
  - `getStats()`: Returns tool counts, example coverage, average parameter counts
  - Generation history tracking (last 20 generations)
  - Cached statistics for widget display

**Web Component Widget Features:**

The `ToolDocGeneratorWidget` provides real-time documentation statistics and generation control:
- **Tool Statistics Grid**: Shows total tools and tools with examples (2-column display)
- **Category Breakdown**: Separate panels for read/write tools with total count, example count, and average parameters
- **Last Generation Status**: Displays success/failure, timestamp, file count, and generation duration
- **Generation History**: Scrollable list of last 10 generations with status, file count, and duration
- **Interactive Actions**: "Generate Docs" button to create all documentation, "Refresh Stats" to reload tool counts
- **No Auto-refresh**: Manual updates only (no interval) to avoid unnecessary processing
- **Visual Feedback**: Color-coded status (green for success, red for failures)

### 3. Implementation Pathway

**Step 1: Module Registration**
```javascript
// In config.json, ensure ToolDocGenerator is registered with dependencies
{
  "modules": {
    "ToolDocGenerator": {
      "dependencies": ["Utils", "StateManager"],
      "enabled": true,
      "async": true
    }
  }
}
```

**Step 2: Factory Function Implementation**

The factory receives dependencies and creates documentation generation logic:
```javascript
factory: (deps) => {
  const { Utils, StateManager } = deps;
  const { logger } = Utils;

  // Internal state (accessible to widget via closure)
  const _generationHistory = [];
  let _lastGeneration = null;
  let _cachedStats = null;

  // Initialization
  const init = async () => {
    logger.info('[ToolDocGen] Tool documentation generator ready');
    _cachedStats = await getStats();
    return true;
  };

  // Web Component defined here to access closure variables
  class ToolDocGeneratorWidget extends HTMLElement { /*...*/ }
  customElements.define('tool-doc-generator-widget', ToolDocGeneratorWidget);

  return { init, api, widget };
}
```

**Step 3: Schema Loading Implementation**

Load tool schemas from JSON files with error handling:
```javascript
const loadToolSchemas = async () => {
  const schemas = { read: [], write: [] };

  try {
    // Load read tools
    const readResponse = await fetch('/upgrades/tools-read.json');
    if (readResponse.ok) {
      schemas.read = await readResponse.json();
    }
  } catch (err) {
    logger.warn('[ToolDocGen] Failed to load tools-read.json:', err);
  }

  try {
    // Load write tools
    const writeResponse = await fetch('/upgrades/tools-write.json');
    if (writeResponse.ok) {
      schemas.write = await writeResponse.json();
    }
  } catch (err) {
    logger.warn('[ToolDocGen] Failed to load tools-write.json:', err);
  }

  return schemas;
};
```

**Step 4: Markdown Generation Logic**

Implement documentation generation with consistent formatting:
```javascript
const formatParameter = (name, schema, isRequired) => {
  const type = schema.type || 'string';
  const description = schema.description || 'No description';
  const required = isRequired ? '✓' : '';

  // Handle array and object types
  let typeStr = type;
  if (type === 'array' && schema.items) {
    typeStr = `array<${schema.items.type || 'any'}>`;
  }

  return `| \`${name}\` | ${typeStr} | ${required} | ${description} |`;
};

const generateToolDoc = (tool, category) => {
  let doc = `### ${tool.name}\n\n`;

  // Category badge
  const badge = category === 'read' ? '⌕ Read' : '✏️ Write';
  doc += `**Category:** ${badge}\n\n`;

  // Description
  doc += `**Description:** ${tool.description || 'No description available'}\n\n`;

  // Parameters table
  if (tool.inputSchema || tool.parameters) {
    const schema = tool.inputSchema || tool.parameters;
    doc += `#### Parameters\n\n`;
    doc += `| Name | Type | Required | Description |\n`;
    doc += `|------|------|----------|-------------|\n`;

    const properties = schema.properties || {};
    const required = schema.required || [];

    for (const [name, propSchema] of Object.entries(properties)) {
      doc += formatParameter(name, propSchema, required.includes(name)) + '\n';
    }
  }

  // Output schema, examples, etc.
  doc += '---\n\n';
  return doc;
};

const generateDocs = async () => {
  const schemas = await loadToolSchemas();
  const totalTools = schemas.read.length + schemas.write.length;

  let doc = `# REPLOID Tool Reference\n\n`;
  doc += `**Generated:** ${new Date().toISOString()}\n`;
  doc += `**Total Tools:** ${totalTools}\n\n`;

  // Table of contents
  doc += `## Table of Contents\n\n`;
  doc += `- [Read Tools](#read-tools) (${schemas.read.length})\n`;
  doc += `- [Write Tools](#write-tools) (${schemas.write.length})\n\n`;

  // Generate sections
  for (const tool of schemas.read) {
    doc += generateToolDoc(tool, 'read');
  }

  for (const tool of schemas.write) {
    doc += generateToolDoc(tool, 'write');
  }

  return doc;
};
```

**Step 5: Persistence and Orchestration**

Save documentation to VFS and track generation:
```javascript
const saveDocs = async (path, content) => {
  try {
    await StateManager.createArtifact(path, 'md', content, 'Auto-generated tool documentation');
    logger.info(`[ToolDocGen] Saved documentation to ${path}`);
    return { success: true, path };
  } catch (err) {
    logger.error('[ToolDocGen] Failed to save documentation:', err);
    return { success: false, error: err.message };
  }
};

const generateAndSave = async () => {
  const generationStart = Date.now();

  // Generate all documentation types
  const fullDocs = await generateDocs();
  const summary = await generateSummary();
  const readDocs = await generateByCategory('read');
  const writeDocs = await generateByCategory('write');

  // Save all files in parallel
  const results = await Promise.all([
    saveDocs(`/docs/tools/TOOL-REFERENCE.md`, fullDocs),
    saveDocs(`/docs/tools/TOOL-SUMMARY.md`, summary),
    saveDocs(`/docs/tools/READ-TOOLS.md`, readDocs),
    saveDocs(`/docs/tools/WRITE-TOOLS.md`, writeDocs)
  ]);

  const success = results.every(r => r.success);
  const duration = Date.now() - generationStart;

  // Track generation
  const generation = {
    timestamp: Date.now(),
    success,
    duration,
    filesGenerated: results.length,
    paths: results.map(r => r.path).filter(p => p)
  };

  _lastGeneration = generation;
  _generationHistory.push(generation);
  if (_generationHistory.length > 20) _generationHistory.shift();

  _cachedStats = await getStats();

  return { success, generated: results.length, paths: generation.paths };
};
```

**Step 6: Web Component Widget**

The widget provides documentation statistics and generation control:
```javascript
class ToolDocGeneratorWidget extends HTMLElement {
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
    // No auto-refresh - manual updates only
  }

  disconnectedCallback() {
    // No cleanup needed (no intervals)
  }

  render() {
    // Access closure variables: _cachedStats, _lastGeneration, _generationHistory
    const stats = _cachedStats || { read: { total: 0 }, write: { total: 0 } };

    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      ${this.renderPanel()}
    `;

    // Wire up interactive buttons
    this.shadowRoot.querySelector('.generate-docs-btn')
      .addEventListener('click', async () => {
        const result = await generateAndSave();
        this.render();
      });

    this.shadowRoot.querySelector('.refresh-stats-btn')
      .addEventListener('click', async () => {
        _cachedStats = await getStats();
        this.render();
      });
  }
}
```

**Step 7: Statistics and Analytics**

Track tool schema statistics for display:
```javascript
const getStats = async () => {
  const schemas = await loadToolSchemas();

  const stats = {
    read: {
      total: schemas.read.length,
      withExamples: schemas.read.filter(t => t.examples?.length > 0).length,
      avgParams: 0
    },
    write: {
      total: schemas.write.length,
      withExamples: schemas.write.filter(t => t.examples?.length > 0).length,
      avgParams: 0
    }
  };

  // Calculate average parameters
  if (schemas.read.length > 0) {
    const totalParams = schemas.read.reduce((sum, t) => {
      const schema = t.inputSchema || t.parameters || {};
      return sum + Object.keys(schema.properties || {}).length;
    }, 0);
    stats.read.avgParams = (totalParams / schemas.read.length).toFixed(1);
  }

  // Similar for write tools...

  return stats;
};
```

**Step 8: Integration Points**

1. **Invocation Triggers**:
   - Trigger `generateAndSave()` after tool schema changes
   - Provide widget button for on-demand generation
   - Optionally trigger during release builds

2. **Dashboard Integration**:
   - Widget automatically integrates with module dashboard system
   - Provides `getStatus()` method for dashboard summary view
   - No auto-refresh (updateInterval: null) for manual-only updates

3. **VFS Integration**:
   - Documentation saved to `/docs/tools/` directory via StateManager
   - Four standard documentation files generated:
     - `TOOL-REFERENCE.md`: Complete reference with all tools
     - `TOOL-SUMMARY.md`: Condensed summary table
     - `READ-TOOLS.md`: Read tools only
     - `WRITE-TOOLS.md`: Write tools only

4. **Error Handling**:
   - Non-fatal errors when loading tool schemas (logs warning, continues)
   - Tracks success/failure status for each generation
   - Displays error feedback in widget UI

### 4. Verification Checklist
- [ ] Generated markdown includes correct tool counts and table of contents.
- [ ] Parameter tables reflect required vs optional fields accurately.
- [ ] Output schema (if present) renders property tables.
- [ ] Examples display JSON blocks with both input and output when provided.
- [ ] Files saved to VFS and accessible from `docs/tools/`.

### 5. Extension Opportunities
- Generate HTML or interactive docs (e.g., Swagger-like UI).
- Include changelog diff (what changed since last generation).
- Add lint to ensure every tool includes at least one example.
- Integrate with reflection system to cross-link tools to success stories.

Keep this blueprint aligned when schema formats change or new documentation targets (PDF, CLI) are introduced.
