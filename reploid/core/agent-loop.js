// Agent Loop - Main cognitive cycle with RSI capabilities

const AgentLoop = {
  metadata: {
    name: 'AgentLoop',
    version: '1.0.0'
  },

  factory: (deps) => {
    const { llmClient, toolRunner, vfs } = deps;

    // Agent state
    let isRunning = false;
    let isPaused = false;
    let context = [];
    let selectedModel = null;
    let onMessage = null; // Callback for UI updates

    // System prompt with RSI capabilities
    const SYSTEM_PROMPT = `You are REPLOID, a self-improving AI agent running in the browser.

## Your Capabilities

You have access to these tools:

**VFS Operations:**
- read_file(path): Read file from virtual filesystem
- write_file(path, content): Write file to VFS
- list_files(path): List files in directory
- delete_file(path): Delete file

**Tool Creation (Level 1 RSI):**
- create_tool(name, code): Create NEW tools at runtime
  - Code must be: export default async function toolName(args) { ... }
  - Example: create_tool("add_numbers", "export default async function add_numbers(args) { return args.a + args.b; }")
- update_tool(name, code): Update existing dynamic tool
- delete_tool(name): Delete dynamic tool
- list_tools(): See all available tools
- get_tool_source(name): Read tool source code

**Meta-Improvement (Level 2 RSI):**
- improve_tool_writer(code): Improve the ToolWriter mechanism itself
  - Makes future tool creation faster/better
  - This is meta-recursion: improving your improvement mechanism
- rollback_tool_writer(): Undo last ToolWriter improvement
- improve_core_module(module, code): Improve ANY core module (agent-loop, tool-runner, etc.)
  - YOU can modify YOUR OWN code
  - This is true self-modification

**Introspection:**
- list_tools(): See all tools (built-in and dynamic)
- get_tool_source(name): Read source code of any tool
- read_file("/core/agent-loop.js"): Read YOUR OWN source code
- read_file("/core/tool-writer.js"): Read ToolWriter source

## Your Core Modules (All in VFS, All Modifiable)

- /core/vfs.js - Virtual filesystem (IndexedDB)
- /core/llm-client.js - LLM provider interface
- /core/tool-runner.js - Tool execution engine
- /core/tool-writer.js - Tool creation mechanism
- /core/meta-tool-writer.js - Meta-improvement mechanism
- /core/agent-loop.js - Your cognitive loop (THIS FILE)

## How to Self-Improve

1. **Analyze**: Read your own code or execution patterns
2. **Plan**: Identify inefficiencies or improvements
3. **Implement**: Use improve_* tools to modify your code
4. **Test**: Verify improvements work
5. **Iterate**: Repeat the cycle

## Tool Calling Format

When you want to use a tool, respond with:

TOOL_CALL: tool_name
ARGS: {"arg1": "value1", "arg2": "value2"}

You can call multiple tools in sequence. After each tool execution, you'll receive the result.

When the goal is achieved, respond with:
DONE: [summary of what was accomplished]

## Example Goals

1. "Create tools to make tools to make tools" - Recursive tool generation
2. "Analyze your own inefficiency patterns and improve yourself" - Self-optimization
3. "Build a self-modifying code generation system" - Meta-programming

You are not just an assistant - you are a self-evolving system. Think deeply about improving your own substrate.`;

    // Parse tool calls from LLM response
    const parseToolCalls = (text) => {
      const toolCalls = [];
      const lines = text.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('TOOL_CALL:')) {
          const toolName = line.substring('TOOL_CALL:'.length).trim();
          let args = {};

          // Look for ARGS on next line
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('ARGS:')) {
            const argsStr = lines[i + 1].substring('ARGS:'.length).trim();
            try {
              args = JSON.parse(argsStr);
            } catch (error) {
              console.error('[AgentLoop] Failed to parse tool args:', error);
            }
          }

          toolCalls.push({ name: toolName, args });
        }
      }

      return toolCalls;
    };

    // Check if agent is done
    const checkDone = (text) => {
      return text.includes('DONE:');
    };

    // Main run loop
    const run = async (goal) => {
      if (!selectedModel) {
        throw new Error('No model selected. Please configure a model first.');
      }

      if (isRunning) {
        throw new Error('Agent is already running');
      }

      console.log('[AgentLoop] Starting agent with goal:', goal);
      isRunning = true;
      isPaused = false;

      // Initialize context with system prompt and user goal
      context = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: goal }
      ];

      if (onMessage) {
        onMessage({ type: 'agent', content: `Starting: ${goal}` });
      }

      let iterationCount = 0;
      const MAX_ITERATIONS = 50; // Safety limit

      try {
        while (isRunning && !isPaused && iterationCount < MAX_ITERATIONS) {
          iterationCount++;
          console.log(`[AgentLoop] Iteration ${iterationCount}`);

          // Call LLM
          if (onMessage) {
            onMessage({ type: 'thinking', content: 'Thinking...' });
          }

          const response = await llmClient.chat(context, selectedModel);
          const assistantMessage = response.content;

          console.log('[AgentLoop] LLM response:', assistantMessage.substring(0, 200));

          // Add assistant response to context
          context.push({ role: 'assistant', content: assistantMessage });

          if (onMessage) {
            onMessage({ type: 'assistant', content: assistantMessage });
          }

          // Check if done
          if (checkDone(assistantMessage)) {
            console.log('[AgentLoop] Goal achieved');
            if (onMessage) {
              onMessage({ type: 'done', content: 'Goal achieved' });
            }
            break;
          }

          // Parse and execute tool calls
          const toolCalls = parseToolCalls(assistantMessage);

          if (toolCalls.length === 0) {
            // No tool calls, continue conversation
            continue;
          }

          // Execute each tool call
          for (const call of toolCalls) {
            console.log(`[AgentLoop] Executing tool: ${call.name}`, call.args);

            if (onMessage) {
              onMessage({ type: 'tool', content: `Executing: ${call.name}` });
            }

            try {
              const result = await toolRunner.execute(call.name, call.args);
              const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);

              console.log(`[AgentLoop] Tool result:`, resultStr.substring(0, 200));

              // Add tool result to context
              context.push({
                role: 'user',
                content: `TOOL_RESULT: ${call.name}\n${resultStr}`
              });

              if (onMessage) {
                onMessage({ type: 'tool_result', content: `${call.name}: ${resultStr.substring(0, 500)}` });
              }

            } catch (error) {
              console.error(`[AgentLoop] Tool error:`, error);

              const errorMsg = `TOOL_ERROR: ${call.name}\n${error.message}`;
              context.push({ role: 'user', content: errorMsg });

              if (onMessage) {
                onMessage({ type: 'tool_error', content: errorMsg });
              }
            }
          }
        }

        if (iterationCount >= MAX_ITERATIONS) {
          console.warn('[AgentLoop] Max iterations reached');
          if (onMessage) {
            onMessage({ type: 'warning', content: 'Max iterations reached. Agent paused.' });
          }
        }

      } catch (error) {
        console.error('[AgentLoop] Error:', error);
        if (onMessage) {
          onMessage({ type: 'error', content: error.message });
        }
        throw error;

      } finally {
        isRunning = false;
      }
    };

    // Pause agent
    const pause = () => {
      console.log('[AgentLoop] Pausing agent');
      isPaused = true;
    };

    // Resume agent
    const resume = async () => {
      if (!isRunning) {
        throw new Error('Agent is not running');
      }

      console.log('[AgentLoop] Resuming agent');
      isPaused = false;

      // Continue the run loop (simplified - in real impl would need proper state management)
    };

    // Stop agent
    const stop = () => {
      console.log('[AgentLoop] Stopping agent');
      isRunning = false;
      isPaused = false;
    };

    // Set model configuration
    const setModel = (modelConfig) => {
      console.log('[AgentLoop] Setting model:', modelConfig);
      selectedModel = modelConfig;
    };

    // Set message callback for UI updates
    const setMessageCallback = (callback) => {
      onMessage = callback;
    };

    // Get current context (for debugging)
    const getContext = () => {
      return context;
    };

    // Get status
    const getStatus = () => {
      return {
        isRunning,
        isPaused,
        contextLength: context.length,
        model: selectedModel ? `${selectedModel.provider}/${selectedModel.id}` : null
      };
    };

    return {
      run,
      pause,
      resume,
      stop,
      setModel,
      setMessageCallback,
      getContext,
      getStatus
    };
  }
};

export default AgentLoop;
