// Tool Runner - Execute built-in and dynamically created tools

const ToolRunner = {
  metadata: {
    name: 'ToolRunner',
    version: '1.0.0'
  },

  factory: (deps) => {
    const { vfs, toolWriter, metaToolWriter } = deps;

    // Tool registry (Map of name -> function)
    const tools = new Map();

    // Built-in tools (registered at initialization)
    const builtInTools = {
      // VFS operations
      read_file: async (args) => {
        if (!args.path) throw new Error('read_file requires "path" argument');
        console.log(`[Tool:read_file] Reading: ${args.path}`);
        return await vfs.read(args.path);
      },

      write_file: async (args) => {
        if (!args.path || args.content === undefined) {
          throw new Error('write_file requires "path" and "content" arguments');
        }
        console.log(`[Tool:write_file] Writing: ${args.path} (${args.content.length} bytes)`);
        await vfs.write(args.path, args.content);
        return { success: true, path: args.path, bytes: args.content.length };
      },

      list_files: async (args) => {
        const path = args.path || '/';
        console.log(`[Tool:list_files] Listing: ${path}`);
        return await vfs.list(path);
      },

      delete_file: async (args) => {
        if (!args.path) throw new Error('delete_file requires "path" argument');
        console.log(`[Tool:delete_file] Deleting: ${args.path}`);
        await vfs.delete(args.path);
        return { success: true, path: args.path };
      },

      // Tool creation (Level 1 RSI)
      create_tool: async (args) => {
        if (!args.name || !args.code) {
          throw new Error('create_tool requires "name" and "code" arguments');
        }
        console.log(`[Tool:create_tool] Creating tool: ${args.name}`);
        return await toolWriter.createTool(args.name, args.code);
      },

      update_tool: async (args) => {
        if (!args.name || !args.code) {
          throw new Error('update_tool requires "name" and "code" arguments');
        }
        console.log(`[Tool:update_tool] Updating tool: ${args.name}`);
        return await toolWriter.updateTool(args.name, args.code);
      },

      delete_tool: async (args) => {
        if (!args.name) throw new Error('delete_tool requires "name" argument');
        console.log(`[Tool:delete_tool] Deleting tool: ${args.name}`);
        return await toolWriter.deleteTool(args.name);
      },

      // Meta-improvement (Level 2 RSI)
      improve_tool_writer: async (args) => {
        if (!args.code) {
          throw new Error('improve_tool_writer requires "code" argument');
        }
        console.log(`[Tool:improve_tool_writer] Improving ToolWriter mechanism`);
        return await metaToolWriter.improveToolWriter(args.code);
      },

      rollback_tool_writer: async (args) => {
        console.log(`[Tool:rollback_tool_writer] Rolling back ToolWriter`);
        return await metaToolWriter.rollback();
      },

      // Core module improvement (Level 2+ RSI)
      improve_core_module: async (args) => {
        if (!args.module || !args.code) {
          throw new Error('improve_core_module requires "module" and "code" arguments');
        }
        console.log(`[Tool:improve_core_module] Improving core module: ${args.module}`);
        return await metaToolWriter.improveCoreModule(args.module, args.code);
      },

      // Introspection tools
      list_tools: async (args) => {
        const toolList = Array.from(tools.keys()).map(name => ({
          name,
          type: builtInTools[name] ? 'built-in' : 'dynamic'
        }));
        return { tools: toolList, count: toolList.length };
      },

      get_tool_source: async (args) => {
        if (!args.name) throw new Error('get_tool_source requires "name" argument');

        // Built-in tools don't have source in VFS
        if (builtInTools[args.name]) {
          return { name: args.name, type: 'built-in', source: 'Built-in tool (not editable)' };
        }

        // Dynamic tools have source in /tools/
        const source = await vfs.read(`/tools/${args.name}.js`);
        return { name: args.name, type: 'dynamic', source };
      }
    };

    // Register all built-in tools
    for (const [name, fn] of Object.entries(builtInTools)) {
      tools.set(name, fn);
    }

    // Public API
    const execute = async (name, args = {}) => {
      if (!tools.has(name)) {
        throw new Error(`Tool not found: ${name}. Available tools: ${Array.from(tools.keys()).join(', ')}`);
      }

      try {
        const result = await tools.get(name)(args);
        return result;
      } catch (error) {
        console.error(`[ToolRunner] Error executing ${name}:`, error);
        throw error;
      }
    };

    const register = (name, fn) => {
      if (builtInTools[name]) {
        throw new Error(`Cannot override built-in tool: ${name}`);
      }
      console.log(`[ToolRunner] Registering dynamic tool: ${name}`);
      tools.set(name, fn);
    };

    const unregister = (name) => {
      if (builtInTools[name]) {
        throw new Error(`Cannot unregister built-in tool: ${name}`);
      }
      console.log(`[ToolRunner] Unregistering tool: ${name}`);
      tools.delete(name);
    };

    const list = () => {
      return Array.from(tools.keys()).map(name => ({
        name,
        type: builtInTools[name] ? 'built-in' : 'dynamic'
      }));
    };

    const has = (name) => {
      return tools.has(name);
    };

    return {
      execute,
      register,
      unregister,
      list,
      has
    };
  }
};

export default ToolRunner;
