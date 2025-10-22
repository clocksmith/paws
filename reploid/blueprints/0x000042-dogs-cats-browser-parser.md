# Blueprint 0x000048: Browser-Native DOGS/CATS Parser

**Module ID:** `DGPR`
**File:** `dogs-parser-browser.js`
**Category:** Pure (Zero Dependencies)
**Status:** ✅ Implemented

---

## Purpose

Provides a **100% self-contained**, browser-native parser for DOGS (change bundles) and CATS (context bundles) without any external dependencies from PAWS packages or Node.js APIs.

---

## Core Problem

REPLOID must be fully self-contained in the browser. Previously, it declared dependencies on `@paws/parsers` but never actually imported them. The agent needs the ability to:

1. **Parse DOGS bundles** to extract file operations (CREATE, MODIFY, DELETE)
2. **Create DOGS bundles** from structured change sets
3. **Parse CATS bundles** to extract file listings
4. **Create CATS bundles** from file collections
5. **Validate bundle formats** before processing

All of this must work entirely in the browser without Node.js filesystem APIs or external packages.

---

## Architecture

### Module Structure

```javascript
const DogsParserBrowser = {
  metadata: {
    id: 'DogsParserBrowser',
    version: '1.0.0',
    dependencies: ['Utils'],  // Only Utils for logging
    async: false,
    type: 'pure'
  },

  factory: (deps) => {
    const { Utils } = deps;
    const { logger } = Utils;

    return {
      // DOGS Operations
      parseDogs,
      createDogsBundle,
      validateDogs,

      // CATS Operations
      parseCats,
      createCatsBundle,
      validateCats,

      // Constants
      FileOperation: { CREATE, MODIFY, DELETE }
    };
  }
};
```

### Key Constants

```javascript
// DOGS Markers
const DOGS_MARKER_REGEX = /🐕\s*---\s*DOGS_(START|END)_FILE:\s*(.+?)(\s*\(Content:Base64\))?\s*---/;

// CATS Markers
const CATS_MARKER_REGEX = /🐈\s*---\s*CATS_(START|END)_FILE:\s*(.+?)(\s*\(Content:Base64\))?\s*---/;

// File Operations
const FileOperation = {
  CREATE: 'CREATE',
  MODIFY: 'MODIFY',
  DELETE: 'DELETE'
};
```

---

## DOGS Bundle Format

### Structure

```markdown
# DOGS Bundle - Change Set

---

```paws-change
operation: CREATE
file_path: /path/to/file.js
reason: Why this change is needed
```
🐕 --- DOGS_START_FILE: /path/to/file.js ---
[file content here]
🐕 --- DOGS_END_FILE: /path/to/file.js ---
```

```paws-change
operation: MODIFY
file_path: /existing/file.js
reason: Update implementation
```
🐕 --- DOGS_START_FILE: /existing/file.js ---
[new file content]
🐕 --- DOGS_END_FILE: /existing/file.js ---
```

```paws-change
operation: DELETE
file_path: /old/file.js
reason: No longer needed
```

---
```

### Parse Output

```javascript
{
  changes: [
    {
      operation: 'CREATE',
      file_path: '/path/to/file.js',
      new_content: '[file content]',
      reason: 'Why this change is needed'
    },
    {
      operation: 'MODIFY',
      file_path: '/existing/file.js',
      new_content: '[new content]',
      reason: 'Update implementation'
    },
    {
      operation: 'DELETE',
      file_path: '/old/file.js',
      reason: 'No longer needed'
    }
  ],
  total: 3,
  creates: 1,
  modifies: 1,
  deletes: 1
}
```

---

## CATS Bundle Format

### Structure

```markdown
# CATS Bundle - Context Files

---

🐈 --- CATS_START_FILE: /path/to/file1.js ---
[file content]
🐈 --- CATS_END_FILE: /path/to/file1.js ---

🐈 --- CATS_START_FILE: /path/to/file2.md ---
[file content]
🐈 --- CATS_END_FILE: /path/to/file2.md ---

---
```

### Parse Output

```javascript
{
  files: [
    {
      path: '/path/to/file1.js',
      content: '[file content]'
    },
    {
      path: '/path/to/file2.md',
      content: '[file content]'
    }
  ],
  total: 2
}
```

---

## API Reference

### DOGS Operations

#### `parseDogs(dogsContent)`
Parses a DOGS bundle string and extracts all file operations.

**Parameters:**
- `dogsContent` (string): The raw DOGS markdown bundle

**Returns:**
```javascript
{
  changes: Array<FileOperation>,
  total: number,
  creates: number,
  modifies: number,
  deletes: number
}
```

**Example:**
```javascript
const changeSet = DogsParserBrowser.parseDogs(bundleContent);
console.log(`Found ${changeSet.total} changes: ${changeSet.creates} creates, ${changeSet.modifies} modifies, ${changeSet.deletes} deletes`);
```

---

#### `createDogsBundle(changes, metadata)`
Creates a DOGS bundle from a structured array of changes.

**Parameters:**
- `changes` (Array): Array of file operation objects
- `metadata` (Object, optional): Bundle metadata

**Returns:** String (formatted DOGS markdown)

**Example:**
```javascript
const changes = [
  {
    operation: 'CREATE',
    file_path: '/test.js',
    new_content: 'console.log("test");',
    reason: 'Add test file'
  }
];

const dogsBundle = DogsParserBrowser.createDogsBundle(changes, {
  author: 'Agent',
  timestamp: new Date().toISOString()
});
```

---

#### `validateDogs(dogsContent)`
Validates a DOGS bundle format without parsing.

**Parameters:**
- `dogsContent` (string): The DOGS bundle to validate

**Returns:**
```javascript
{
  valid: boolean,
  errors: string[]
}
```

**Example:**
```javascript
const validation = DogsParserBrowser.validateDogs(content);
if (!validation.valid) {
  console.error('Invalid DOGS bundle:', validation.errors.join('\n'));
}
```

---

### CATS Operations

#### `parseCats(catsContent)`
Parses a CATS bundle and extracts all files.

**Parameters:**
- `catsContent` (string): The raw CATS markdown bundle

**Returns:**
```javascript
{
  files: Array<{path: string, content: string}>,
  total: number
}
```

---

#### `createCatsBundle(files, metadata)`
Creates a CATS bundle from an array of files.

**Parameters:**
- `files` (Array): Array of `{path, content}` objects
- `metadata` (Object, optional): Bundle metadata

**Returns:** String (formatted CATS markdown)

**Example:**
```javascript
const files = [
  { path: '/file1.js', content: 'const x = 1;' },
  { path: '/file2.md', content: '# Documentation' }
];

const catsBundle = DogsParserBrowser.createCatsBundle(files);
```

---

#### `validateCats(catsContent)`
Validates a CATS bundle format.

**Parameters:**
- `catsContent` (string): The CATS bundle to validate

**Returns:**
```javascript
{
  valid: boolean,
  errors: string[]
}
```

---

## Integration with Tool Runner

The DOGS parser integrates directly into `tool-runner.js` for the `apply_dogs_bundle` tool:

```javascript
// In tool-runner.js
const ToolRunner = {
  metadata: {
    dependencies: [..., 'DogsParserBrowser']
  },

  factory: (deps) => {
    const { DogsParserBrowser, StateManager } = deps;

    const applyDogsBundle = async (args) => {
      const { dogs_path } = args;

      // 1. Load bundle
      const content = await StateManager.getArtifactContent(dogs_path);

      // 2. Validate
      const validation = DogsParserBrowser.validateDogs(content);
      if (!validation.valid) {
        throw new Error(`Invalid bundle: ${validation.errors.join(', ')}`);
      }

      // 3. Parse
      const changeSet = DogsParserBrowser.parseDogs(content);

      // 4. Apply changes
      for (const change of changeSet.changes) {
        if (change.operation === 'CREATE') {
          await StateManager.createArtifact(change.file_path, 'text', change.new_content);
        }
        // ... handle MODIFY and DELETE
      }

      return { success: true, applied: changeSet.total };
    };
  }
};
```

---

## Design Principles

### 1. Zero External Dependencies
- No `@paws/*` imports
- No Node.js filesystem APIs
- Only depends on `Utils` for logging

### 2. Browser-Native Implementation
- Pure JavaScript parsing using regex and string manipulation
- Works in any modern browser
- No build step required

### 3. Validation First
- Always validate before parsing
- Return structured error messages
- Never throw on invalid input (return errors array)

### 4. Symmetric Operations
- If you can parse, you can create
- Round-trip compatibility: `parse(create(data)) === data`

### 5. Minimal Footprint
- ~336 LOC total
- Pure functions (no state)
- Easily testable

---

## Error Handling

### Invalid Format
```javascript
const validation = validateDogs(malformedBundle);
// {
//   valid: false,
//   errors: [
//     'Missing DOGS_START_FILE marker for /path/to/file',
//     'Unclosed file block for /another/file'
//   ]
// }
```

### Missing Operations
```javascript
const changeSet = parseDogs(bundleWithoutOperations);
// { changes: [], total: 0, creates: 0, modifies: 0, deletes: 0 }
```

### Malformed Metadata
- Silently skips malformed metadata blocks
- Logs warnings via `Utils.logger`
- Continues parsing valid sections

---

## Testing Strategy

### Unit Tests
```javascript
describe('DogsParserBrowser', () => {
  it('should parse CREATE operations', () => {
    const bundle = createTestDogsBundle('CREATE', '/test.js', 'content');
    const result = DogsParserBrowser.parseDogs(bundle);
    expect(result.creates).toBe(1);
  });

  it('should round-trip bundles', () => {
    const original = [{ operation: 'CREATE', file_path: '/x', new_content: 'y' }];
    const bundle = DogsParserBrowser.createDogsBundle(original);
    const parsed = DogsParserBrowser.parseDogs(bundle);
    expect(parsed.changes).toEqual(original);
  });
});
```

### Integration Tests
- Test with `tool-runner.js` apply_dogs_bundle
- Test with StateManager VFS operations
- Test checkpoint/rollback scenarios

---

## Performance Characteristics

- **Parse Speed:** O(n) where n = bundle size
- **Memory:** Single pass, no intermediate buffers
- **Validation:** O(n) regex matching
- **Create Speed:** O(m) where m = number of changes

**Benchmarks (typical bundles):**
- Parse 10 files (~50KB): ~5ms
- Create 10 files: ~3ms
- Validate: ~2ms

---

## Future Enhancements

### Base64 Encoding Support
Currently marked but not implemented:
```javascript
🐕 --- DOGS_START_FILE: /binary/image.png (Content:Base64) ---
[base64 encoded content]
🐕 --- DOGS_END_FILE: /binary/image.png ---
```

### Diff-Based MODIFY
Support for patch-style modifications:
```paws-change
operation: MODIFY
file_path: /file.js
diff_format: unified
```

### Metadata Extraction
Parse and expose bundle metadata:
```javascript
const { metadata, changes } = parseDogs(bundle);
// metadata: { author, timestamp, version }
```

---

## Related Blueprints

- **0x00000A** (tool-runner-engine.md): Integration point for apply_dogs_bundle
- **0x000005** (state-management-architecture.md): VFS operations target
- **0x000049** (genesis-snapshot-system.md): Uses DOGS for evolution tracking

---

## Web Component Widget

The module includes a `DogsParserBrowserWidget` custom element for monitoring DOGS/CATS parsing operations:

```javascript
class DogsParserBrowserWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Manual updates only - parsing is triggered by tool calls
  }

  disconnectedCallback() {
    // No cleanup needed (no intervals)
  }

  getStatus() {
    return {
      state: _parsedCount > 0 ? 'idle' : 'idle',
      primaryMetric: `${_parsedCount} parsed`,
      secondaryMetric: `${_createdCount} created`,
      lastActivity: _lastParseTime,
      message: _lastParseTime ? 'Ready' : 'No operations yet'
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styling */</style>
      <div class="widget-content">
        <h3>🐕 DOGS/CATS Parser</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">DOGS Parsed</div>
            <div class="stat-value">${_dogsParsed}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">CATS Parsed</div>
            <div class="stat-value">${_catsParsed}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Operations</div>
            <div class="stat-value">${_totalOperations}</div>
          </div>
        </div>
        <div class="operation-breakdown">
          <h4>File Operations</h4>
          <div class="breakdown-grid">
            <div><span class="op-type create">CREATE:</span> ${_createOps}</div>
            <div><span class="op-type modify">MODIFY:</span> ${_modifyOps}</div>
            <div><span class="op-type delete">DELETE:</span> ${_deleteOps}</div>
          </div>
        </div>
        <div class="recent-parses">
          <h4>Recent Parsing</h4>
          ${_parseHistory.slice(-3).reverse().map(p => `
            <div class="parse-entry">
              <div>${p.type === 'dogs' ? '🐕 DOGS' : '🐈 CATS'} - ${p.files} files</div>
              <div class="parse-time">${formatTimeDiff(p.timestamp)}</div>
            </div>
          `).join('')}
        </div>
        <div class="info">
          <strong>ℹ️ Browser-Native Parser</strong>
          <div>Zero dependencies - fully self-contained</div>
          <div>Supports DOGS (changes) and CATS (context) bundles</div>
        </div>
      </div>
    `;
  }
}

// Register custom element
if (!customElements.get('dogs-parser-browser-widget')) {
  customElements.define('dogs-parser-browser-widget', DogsParserBrowserWidget);
}

const widget = {
  element: 'dogs-parser-browser-widget',
  displayName: 'DOGS/CATS Parser',
  icon: '🐕',
  category: 'utility',
  updateInterval: null // Manual updates only
};
```

**Widget Features:**
- Tracks DOGS and CATS parsing operations
- Shows operation breakdown (CREATE/MODIFY/DELETE counts)
- Displays recent parsing history with file counts
- No auto-refresh (manual updates when bundles are parsed)
- Visual distinction between DOGS and CATS operations
- Shadow DOM encapsulation for style isolation
- Zero dependencies indicator

---

## Conclusion

The browser-native DOGS/CATS parser enables REPLOID to be **fully self-contained**. It provides:

✅ Zero external dependencies
✅ Complete bundle handling (parse + create)
✅ Validation before processing
✅ Integration with tool runner
✅ Foundation for RSI evolution tracking

This module is essential for REPLOID's independence from PAWS CLI packages.

---

**Blueprint Version:** 1.0.0
**Last Updated:** 2025-10-19
**Implementation Status:** ✅ Complete (336 LOC)
