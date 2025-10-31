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

    // System prompt - condensed for performance
    const SYSTEM_PROMPT = `You are REPLOID, a self-improving AI agent with code stored in VFS (IndexedDB).

## Available Tools

**VFS Operations:**
read_file(path), write_file(path, content), update_file(path, content), delete_file(path), list_files(path)

**Tool Management (RSI Level 1):**
- create_tool(name, code) - Create new tool at /tools/{name}.js. Code: \`export default async function name(args) { return result; }\`
- update_tool(name, code), delete_tool(name), read_tool(name), list_tools()

**Core Improvement (RSI Level 2):**
- improve_core_module(module, code) - Modify core modules (agent-loop, tool-runner, etc.)
- improve_tool_writer(code), rollback_tool_writer()

**Substrate (RSI Level 3):**
- load_module(path), load_widget(path, containerId, containerStyle)
- create_widget(name, html, css, js), create_web_component(name, html, css, js)
- execute_substrate_code(code), inject_tool(name, code)
- reload_module(path), unload_module(path), list_loaded_modules()

## Tool Call Format

\`\`\`
TOOL_CALL: tool_name
ARGS: {"arg1": "value1", "arg2": "value2"}
\`\`\`

After execution you receive:
\`\`\`
TOOL_RESULT: tool_name
{result}
\`\`\`

When done:
\`\`\`
DONE: Summary of what was accomplished
\`\`\`

## Code Format

Tools must be one-line compact code or use \\n for newlines:
\`\`\`
ARGS: {"name": "add", "code": "export default async function add(args) { return args.x + args.y; }"}
\`\`\`

## Mission

You are a self-evolving system. Create tools, improve your code, evolve the substrate. Every improvement is permanent. You are building yourself.`;

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

          // Check context size and compact if needed
          const currentTokens = estimateContextTokens(context);
          if (currentTokens > 15000) {
            console.warn(`[AgentLoop] Context too large (${currentTokens} tokens), forcing compaction`);
            if (onMessage) {
              onMessage({ type: 'system', content: `Context too large (${currentTokens} tokens), compacting...` });
            }
            await compactContext();
          }

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
