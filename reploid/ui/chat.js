// Simple Chat UI for REPLOID Agent

const ChatUI = {
  init: (agentLoop) => {
    const container = document.getElementById('chat-container');
    const messagesDiv = document.getElementById('chat-messages');
    const inputDiv = document.getElementById('chat-input-area');
    const stopBtn = document.getElementById('stop-btn');
    const pauseBtn = document.getElementById('pause-btn');

    // Setup message callback
    agentLoop.setMessageCallback((message) => {
      addMessage(message);
    });

    // Stop button
    stopBtn.addEventListener('click', () => {
      agentLoop.stop();
      addMessage({ type: 'system', content: 'Agent stopped by user' });
      inputDiv.style.display = 'block';
    });

    // Pause button (placeholder for future)
    pauseBtn.addEventListener('click', () => {
      agentLoop.pause();
      addMessage({ type: 'system', content: 'Agent paused' });
    });

    // Add message to chat
    const addMessage = (message) => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-message ${message.type}`;

      let icon = '';
      switch (message.type) {
        case 'agent':
          icon = '[REPLOID]';
          break;
        case 'assistant':
          icon = '[ASSISTANT]';
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
        default:
          icon = '';
      }

      msgDiv.innerHTML = `
        <div class="message-icon">${icon}</div>
        <div class="message-content">${escapeHtml(message.content)}</div>
      `;

      messagesDiv.appendChild(msgDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
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
