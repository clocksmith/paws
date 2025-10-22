/**
 * Fetch Widget Styles
 *
 * CSS styles for the Fetch widget component.
 */

export const styles = `
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px;
    color: var(--text-color, #24292f);
    background: var(--surface-color, #ffffff);
    border-radius: var(--border-radius, 6px);
    overflow: hidden;
  }

  .fetch-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 500px;
  }

  /* Header */
  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
    background: var(--fetch-header-bg, #ecfdf5);
  }

  .widget-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color, #24292f);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  /* Buttons */
  button, .icon-button {
    padding: 8px 16px;
    background: var(--fetch-button-bg, #10b981);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  button:hover:not(:disabled),
  .icon-button:hover:not(:disabled) {
    background: var(--fetch-button-hover, #059669);
  }

  button:active {
    transform: scale(0.98);
  }

  button:disabled,
  .icon-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-button {
    padding: 6px 12px;
    font-size: 13px;
    background: transparent;
    color: var(--text-secondary, #57606a);
    border: 1px solid var(--border-color, #d0d7de);
  }

  .icon-button:hover:not(:disabled) {
    background: var(--fetch-hover-bg, #f3f4f6);
    color: var(--text-color, #24292f);
  }

  .icon-button.active {
    background: var(--fetch-primary, #10b981);
    color: #ffffff;
    border-color: var(--fetch-primary, #10b981);
  }

  /* Fetch View */
  .fetch-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .fetch-form {
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
    background: var(--fetch-form-bg, #fafafa);
  }

  .url-input-group {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .url-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
  }

  .url-input:focus {
    outline: none;
    border-color: var(--fetch-primary, #10b981);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .fetch-button {
    padding: 10px 24px;
    white-space: nowrap;
  }

  .fetch-options {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary, #57606a);
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }

  .selector-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 13px;
  }

  .selector-input:focus {
    outline: none;
    border-color: var(--fetch-primary, #10b981);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  /* Result View */
  .result-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .result-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
    background: var(--fetch-result-header-bg, #f9fafb);
  }

  .result-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .result-url {
    font-size: 14px;
    font-weight: 600;
    color: var(--fetch-primary, #10b981);
    word-break: break-all;
  }

  .result-info {
    font-size: 12px;
    color: var(--text-secondary, #57606a);
  }

  .result-actions {
    display: flex;
    gap: 8px;
  }

  /* Content Display */
  .content-display {
    flex: 1;
    overflow: auto;
    padding: 16px;
    background: var(--fetch-content-bg, #ffffff);
  }

  .content-display pre {
    margin: 0;
    padding: 16px;
    background: var(--fetch-code-bg, #1f2937);
    border-radius: 6px;
    overflow-x: auto;
  }

  .content-display code {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    color: var(--fetch-code-text, #f3f4f6);
  }

  .content-display.wrap code {
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* History View */
  .history-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
  }

  .history-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color, #24292f);
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .history-item {
    padding: 16px;
    margin-bottom: 12px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 8px;
    background: var(--surface-color, #ffffff);
    cursor: pointer;
    transition: all 0.2s;
  }

  .history-item:hover {
    border-color: var(--fetch-primary, #10b981);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
    transform: translateY(-1px);
  }

  .history-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .history-url {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color, #24292f);
    word-break: break-all;
  }

  .history-time {
    font-size: 12px;
    color: var(--text-secondary, #57606a);
    white-space: nowrap;
    margin-left: 12px;
  }

  .history-item-meta {
    font-size: 12px;
    color: var(--text-secondary, #57606a);
  }

  /* States */
  .loading,
  .error,
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
    color: var(--text-secondary, #57606a);
    min-height: 200px;
  }

  .error {
    color: var(--fetch-danger, #ef4444);
  }

  .loading::after {
    content: '';
    width: 20px;
    height: 20px;
    margin-left: 8px;
    border: 2px solid var(--fetch-primary, #10b981);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Scrollbar */
  .content-display::-webkit-scrollbar,
  .history-list::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .content-display::-webkit-scrollbar-track,
  .history-list::-webkit-scrollbar-track {
    background: var(--fetch-scrollbar-track, #f1f1f1);
  }

  .content-display::-webkit-scrollbar-thumb,
  .history-list::-webkit-scrollbar-thumb {
    background: var(--fetch-scrollbar-thumb, #888);
    border-radius: 4px;
  }

  .content-display::-webkit-scrollbar-thumb:hover,
  .history-list::-webkit-scrollbar-thumb:hover {
    background: var(--fetch-scrollbar-thumb-hover, #555);
  }

  /* Accessibility */
  button:focus-visible,
  .icon-button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--fetch-primary, #10b981);
    outline-offset: 2px;
  }

  .history-item:focus-visible {
    outline: 2px solid var(--fetch-primary, #10b981);
    outline-offset: 2px;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #c9d1d9;
      --text-secondary: #8b949e;
      --surface-color: #0d1117;
      --border-color: #30363d;
      --fetch-header-bg: #0c1a13;
      --fetch-form-bg: #161b22;
      --fetch-button-bg: #10b981;
      --fetch-button-hover: #059669;
      --fetch-primary: #10b981;
      --fetch-hover-bg: #161b22;
      --fetch-result-header-bg: #161b22;
      --fetch-content-bg: #0d1117;
      --fetch-code-bg: #1f2937;
      --fetch-code-text: #f3f4f6;
      --fetch-danger: #ef4444;
      --fetch-scrollbar-track: #161b22;
      --fetch-scrollbar-thumb: #30363d;
      --fetch-scrollbar-thumb-hover: #484f58;
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .widget-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .url-input-group {
      flex-direction: column;
    }

    .fetch-options {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .result-actions {
      flex-direction: column;
    }

    .history-item-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .history-time {
      margin-left: 0;
    }
  }

  /* Print */
  @media print {
    .widget-header button,
    .fetch-form,
    .result-actions {
      display: none;
    }

    .content-display pre {
      background: transparent;
      border: 1px solid #000;
    }

    .content-display code {
      color: #000;
    }
  }
`;
