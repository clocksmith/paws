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
          return lastThinkingMessage;
        }
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
