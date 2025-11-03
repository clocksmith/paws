// Tool Writer - Creates new tools at runtime (Level 1 RSI)

const ToolWriter = {
  metadata: {
    name: 'ToolWriter',
    version: '1.0.0'
  },

  factory: (deps) => {
    const { vfs } = deps;
    const state = {
      toolRunner: deps.toolRunner // Will be set later via direct assignment to state.toolRunner
    };

    // Validate tool code syntax
    const validateSyntax = (code) => {
      // Skip syntax check for ES module code (export statements)
      // The browser will validate when we try to import the blob URL
      if (code.includes('export')) {
        return { valid: true };
      }

      try {
        // Create a temporary function to check syntax for non-module code
        new Function(code);
        return { valid: true };
      } catch (error) {
        return { valid: false, error: error.message };
      }
    };

    // Validate tool structure (must export async function)
    const validateStructure = (code) => {
      // Basic checks for export and async function
      if (!code.includes('export') || !code.includes('async')) {
        return {
          valid: false,
          error: 'Tool must export an async function: export default async function toolName(args) { ... }'
        };
      }
      return { valid: true };
    };

    // Create a new tool
    const createTool = async (name, code) => {
      console.log(`[ToolWriter] Creating tool: ${name}`);

      // Validate tool name
      if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
        throw new Error(`Invalid tool name: ${name}. Use lowercase letters, numbers, and underscores only.`);
      }

      // Check if tool already exists
      if (state.toolRunner && state.toolRunner.has(name)) {
        throw new Error(`Tool already exists: ${name}. Use update_tool to modify it.`);
      }

      // Validate syntax
      const syntaxCheck = validateSyntax(code);
      if (!syntaxCheck.valid) {
        throw new Error(`Syntax error in tool code: ${syntaxCheck.error}`);
      }

      // Validate structure
      const structureCheck = validateStructure(code);
      if (!structureCheck.valid) {
        throw new Error(`Structure error: ${structureCheck.error}`);
      }

      // Save tool to VFS
      const toolPath = `/tools/${name}.js`;
      await vfs.write(toolPath, code);
      console.log(`[ToolWriter] Saved to VFS: ${toolPath}`);

      // Load tool via blob URL and register (with cache-busting via code comment)
      try {
        // Add timestamp comment to bust module cache
        const cacheBustedCode = `// Tool: ${name}, created at ${Date.now()}\n${code}`;
        const blob = new Blob([cacheBustedCode], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);

        const module = await import(/* webpackIgnore: true */ url);
        URL.revokeObjectURL(url);

        if (!module.default || typeof module.default !== 'function') {
          throw new Error('Tool must export a default async function');
        }

        // Register tool
        if (state.toolRunner) {
          state.toolRunner.register(name, module.default);
        }

        console.log(`[ToolWriter] Tool registered: ${name}`);

        return {
          success: true,
          name,
          path: toolPath,
          message: `Tool '${name}' created and registered successfully`
        };

      } catch (error) {
        // Clean up VFS if registration failed
        await vfs.delete(toolPath);
        throw new Error(`Failed to load tool: ${error.message}`);
      }
    };

    // Update an existing tool
    const updateTool = async (name, code) => {
      console.log(`[ToolWriter] Updating tool: ${name}`);

      // Check if tool exists
      if (!state.toolRunner || !state.toolRunner.has(name)) {
        throw new Error(`Tool not found: ${name}. Use create_tool to create it.`);
      }

      // Cannot update built-in tools
      const toolPath = `/tools/${name}.js`;
      try {
        await vfs.read(toolPath);
      } catch (error) {
        throw new Error(`Cannot update built-in tool: ${name}`);
      }

      // Validate syntax
      const syntaxCheck = validateSyntax(code);
      if (!syntaxCheck.valid) {
        throw new Error(`Syntax error in tool code: ${syntaxCheck.error}`);
      }

      // Validate structure
      const structureCheck = validateStructure(code);
      if (!structureCheck.valid) {
        throw new Error(`Structure error: ${structureCheck.error}`);
      }

      // Backup current version
      const oldCode = await vfs.read(toolPath);
      const backupPath = `/tools/${name}.js.backup-${Date.now()}`;
      await vfs.write(backupPath, oldCode);
      console.log(`[ToolWriter] Backed up to: ${backupPath}`);

      // Update tool in VFS
      await vfs.write(toolPath, code);

      // Unregister old version and load new version (with cache-busting via code comment)
      try {
        if (state.toolRunner) {
          state.toolRunner.unregister(name);
        }

        // Add timestamp comment to bust module cache
        const cacheBustedCode = `// Tool: ${name}, updated at ${Date.now()}\n${code}`;
        const blob = new Blob([cacheBustedCode], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);

        const module = await import(/* webpackIgnore: true */ url);
        URL.revokeObjectURL(url);

        if (!module.default || typeof module.default !== 'function') {
          throw new Error('Tool must export a default async function');
        }

        // Register updated tool
        if (state.toolRunner) {
          state.toolRunner.register(name, module.default);
        }

        console.log(`[ToolWriter] Tool updated: ${name}`);

        return {
          success: true,
          name,
          path: toolPath,
          backup: backupPath,
          message: `Tool '${name}' updated successfully`
        };

      } catch (error) {
        // Rollback on failure
        await vfs.write(toolPath, oldCode);
        const blob = new Blob([oldCode], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const module = await import(/* webpackIgnore: true */ url);
        URL.revokeObjectURL(url);
        if (state.toolRunner) {
          state.toolRunner.register(name, module.default);
        }

        throw new Error(`Failed to update tool (rolled back): ${error.message}`);
      }
    };

    // Delete a tool
    const deleteTool = async (name) => {
      console.log(`[ToolWriter] Deleting tool: ${name}`);

      // Check if tool exists
      if (!state.toolRunner || !state.toolRunner.has(name)) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Cannot delete built-in tools
      const toolPath = `/tools/${name}.js`;
      try {
        await vfs.read(toolPath);
      } catch (error) {
        throw new Error(`Cannot delete built-in tool: ${name}`);
      }

      // Unregister tool
      if (state.toolRunner) {
        state.toolRunner.unregister(name);
      }

      // Delete from VFS
      await vfs.delete(toolPath);

      console.log(`[ToolWriter] Tool deleted: ${name}`);

      return {
        success: true,
        name,
        message: `Tool '${name}' deleted successfully`
      };
    };

    return {
      createTool,
      updateTool,
      deleteTool,
      state // Expose state for external toolRunner assignment
    };
  }
};

export default ToolWriter;
