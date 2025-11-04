// Agent Status Monitor UI for REPLOID Agent

const ChatUI = {
  init: (agentLoop) => {
    const container = document.getElementById('agent-container');
    const messagesDiv = document.getElementById('agent-log');
    const inputDiv = document.getElementById('chat-input-area');
    const stopBtn = document.getElementById('stop-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const contextMessagesSpan = document.getElementById('context-messages');
    const contextTokensSpan = document.getElementById('context-tokens');

    // New visualization elements
    const contextProgressBar = document.getElementById('context-progress-fill');
    const iterationCounter = document.getElementById('iteration-counter');
    const iterationText = document.getElementById('iteration-text');
    const iterationProgressBar = document.getElementById('iteration-progress-fill');
    const streamingMetrics = document.getElementById('streaming-metrics');
    const metricsTTFT = document.getElementById('metrics-ttft');
    const metricsTokenSec = document.getElementById('metrics-tokensec');
    const metricsTokens = document.getElementById('metrics-tokens');
    const metricsElapsed = document.getElementById('metrics-elapsed');

    // Setup message callback
    agentLoop.setMessageCallback((message) => {
      addMessage(message);
      // Update context stats after each message
      updateContextStats();
    });

    // Update context stats display
    const updateContextStats = () => {
      const status = agentLoop.getStatus();
      if (contextMessagesSpan) {
        contextMessagesSpan.textContent = `${status.contextLength} msgs`;
        // Color code based on size
        if (status.contextLength > 30) {
          contextMessagesSpan.style.color = '#fa0'; // Orange warning
        } else {
          contextMessagesSpan.style.color = '#888';
        }
      }
      if (contextTokensSpan) {
        contextTokensSpan.textContent = `~${status.contextTokens} tokens`;
        // Color code based on token count
        if (status.contextTokens > 10000) {
          contextTokensSpan.style.color = '#f00'; // Red critical
        } else if (status.contextTokens > 8000) {
          contextTokensSpan.style.color = '#fa0'; // Orange warning
        } else {
          contextTokensSpan.style.color = '#888';
        }
      }

      // Update context progress bar
      if (contextProgressBar) {
        const MAX_CONTEXT_TOKENS = 12000; // Should match agent-loop.js
        const percentage = Math.min((status.contextTokens / MAX_CONTEXT_TOKENS) * 100, 100);
        contextProgressBar.style.width = `${percentage}%`;

        // Color code: green → yellow → red
        if (percentage > 80) {
          contextProgressBar.style.background = '#f00'; // Red
        } else if (percentage > 60) {
          contextProgressBar.style.background = '#fa0'; // Orange
        } else {
          contextProgressBar.style.background = '#0f0'; // Green
        }
      }

      // Update iteration counter
      if (status.currentIteration !== undefined && status.currentIteration > 0) {
        if (iterationCounter) {
          iterationCounter.style.display = 'block';
        }
        if (iterationText) {
          iterationText.textContent = `Iteration ${status.currentIteration}/${status.maxIterations}`;
        }
        if (iterationProgressBar) {
          const percentage = (status.currentIteration / status.maxIterations) * 100;
          iterationProgressBar.style.width = `${percentage}%`;
        }
      }
    };

    // Stop button
    stopBtn.addEventListener('click', () => {
      agentLoop.stop();
      addMessage({ type: 'system', content: 'Agent stopped by user' });
      inputDiv.style.display = 'block';
      // Reset pause button if it was showing "Resume"
      pauseBtn.textContent = 'Pause';
      pauseBtn.style.background = '#333';
    });

    // Pause/Resume button toggle
    let isPaused = false;
    pauseBtn.addEventListener('click', () => {
      if (isPaused) {
        // Resume
        agentLoop.resume();
        addMessage({ type: 'system', content: 'Agent resumed' });
        pauseBtn.textContent = 'Pause';
        pauseBtn.style.background = '#333';
        isPaused = false;
      } else {
        // Pause
        agentLoop.pause();
        addMessage({ type: 'system', content: 'Agent paused' });
        pauseBtn.textContent = 'Resume';
        pauseBtn.style.background = '#070';
        isPaused = true;
      }
    });

    // Export State button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          addMessage({ type: 'system', content: 'Exporting REPLOID state...' });
          await window.downloadREPLOID(`reploid-export-${Date.now()}.json`);
          addMessage({ type: 'system', content: 'Export complete - downloaded JSON file' });
        } catch (error) {
          console.error('Export failed:', error);
          addMessage({ type: 'error', content: `Export failed: ${error.message}` });
        }
      });
    }

    // Store reference to last thinking message for updates
    let lastThinkingMessage = null;

    // Add message to chat
    const addMessage = (message) => {
      // Handle thinking updates (update existing message)
      if (message.type === 'thinking_update') {
        if (lastThinkingMessage) {
          const contentDiv = lastThinkingMessage.querySelector('.message-content');
          if (contentDiv) {
            contentDiv.textContent = message.content;
          }

          // Update streaming metrics display
          // Parse metrics from message content like "TTFT: 0.34s | Streaming: 42 tok/s | 120 tokens | 2.8s total"
          const contentText = message.content;
          const ttftMatch = contentText.match(/TTFT:\s*([^\s]+)/);
          const tokSecMatch = contentText.match(/Streaming:\s*([^\s]+)\s*tok\/s/);
          const tokensMatch = contentText.match(/(\d+)\s*tokens/);
          const elapsedMatch = contentText.match(/([^\s]+)s\s*total/);

          if (streamingMetrics && (ttftMatch || tokSecMatch || tokensMatch || elapsedMatch)) {
            streamingMetrics.style.display = 'block';
            if (metricsTTFT && ttftMatch) {
              metricsTTFT.textContent = `TTFT: ${ttftMatch[1]}`;
            }
            if (metricsTokenSec && tokSecMatch) {
              metricsTokenSec.textContent = `${tokSecMatch[1]} tok/s`;
            }
            if (metricsTokens && tokensMatch) {
              metricsTokens.textContent = `${tokensMatch[1]} tokens`;
            }
            if (metricsElapsed && elapsedMatch) {
              metricsElapsed.textContent = `${elapsedMatch[1]}s`;
            }
          }

          return lastThinkingMessage;
        }
      }

      // Hide streaming metrics when not thinking
      if (message.type === 'assistant' && streamingMetrics) {
        streamingMetrics.style.display = 'none';
      }

      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-message ${message.type}`;

      // Track thinking messages for updates
      if (message.type === 'thinking') {
        lastThinkingMessage = msgDiv;
      } else if (message.type === 'assistant') {
        // Clear thinking reference when we get actual response
        lastThinkingMessage = null;
      }

      let icon = '';
      switch (message.type) {
        case 'agent':
          icon = '[SYSTEM]';  // Meta messages about agent actions
          break;
        case 'assistant':
          icon = '[REPLOID]';  // Actual LLM responses
          break;
        case 'tool':
          icon = '[TOOL]';
          break;
        case 'tool_result':
          icon = '[RESULT]';
          break;
        case 'tool_error':
          icon = '[ERROR]';
          break;
        case 'thinking':
        case 'thinking_update':
          icon = '[THINKING]';
          break;
        case 'done':
          icon = '[DONE]';
          break;
        case 'system':
          icon = '[SYSTEM]';
          break;
        case 'error':
          icon = '[ERROR]';
          break;
        case 'context_injected':
        case 'context':
          icon = '[CONTEXT]';
          break;
        case 'preview':
          icon = '[PREVIEW]';
          break;
        case 'diff':
          icon = '[DIFF]';
          break;
        case 'approval':
          icon = '[APPROVAL]';
          break;
        default:
          icon = '';
      }

      // Determine if message should be collapsible (long content)
      // Don't collapse thinking messages or short system messages
      const contentLength = message.content.length;
      const isCollapsibleType = ['assistant', 'tool_result', 'context', 'preview'].includes(message.type);
      const shouldCollapse = isCollapsibleType && contentLength > 200; // Collapse if > 200 chars

      msgDiv.innerHTML = `
        <div class="message-icon">${icon}</div>
        <div class="message-content ${shouldCollapse ? 'collapsed' : ''}">${escapeHtml(message.content)}</div>
      `;

      // Add click handler for collapsible messages
      if (shouldCollapse) {
        const contentDiv = msgDiv.querySelector('.message-content');
        contentDiv.style.cursor = 'pointer';
        contentDiv.title = 'Click to expand/collapse';
        contentDiv.addEventListener('click', () => {
          contentDiv.classList.toggle('collapsed');
        });
      }

      messagesDiv.appendChild(msgDiv);

      // Auto-scroll to bottom with smooth behavior
      requestAnimationFrame(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });

      return msgDiv; // Return element for updates
    };

    // Escape HTML
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Show chat UI
    const show = () => {
      container.style.display = 'flex';
    };

    // Hide chat UI
    const hide = () => {
      container.style.display = 'none';
    };

    // Clear messages
    const clear = () => {
      messagesDiv.innerHTML = '';
    };

    return {
      show,
      hide,
      clear,
      addMessage
    };
  }
};

export default ChatUI;
