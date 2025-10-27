/**
 * Playwright Widget Styles
 */

export const styles = `
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    color: var(--text-color, #24292f);
    background: var(--surface-color, #ffffff);
    border-radius: var(--border-radius, 6px);
    overflow: hidden;
  }

  .playwright-widget {
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
    background: var(--playwright-header-bg, #f6f8fa);
  }

  .widget-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--playwright-primary, #45ba4b);
  }

  /* View Tabs */
  .view-tabs {
    display: flex;
    gap: 4px;
  }

  .tab-button {
    padding: 8px 16px;
    background: transparent;
    color: var(--text-color, #24292f);
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .tab-button:hover {
    background: var(--playwright-hover-bg, #f3f4f6);
  }

  .tab-button.active {
    background: var(--playwright-primary, #45ba4b);
    color: #ffffff;
    font-weight: 500;
  }

  /* Browser View */
  .browser-view {
    padding: 16px;
  }

  .navigation-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--surface-color, #ffffff);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
  }

  .nav-button {
    padding: 8px 12px;
    background: var(--surface-color, #ffffff);
    color: var(--text-color, #24292f);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .nav-button:hover {
    background: var(--playwright-hover-bg, #f3f4f6);
  }

  .nav-button.primary {
    background: var(--playwright-primary, #45ba4b);
    color: #ffffff;
    border-color: var(--playwright-primary, #45ba4b);
    font-weight: 500;
  }

  .nav-button.primary:hover {
    background: var(--playwright-primary-dark, #2d7a31);
  }

  .url-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 4px;
    font-size: 14px;
    font-family: ui-monospace, monospace;
  }

  .url-input:focus {
    outline: none;
    border-color: var(--playwright-primary, #45ba4b);
    box-shadow: 0 0 0 3px rgba(69, 186, 75, 0.1);
  }

  /* Browser Info */
  .browser-info {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--surface-color, #ffffff);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
  }

  .info-item {
    display: flex;
    gap: 8px;
  }

  .info-item .label {
    font-weight: 600;
    color: var(--text-secondary, #57606a);
  }

  .info-item .value {
    font-family: ui-monospace, monospace;
    font-size: 13px;
  }

  .value.status-idle { color: var(--text-secondary, #57606a); }
  .value.status-navigating { color: var(--playwright-warning, #d29922); }
  .value.status-loading { color: var(--playwright-warning, #d29922); }
  .value.status-loaded { color: var(--playwright-success, #1a7f37); }
  .value.status-error { color: var(--playwright-danger, #cf222e); }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .action-button {
    padding: 10px 16px;
    background: var(--surface-color, #ffffff);
    color: var(--text-color, #24292f);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-button:hover {
    border-color: var(--playwright-primary, #45ba4b);
    background: var(--playwright-hover-bg, #f3f4f6);
  }

  .action-button:active {
    transform: scale(0.98);
  }

  /* Screenshots View */
  .screenshots-view {
    padding: 16px;
    overflow-y: auto;
  }

  .screenshots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }

  .screenshot-card {
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
  }

  .screenshot-card:hover {
    border-color: var(--playwright-primary, #45ba4b);
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .screenshot-preview {
    width: 100%;
    height: 150px;
    background: var(--playwright-screenshot-bg, #f6f8fa);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .screenshot-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .screenshot-info {
    padding: 12px;
    background: var(--surface-color, #ffffff);
  }

  .screenshot-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: var(--text-color, #24292f);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .screenshot-meta {
    font-size: 12px;
    color: var(--text-secondary, #57606a);
  }

  /* Console View */
  .console-view {
    padding: 16px;
    overflow-y: auto;
  }

  .console-messages {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 13px;
    background: var(--playwright-console-bg, #1e1e1e);
    color: var(--playwright-console-text, #d4d4d4);
    border-radius: 6px;
    padding: 12px;
    max-height: 500px;
    overflow-y: auto;
  }

  .console-message {
    display: flex;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .console-message:last-child {
    border-bottom: none;
  }

  .console-time {
    color: var(--text-secondary, #808080);
    flex-shrink: 0;
  }

  .console-level {
    flex-shrink: 0;
    font-weight: 600;
  }

  .console-log .console-level { color: var(--playwright-console-log, #4ec9b0); }
  .console-warn .console-level { color: var(--playwright-console-warn, #d7ba7d); }
  .console-error .console-level { color: var(--playwright-console-error, #f48771); }
  .console-info .console-level { color: var(--playwright-console-info, #9cdcfe); }
  .console-debug .console-level { color: var(--playwright-console-debug, #b5cea8); }

  .console-text {
    flex: 1;
    word-break: break-word;
  }

  /* Workflows View */
  .workflows-view {
    padding: 16px;
  }

  .create-button {
    margin-bottom: 16px;
    padding: 10px 20px;
    background: var(--playwright-primary, #45ba4b);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .create-button:hover {
    background: var(--playwright-primary-dark, #2d7a31);
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
    color: var(--playwright-danger, #cf222e);
  }

  .loading::after {
    content: '';
    width: 20px;
    height: 20px;
    margin-left: 8px;
    border: 2px solid var(--playwright-primary, #45ba4b);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Accessibility */
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--playwright-primary, #45ba4b);
    outline-offset: 2px;
  }

  /* Dark Mode */
  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #c9d1d9;
      --text-secondary: #8b949e;
      --surface-color: #0d1117;
      --border-color: #30363d;
      --playwright-header-bg: #161b22;
      --playwright-hover-bg: #161b22;
      --playwright-primary: #3fb950;
      --playwright-primary-dark: #2ea043;
      --playwright-screenshot-bg: #161b22;
      --playwright-console-bg: #0d1117;
      --playwright-console-text: #c9d1d9;
    }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .navigation-bar {
      flex-wrap: wrap;
    }

    .url-input {
      width: 100%;
      order: 3;
    }

    .screenshots-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Print */
  @media print {
    .widget-header,
    .navigation-bar,
    .action-buttons,
    .create-button {
      display: none;
    }
  }
`;
