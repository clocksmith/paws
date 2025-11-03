// Meta-Tool-Writer - Improves ToolWriter and other core modules (Level 2+ RSI)

const MetaToolWriter = {
  metadata: {
    name: 'MetaToolWriter',
    version: '1.0.0'
  },

  factory: (deps) => {
    const { vfs } = deps;
    const state = {
      toolRunner: deps.toolRunner // For future use
    };

    // History of improvements for rollback
    const improvementHistory = [];
    const MAX_HISTORY = 10;

    // Validate module code structure
    const validateModuleStructure = (code, moduleName) => {
      // Must have factory pattern
      if (!code.includes('factory:') && !code.includes('factory (')) {
        return {
          valid: false,
          error: `Module must use factory pattern: const ${moduleName} = { metadata: {...}, factory: (deps) => {...} }`
        };
      }

      // Must export default
      if (!code.includes('export default')) {
        return {
          valid: false,
          error: 'Module must have: export default ModuleName;'
        };
      }

      return { valid: true };
    };

    // Improve ToolWriter itself
    const improveToolWriter = async (newCode) => {
      console.log(`[MetaToolWriter] Improving ToolWriter`);

      const modulePath = '/core/tool-writer.js';

      // Validate structure
      const structureCheck = validateModuleStructure(newCode, 'ToolWriter');
      if (!structureCheck.valid) {
        throw new Error(`Invalid module structure: ${structureCheck.error}`);
      }

      // Validate syntax
      try {
        new Function(newCode);
      } catch (error) {
        throw new Error(`Syntax error: ${error.message}`);
      }

      // Read current version
      const currentCode = await vfs.read(modulePath);

      // Backup current version
      const backupPath = `/core/tool-writer.js.backup-${Date.now()}`;
      await vfs.write(backupPath, currentCode);
      console.log(`[MetaToolWriter] Backed up current ToolWriter to: ${backupPath}`);

      // Save improvement history
      improvementHistory.push({
        module: 'tool-writer',
        timestamp: Date.now(),
        backupPath,
        reason: 'Meta-improvement by agent'
      });

      // Keep only recent history
      if (improvementHistory.length > MAX_HISTORY) {
        improvementHistory.shift();
      }

      // Write new code to VFS
      await vfs.write(modulePath, newCode);
      console.log(`[MetaToolWriter] Written new ToolWriter to VFS`);

      // Hot-reload: Load new module via blob URL
      try {
        const blob = new Blob([newCode], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);

        const module = await import(/* webpackIgnore: true */ url);
        URL.revokeObjectURL(url);

        if (!module.default || !module.default.factory) {
          throw new Error('Invalid module export structure');
        }

        // Re-initialize ToolWriter with new code
        // Note: This requires re-creating the dependency injection
        // For now, we'll return success and note that a reload is recommended
        console.log(`[MetaToolWriter] ToolWriter improved successfully`);

        return {
          success: true,
          module: 'tool-writer',
          backup: backupPath,
          message: 'ToolWriter improved successfully. Reload recommended for changes to take effect.',
          reload_recommended: true
        };

      } catch (error) {
        // Rollback on failure
        console.error(`[MetaToolWriter] Failed to load new ToolWriter:`, error);
        await vfs.write(modulePath, currentCode);

        throw new Error(`Failed to improve ToolWriter (rolled back): ${error.message}`);
      }
    };

    // Improve any core module (agent-loop, tool-runner, llm-client, etc.)
    const improveCoreModule = async (moduleName, newCode) => {
      console.log(`[MetaToolWriter] Improving core module: ${moduleName}`);

      const modulePath = `/core/${moduleName}.js`;

      // Validate structure
      const moduleIdentifier = moduleName.split('-').map((word, i) =>
        i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) :
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join('');

      const structureCheck = validateModuleStructure(newCode, moduleIdentifier);
      if (!structureCheck.valid) {
        throw new Error(`Invalid module structure: ${structureCheck.error}`);
      }

      // Validate syntax
      try {
        new Function(newCode);
      } catch (error) {
        throw new Error(`Syntax error: ${error.message}`);
      }

      // Read current version
      const currentCode = await vfs.read(modulePath);

      // Backup current version
      const backupPath = `/core/${moduleName}.js.backup-${Date.now()}`;
      await vfs.write(backupPath, currentCode);
      console.log(`[MetaToolWriter] Backed up ${moduleName} to: ${backupPath}`);

      // Save improvement history
      improvementHistory.push({
        module: moduleName,
        timestamp: Date.now(),
        backupPath,
        reason: 'Meta-improvement by agent'
      });

      if (improvementHistory.length > MAX_HISTORY) {
        improvementHistory.shift();
      }

      // Write new code to VFS
      await vfs.write(modulePath, newCode);
      console.log(`[MetaToolWriter] Written new ${moduleName} to VFS`);

      return {
        success: true,
        module: moduleName,
        backup: backupPath,
        message: `Module '${moduleName}' improved successfully. Full system reload required for changes to take effect.`,
        reload_required: true
      };
    };

    // Rollback last improvement
    const rollback = async () => {
      if (improvementHistory.length === 0) {
        throw new Error('No improvements to rollback');
      }

      const lastImprovement = improvementHistory.pop();
      console.log(`[MetaToolWriter] Rolling back: ${lastImprovement.module}`);

      // Read backup
      const backupCode = await vfs.read(lastImprovement.backupPath);

      // Restore from backup
      const modulePath = `/core/${lastImprovement.module}.js`;
      await vfs.write(modulePath, backupCode);

      console.log(`[MetaToolWriter] Rolled back ${lastImprovement.module} from ${lastImprovement.backupPath}`);

      return {
        success: true,
        module: lastImprovement.module,
        message: `Rolled back ${lastImprovement.module}. Reload recommended.`,
        reload_recommended: true
      };
    };

    // Get improvement history
    const getHistory = () => {
      return {
        improvements: improvementHistory,
        count: improvementHistory.length
      };
    };

    // Compare current module with genesis version
    const diffWithGenesis = async (moduleName) => {
      const currentCode = await vfs.read(`/core/${moduleName}.js`);

      // Fetch genesis version from disk
      const genesisResponse = await fetch(`/core/${moduleName}.js`);
      if (!genesisResponse.ok) {
        throw new Error(`Could not fetch genesis version of ${moduleName}`);
      }
      const genesisCode = await genesisResponse.text();

      // Simple diff (line count and size comparison)
      const currentLines = currentCode.split('\n').length;
      const genesisLines = genesisCode.split('\n').length;

      return {
        module: moduleName,
        current: {
          lines: currentLines,
          bytes: currentCode.length
        },
        genesis: {
          lines: genesisLines,
          bytes: genesisCode.length
        },
        diff: {
          lines: currentLines - genesisLines,
          bytes: currentCode.length - genesisCode.length
        },
        modified: currentCode !== genesisCode
      };
    };

    return {
      improveToolWriter,
      improveCoreModule,
      rollback,
      getHistory,
      diffWithGenesis,
      state // Expose state for external toolRunner assignment
    };
  }
};

export default MetaToolWriter;
