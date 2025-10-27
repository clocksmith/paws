/**
 * Sequential Thinking Widget Styles
 *
 * CSS styles for the Sequential Thinking widget component.
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

  .thinking-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
  }

  /* Header */
  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
    background: var(--thinking-header-bg, #faf5ff);
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
    background: var(--thinking-button-bg, #8b5cf6);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  button:hover:not(:disabled),
  .icon-button:hover:not(:disabled) {
    background: var(--thinking-button-hover, #7c3aed);
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
  }

  /* New Session Form */
  .new-session-form {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  .new-session-form h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color, #24292f);
  }

  .prompt-input,
  .context-input {
    width: 100%;
    max-width: 600px;
    padding: 12px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    box-sizing: border-box;
  }

  .prompt-input:focus,
  .context-input:focus {
    outline: none;
    border-color: var(--thinking-primary, #8b5cf6);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  .context-input {
    min-height: 100px;
    resize: vertical;
  }

  .start-button {
    padding: 12px 24px;
    font-size: 15px;
    background: var(--thinking-primary, #8b5cf6);
  }

  .start-button:hover {
    background: var(--thinking-primary-hover, #7c3aed);
  }

  /* Session View */
  .session-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .session-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
    background: var(--thinking-session-bg, #fafafa);
  }

  .session-info {
    margin-bottom: 8px;
  }

  .session-prompt {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color, #24292f);
    margin-bottom: 4px;
  }

  .session-context {
    font-size: 13px;
    color: var(--text-secondary, #57606a);
    font-style: italic;
  }

  .session-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--text-secondary, #57606a);
  }

  .step-count,
  .total-duration {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Steps Container */
  .steps-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: var(--thinking-steps-bg, #fefefe);
  }

  .steps-container::-webkit-scrollbar {
    width: 8px;
  }

  .steps-container::-webkit-scrollbar-track {
    background: var(--thinking-scrollbar-track, #f1f1f1);
  }

  .steps-container::-webkit-scrollbar-thumb {
    background: var(--thinking-scrollbar-thumb, #888);
    border-radius: 4px;
  }

  .steps-container::-webkit-scrollbar-thumb:hover {
    background: var(--thinking-scrollbar-thumb-hover, #555);
  }

  /* Steps */
  .step {
    position: relative;
    padding: 16px;
    padding-left: 56px;
    margin-bottom: 16px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 8px;
    background: var(--surface-color, #ffffff);
    transition: all 0.2s;
  }

  .step:hover {
    border-color: var(--thinking-primary, #8b5cf6);
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.1);
  }

  .step-number {
    position: absolute;
    top: 16px;
    left: 16px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--thinking-step-number-bg, #f3f4f6);
    color: var(--thinking-step-number-color, #6b7280);
    border-radius: 50%;
    font-weight: 600;
    font-size: 13px;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .step-thought {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-color, #24292f);
  }

  .step-icon {
    flex-shrink: 0;
    font-size: 16px;
    margin-top: 2px;
  }

  .step-conclusion {
    padding: 12px;
    background: var(--thinking-conclusion-bg, #f0fdf4);
    border-left: 3px solid var(--thinking-conclusion-border, #10b981);
    border-radius: 4px;
    font-size: 13px;
    color: var(--thinking-conclusion-text, #065f46);
    font-weight: 500;
  }

  .step-duration {
    font-size: 11px;
    color: var(--text-secondary, #57606a);
    font-weight: 500;
  }

  /* Step Status */
  .step-in-progress {
    border-color: var(--thinking-inprogress, #f59e0b);
    background: var(--thinking-inprogress-bg, #fffbeb);
  }

  .step-in-progress .step-number {
    background: var(--thinking-inprogress, #f59e0b);
    color: #ffffff;
  }

  .step-completed {
    border-color: var(--thinking-completed-border, #d1fae5);
  }

  .step-completed .step-number {
    background: var(--thinking-completed, #10b981);
    color: #ffffff;
  }

  .step-error {
    border-color: var(--thinking-error, #ef4444);
    background: var(--thinking-error-bg, #fef2f2);
  }

  .step-error .step-number {
    background: var(--thinking-error, #ef4444);
    color: #ffffff;
  }

  /* Add Step Form */
  .add-step-form {
    padding: 16px;
    border-top: 1px solid var(--border-color, #d0d7de);
    background: var(--thinking-form-bg, #fafafa);
  }

  .step-input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    min-height: 80px;
    resize: vertical;
    box-sizing: border-box;
    margin-bottom: 8px;
  }

  .step-input:focus {
    outline: none;
    border-color: var(--thinking-primary, #8b5cf6);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  .step-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .conclusion-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    box-sizing: border-box;
  }

  .conclusion-input:focus {
    outline: none;
    border-color: var(--thinking-primary, #8b5cf6);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  .add-step-button {
    padding: 10px 20px;
    white-space: nowrap;
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
  }

  .error {
    color: var(--thinking-error, #ef4444);
  }

  .loading::after {
    content: '';
    width: 20px;
    height: 20px;
    margin-left: 8px;
    border: 2px solid var(--thinking-primary, #8b5cf6);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Accessibility */
  button:focus-visible,
  .icon-button:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--thinking-primary, #8b5cf6);
    outline-offset: 2px;
  }

  .step:focus-visible {
    outline: 2px solid var(--thinking-primary, #8b5cf6);
    outline-offset: 2px;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #c9d1d9;
      --text-secondary: #8b949e;
      --surface-color: #0d1117;
      --border-color: #30363d;
      --thinking-header-bg: #1c1321;
      --thinking-session-bg: #161b22;
      --thinking-steps-bg: #0d1117;
      --thinking-form-bg: #161b22;
      --thinking-primary: #a78bfa;
      --thinking-button-bg: #8b5cf6;
      --thinking-button-hover: #a78bfa;
      --thinking-step-number-bg: #21262d;
      --thinking-step-number-color: #8b949e;
      --thinking-conclusion-bg: #0d3d2c;
      --thinking-conclusion-border: #10b981;
      --thinking-conclusion-text: #6ee7b7;
      --thinking-inprogress: #f59e0b;
      --thinking-inprogress-bg: #2d1f0d;
      --thinking-completed: #10b981;
      --thinking-completed-border: #1e3a2c;
      --thinking-error: #ef4444;
      --thinking-error-bg: #2d1416;
      --thinking-scrollbar-track: #161b22;
      --thinking-scrollbar-thumb: #30363d;
      --thinking-scrollbar-thumb-hover: #484f58;
    }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .widget-header {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .header-actions {
      justify-content: flex-end;
    }

    .step {
      padding-left: 16px;
    }

    .step-number {
      position: static;
      margin-bottom: 8px;
    }

    .step-actions {
      flex-direction: column;
    }

    .conclusion-input {
      width: 100%;
    }
  }

  /* Print */
  @media print {
    .header-actions,
    .add-step-form {
      display: none;
    }

    .step {
      page-break-inside: avoid;
    }
  }
`;
