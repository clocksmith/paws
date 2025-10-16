# Module Standardization Guide

## Overview

The REPLOID module system has been standardized to provide consistent structure, dependency injection, and lifecycle management across all components.

## Standard Module Format

Every module now follows this structure:

```javascript
const ModuleName = {
  metadata: {
    id: 'ModuleName',           // Unique identifier
    version: '1.0.0',           // Semantic version
    dependencies: [...],         // Required dependencies
    async: false,               // Whether init is async
    type: 'pure|service|ui'     // Module category
  },
  
  factory: (deps) => {
    // Validate dependencies
    const { dep1, dep2, ... } = deps;
    
    // Module implementation
    
    // Return public API
    return {
      init,  // Optional async initializer
      api: {
        method1,
        method2
      }
    };
  }
};
```

## Module Types

### Pure Modules
- No external dependencies
- Stateless functions only
- Examples: Utils, AgentLogicPureHelpers, StateHelpersPure

### Service Modules  
- Have dependencies
- May maintain state
- Examples: ApiClient, ToolRunner, StateManager

### UI Modules
- Handle interface rendering
- May have async initialization
- Example: UI (UIManager)

## Module Loader

The standardized module loader (`boot-module-loader.js`) provides:

- **Dependency Resolution**: Automatic injection of dependencies
- **Lifecycle Management**: Handles module initialization order
- **Async Support**: Manages async module initialization
- **Legacy Compatibility**: Supports both new and old module formats
- **Error Handling**: Validates dependencies and structure

## Migration Path

### For New Modules
Use the standard format from the beginning.

### For Existing Modules
All core modules have been migrated with legacy compatibility wrappers:

```javascript
// New standardized format
const ModuleName = { metadata: {...}, factory: {...} };

// Legacy compatibility wrapper
const ModuleNameModule = (...args) => {
  const instance = ModuleName.factory({...});
  return instance.api;
};

// Export both formats
ModuleName;
ModuleNameModule;
```

## Benefits

1. **Consistency**: All modules follow the same pattern
2. **Testability**: Clean dependency injection
3. **Maintainability**: Self-documenting metadata
4. **Flexibility**: Mix standardized and legacy modules
5. **Type Safety**: Could add TypeScript definitions
6. **Hot Reload**: Modules can be swapped at runtime

## Module Manifest

The `module-manifest.json` defines:
- Loading order (by dependency level)
- Module paths in VFS
- Optional modules based on upgrades
- Data files and templates

## Using the Standardized System

### In Boot
Select the "standardizedCore" preset or include MLDR and MMNF upgrades.

### In Code
```javascript
// Initialize loader
ModuleLoader.init(vfs, config);

// Load from manifest
await ModuleLoader.loadFromManifest(manifest);

// Get module instance
const apiClient = await ModuleLoader.getModule('ApiClient');
```

## Module Registry

| ID | Module | Type | Async | Dependencies |
|----|--------|------|-------|--------------|
| Utils | utils.js | pure | no | none |
| AgentLogicPureHelpers | agent-logic-pure.js | pure | no | none |
| StateHelpersPure | state-helpers-pure.js | pure | no | none |
| ToolRunnerPureHelpers | tool-runner-pure-helpers.js | pure | no | none |
| Storage | storage-indexeddb.js | service | no | config, logger, Errors |
| StateManager | state-manager.js | service | yes | config, logger, Storage, Errors, StateHelpersPure, Utils |
| ApiClient | api-client.js | service | no | config, logger, Errors, Utils, StateManager |
| ToolRunner | tool-runner.js | service | no | config, logger, Storage, StateManager, ApiClient, Errors, Utils, ToolRunnerPureHelpers |
| UI | ui-manager.js | ui | yes | config, logger, Utils, Storage, StateManager, Errors |
| CycleLogic | agent-cycle.js | service | no | config, logger, Utils, Storage, StateManager, UI, ApiClient, ToolRunner, Errors, AgentLogicPureHelpers |

## Future Enhancements

- TypeScript definitions for modules
- Module versioning and compatibility checks
- Dynamic module loading from external sources
- Module dependency visualization
- Automated testing framework for modules