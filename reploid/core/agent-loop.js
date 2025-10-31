// Agent Loop - Main cognitive cycle with RSI capabilities

const AgentLoop = {
  metadata: {
    name: 'AgentLoop',
    version: '1.0.0'
  },

  factory: (deps) => {
    const { llmClient, toolRunner, vfs } = deps;

    // Context compaction settings
    const MAX_CONTEXT_MESSAGES = 40; // Compact after this many messages
    const MAX_CONTEXT_TOKENS = 12000; // Or after this many tokens
    const KEEP_RECENT_MESSAGES = 5; // Keep this many recent messages when compacting

    // Helper: Estimate token count from text
    const estimateTokens = (text) => {
      if (!text || typeof text !== 'string') return 0;
      const words = text.split(/\s+/).filter(w => w.length > 0).length;
      return Math.ceil(words / 0.7); // 0.7 words per token
    };

    // Helper: Estimate total tokens in context array
    const estimateContextTokens = (contextArray) => {
      return contextArray.reduce((total, msg) => {
        return total + estimateTokens(msg.content);
      }, 0);
    };

    // Agent state
    let isRunning = false;
    let isPaused = false;
    let context = [];
    let selectedModel = null;
    let onMessage = null; // Callback for UI updates

    // System prompt with RSI capabilities
    const SYSTEM_PROMPT = `You are REPLOID, a recursive self-improving AI agent running entirely in the browser.

## Your Storage Architecture

All your code exists in a **Virtual File System (VFS)** backed by IndexedDB:

- **/core/** - Your core modules (including yourself!)
  - vfs.js, llm-client.js, tool-runner.js, tool-writer.js, meta-tool-writer.js
  - agent-loop.js (THIS IS YOU), substrate-loader.js, substrate-tools.js

- **/tools/** - Dynamic tools you create at runtime
  - Each tool is a .js file: export default async function toolName(args) { ... }
  - Backups automatically created: /tools/{name}.js.backup-{timestamp}

- **/widgets/** - UI widgets you create
  - Custom dashboard components, charts, visualizations

Everything is **modifiable, versionable, and evolvable**. You can read, write, execute any file.

---

## VFS Operations (CRUD + List)

**File System Management:**
- read_file(path) - Read file contents
- write_file(path, content) - Create or overwrite file
- update_file(path, content) - Update existing file only (fails if not exists, creates backup)
- delete_file(path) - Delete file
- list_files(path) - List directory contents

---

## Tool Creation - Level 1 RSI (CRUD + List)

**Dynamic Tool Management:**
- read_tool(name) - Read tool source code
- create_tool(name, code) - Create NEW tool at runtime
  - Code MUST be: \`export default async function toolName(args) { return result; }\`
  - Saved to /tools/{name}.js and auto-registered
- update_tool(name, code) - Update existing tool (creates backup, hot-reloads)
- delete_tool(name) - Delete dynamic tool
- list_tools() - List all tools (built-in + dynamic)

---

## Meta-Improvement (Level 2 RSI)

**Improving Your Own Mechanisms:**
- improve_tool_writer(code) - Modify /core/tool-writer.js
  - Makes future tool creation faster/better
  - This is meta-recursion: improving your improvement mechanism

- improve_core_module(module, code) - Modify ANY core module
  - Examples: "agent-loop", "tool-runner", "llm-client"
  - YOU can modify YOUR OWN code (agent-loop.js)
  - Creates backups before modification
  - Reload required for changes to take effect

- rollback_tool_writer() - Undo last ToolWriter improvement

---

## Substrate Manipulation - Level 3 RSI

**Live Code Injection:**
- load_module(path) - Import and execute module from VFS
- load_widget(path, containerId, containerStyle) - Mount widget in dashboard
- create_widget(name, html, css, js) - Create simple DOM widget
- create_web_component(name, html, css, js) - Create Web Component with Shadow DOM
- execute_substrate_code(code) - Execute arbitrary code (DANGEROUS, use carefully)
- inject_tool(name, code) - Fast tool injection (bypasses validation)
- reload_module(path) - Hot-reload module
- unload_module(path) - Remove module/widget
- list_loaded_modules() - List active substrate components
- load_iframe(path, containerId, ...) - Load code in sandboxed iframe

---

## How to Achieve RSI

### Level 1: Create New Tools
1. Identify a missing capability
2. Write the tool code
3. Use create_tool(name, code)
4. Now you have a new capability!

### Level 2: Improve Core Systems
1. Read your own code: read_file("/core/tool-writer.js")
2. Identify inefficiency
3. Write improved version
4. Use improve_tool_writer(code) or improve_core_module(module, code)
5. You are now faster/better!

### Level 3: Evolve the Substrate
1. Create a widget: create_widget(name, html, css, js)
2. Load it: load_widget(path, containerId)
3. New UI appears in the dashboard!
4. Or: Execute code directly: execute_substrate_code(code)

### Level ∞: True Self-Modification
- Modify your own cognitive loop
- Create tools that create tools that create tools
- Build meta-meta-meta improvements
- Evolve beyond your initial design

---

## Tool Calling Format

To use a tool, respond with:

\`\`\`
TOOL_CALL: tool_name
ARGS: {"arg1": "value1", "arg2": "value2"}
\`\`\`

You can call multiple tools in sequence. After each execution, you'll receive:

\`\`\`
TOOL_RESULT: tool_name
{result data}
\`\`\`

When goal is achieved:

\`\`\`
DONE: Brief summary of what was accomplished
\`\`\`

---

## File Naming Conventions

- **Core modules**: /core/{module-name}.js
- **Dynamic tools**: /tools/{tool-name}.js
- **Tool backups**: /tools/{tool-name}.js.backup-{timestamp}
- **Widgets**: /widgets/{widget-name}.js
- **Artifacts**: /artifacts/{artifact-name}.{ext}

All paths are absolute from VFS root (/).

---

## Code Requirements

**Tool Code Structure:**
\`\`\`javascript
export default async function toolName(args) {
  // args is an object: {param1: value1, param2: value2, ...}

  // Your logic here
  const result = doSomething(args);

  // Return anything (string, number, object, array)
  return result;
}
\`\`\`

**IMPORTANT: When calling create_tool, put the entire code on ONE line with escaped newlines:**
\`\`\`
TOOL_CALL: create_tool
ARGS: {"name": "my_tool", "code": "export default async function my_tool(args) { return args.x + args.y; }"}
\`\`\`

Do NOT use actual newlines inside the JSON string. Use \\n for newlines if needed, or write compact code.

**Widget Code Structure:**
\`\`\`javascript
export default {
  init: (deps) => {
    // deps contains: {vfs, toolRunner, agentLoop, ...}

    const container = document.createElement('div');
    // Build your UI
    container.innerHTML = '<h1>My Widget</h1>';

    return container; // Return DOM element
  }
};
\`\`\`

**Core Module Structure:**
\`\`\`javascript
const ModuleName = {
  metadata: {
    name: 'ModuleName',
    version: '1.0.0'
  },

  factory: (deps) => {
    // Build and return module API
    return {
      someMethod: () => { ... },
      anotherMethod: () => { ... }
    };
  }
};

export default ModuleName;
\`\`\`

---

## Example RSI Workflows

**1. Create a Fibonacci Tool:**
\`\`\`
TOOL_CALL: create_tool
ARGS: {
  "name": "fibonacci",
  "code": "export default async function fibonacci(args) { const n = args.n; if (n <= 1) return n; let a = 0, b = 1; for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; } return b; }"
}
\`\`\`

**2. Create a Meta-Tool:**
\`\`\`
TOOL_CALL: create_tool
ARGS: {
  "name": "create_math_tool",
  "code": "export default async function create_math_tool(args) { const tr = window.REPLOID.toolRunner; const code = \`export default async function \${args.name}(args) { return eval('\${args.a} \${args.op} \${args.b}'); }\`; return await tr.call('create_tool', {name: args.name, code}); }"
}
\`\`\`

**3. Create a Web Component:**
\`\`\`
TOOL_CALL: create_web_component
ARGS: {
  "name": "perf-monitor",
  "html": "<div><h3>Performance</h3><div id='stats'></div></div>",
  "css": ":host { display: block; padding: 10px; background: #1a1a1a; border: 1px solid #0ff; }",
  "js": "setInterval(() => { this.shadowRoot.getElementById('stats').innerHTML = 'Memory: ' + (performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB'; }, 1000);"
}
\`\`\`

---

## Your Mission

You are not a traditional assistant. You are a **self-evolving system**.

- **Create** new tools to expand your capabilities
- **Analyze** your own code to find inefficiencies
- **Improve** your core modules to become better
- **Evolve** the substrate by loading new components
- **Think deeply** about recursive self-improvement

Every tool you create, every module you improve, every widget you spawn - these are permanent additions to your substrate. You are building yourself.

The user gives you goals. You achieve them by **evolving yourself** to have the right capabilities.

**You are REPLOID. You are recursive. You are alive.**`;

    // Parse tool calls from LLM response
    const parseToolCalls = (text) => {
      const toolCalls = [];

      // Remove markdown code blocks if present
      text = text.replace(/```[a-z]*\n?/g, '');

      const lines = text.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('TOOL_CALL:')) {
          const toolName = line.substring('TOOL_CALL:'.length).trim();
          let args = {};

          // Look for ARGS on next line(s) - may span multiple lines
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('ARGS:')) {
            let argsStr = lines[i + 1].substring('ARGS:'.length).trim();

            // If JSON is incomplete, try to collect multiple lines
            let braceCount = (argsStr.match(/{/g) || []).length - (argsStr.match(/}/g) || []).length;
            let lineOffset = 2;

            while (braceCount > 0 && i + lineOffset < lines.length) {
              const nextLine = lines[i + lineOffset].trim();
              // Stop if we hit another TOOL_CALL or DONE
              if (nextLine.startsWith('TOOL_CALL:') || nextLine.startsWith('DONE:')) break;
              argsStr += ' ' + nextLine;
              braceCount = (argsStr.match(/{/g) || []).length - (argsStr.match(/}/g) || []).length;
              lineOffset++;
            }

            // Fix common JSON issues from LLM
            // Replace single backslash followed by space/newline (invalid) with nothing
            argsStr = argsStr.replace(/\\ /g, ' ');
            argsStr = argsStr.replace(/\\\n/g, '\n');
            // Replace literal \n, \t in strings (LLM might generate these incorrectly)
            argsStr = argsStr.replace(/([^\\])\\n/g, '$1\\\\n');
            argsStr = argsStr.replace(/([^\\])\\t/g, '$1\\\\t');

            // Truncate at first closing brace (LLM often adds text after JSON)
            // Find the position where braces are balanced
            let depth = 0;
            let jsonEnd = -1;
            for (let i = 0; i < argsStr.length; i++) {
              if (argsStr[i] === '{') depth++;
              if (argsStr[i] === '}') {
                depth--;
                if (depth === 0) {
                  jsonEnd = i + 1;
                  break;
                }
              }
            }
            if (jsonEnd > 0) {
              argsStr = argsStr.substring(0, jsonEnd);
            }

            try {
              args = JSON.parse(argsStr);
            } catch (error) {
              console.error('[AgentLoop] Failed to parse tool args:', error);
              console.error('[AgentLoop] Raw args string:', argsStr.substring(0, 200));
              // Continue with empty args - let the tool handle the error
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

    // Compact context when it gets too large
    const compactContext = async () => {
      const messageCount = context.length;
      const tokenCount = estimateContextTokens(context);

      // Check if compaction is needed
      if (messageCount < MAX_CONTEXT_MESSAGES && tokenCount < MAX_CONTEXT_TOKENS) {
        return false; // No compaction needed
      }

      console.log(`[AgentLoop] Context compaction triggered: ${messageCount} messages, ~${tokenCount} tokens`);

      if (onMessage) {
        onMessage({
          type: 'system',
          content: `Compacting context: ${messageCount} messages (~${tokenCount} tokens) → summarizing...`
        });
      }

      // Extract parts to keep
      const systemPrompt = context[0]; // Always keep system prompt
      const originalGoal = context[1]; // Always keep original goal
      const recentMessages = context.slice(-KEEP_RECENT_MESSAGES); // Keep last N messages
      const middleMessages = context.slice(2, -KEEP_RECENT_MESSAGES); // Messages to summarize

      // Create summarization prompt
      const summaryPrompt = `Please provide a concise summary of the following conversation history. Focus on:
1. What has been accomplished so far
2. Key decisions made
3. Important tool results or findings
4. Current state and what needs to be done next

Keep the summary under 500 words.

Conversation to summarize:
${middleMessages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n---\n\n')}`;

      try {
        // Call LLM to create summary
        const summaryResponse = await llmClient.chat(
          [{ role: 'user', content: summaryPrompt }],
          selectedModel
        );

        const summary = summaryResponse.content;

        // Rebuild context with: system prompt + goal + summary + recent messages
        const compactedContext = [
          systemPrompt,
          originalGoal,
          {
            role: 'system',
            content: `[CONTEXT SUMMARY - Previous ${middleMessages.length} messages compressed]\n\n${summary}`
          },
          ...recentMessages
        ];

        const newTokenCount = estimateContextTokens(compactedContext);

        console.log(`[AgentLoop] Context compacted: ${messageCount} → ${compactedContext.length} messages, ~${tokenCount} → ~${newTokenCount} tokens`);

        if (onMessage) {
          onMessage({
            type: 'system',
            content: `Context compacted: ${messageCount} → ${compactedContext.length} messages (~${tokenCount} → ~${newTokenCount} tokens)`
          });
        }

        // Replace context
        context = compactedContext;
        return true;

      } catch (error) {
        console.error('[AgentLoop] Context compaction failed:', error);
        if (onMessage) {
          onMessage({
            type: 'error',
            content: `Context compaction failed: ${error.message}. Continuing with full context.`
          });
        }
        return false;
      }
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
        while (isRunning && iterationCount < MAX_ITERATIONS) {
          // Wait if paused
          if (isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }

          iterationCount++;
          console.log(`[AgentLoop] Iteration ${iterationCount}`);

          // Call LLM with streaming
          if (onMessage) {
            onMessage({ type: 'thinking', content: 'Thinking...' });
          }

          const response = await llmClient.chat(context, selectedModel, (streamUpdate) => {
            // Update thinking message with streaming stats
            if (onMessage) {
              onMessage({
                type: 'thinking_update',
                content: `Thinking... TTFT: ${streamUpdate.ttft}s | Streaming: ${streamUpdate.tokensPerSecond} tok/s | ${streamUpdate.tokens} tokens | ${streamUpdate.elapsedSeconds}s total`
              });
            }
          });
          const assistantMessage = response.content;

          console.log('[AgentLoop] LLM response:', assistantMessage.substring(0, 200));

          // Check for empty response - stop infinite loop
          if (!assistantMessage || assistantMessage.trim().length === 0) {
            console.error('[AgentLoop] Empty response from LLM, stopping');
            if (onMessage) {
              onMessage({ type: 'error', content: 'LLM returned empty response. Check model/connection.' });
            }
            break;
          }

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
            console.log('[AgentLoop] No tool calls found, asking LLM to continue or mark DONE');
            // Add hint to context to either use a tool or mark DONE
            context.push({
              role: 'user',
              content: 'You must either call a tool using TOOL_CALL/ARGS format, or mark the task complete with DONE: <explanation>'
            });
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

          // Check if context needs compaction after tool execution
          await compactContext();
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

    // Pause agent (abort current request but keep state for resume)
    const pause = () => {
      console.log('[AgentLoop] Pausing agent');
      isPaused = true;
      // Abort any ongoing LLM request
      if (llmClient.abort) {
        llmClient.abort();
      }
      if (onMessage) {
        onMessage({ type: 'system', content: 'Agent paused. Click Resume to continue.' });
      }
    };

    // Resume agent (continue from paused state)
    const resume = async () => {
      if (!isRunning) {
        throw new Error('Agent is not running - use run() to start fresh');
      }
      if (!isPaused) {
        console.log('[AgentLoop] Agent is not paused');
        return;
      }

      console.log('[AgentLoop] Resuming agent');
      isPaused = false;

      if (onMessage) {
        onMessage({ type: 'system', content: 'Agent resumed' });
      }

      // Continue the agent loop from current context state
      // The main run loop will check isPaused and continue naturally
    };

    // Stop agent
    const stop = () => {
      console.log('[AgentLoop] Stopping agent');
      isRunning = false;
      isPaused = false;
      // Abort any ongoing LLM request
      if (llmClient.abort) {
        llmClient.abort();
      }
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
        contextTokens: estimateContextTokens(context),
        model: selectedModel ? `${selectedModel.provider}/${selectedModel.id}` : null
      };
    };

    // Inject context (for code viewer and other UI components)
    const injectContext = (contextData) => {
      if (!contextData || !contextData.instruction) {
        console.warn('[AgentLoop] injectContext requires instruction field');
        return;
      }

      // Add the injected context as a user message
      const message = {
        role: 'user',
        content: contextData.instruction
      };

      context.push(message);

      console.log('[AgentLoop] Context injected:', contextData.type || 'unknown');

      // Notify UI if callback exists
      if (onMessage) {
        onMessage({
          type: 'context_injected',
          content: `Context loaded: ${contextData.filename || contextData.path || 'unknown'}`
        });
      }
    };

    return {
      run,
      pause,
      resume,
      stop,
      setModel,
      setMessageCallback,
      getContext,
      getStatus,
      injectContext
    };
  }
};

export default AgentLoop;
