/**
 * Filesystem Widget Styles
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

  .filesystem-widget {
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
    background: var(--filesystem-header-bg, #f6f8fa);
  }

  .widget-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .icon-button {
    padding: 6px 10px;
    background: transparent;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-button:hover {
    background: var(--filesystem-hover-bg, #f3f4f6);
  }

  /* Breadcrumbs */
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
    background: var(--surface-color, #ffffff);
    border-bottom: 1px solid var(--border-color, #d0d7de);
    overflow-x: auto;
  }

  .breadcrumb {
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    color: var(--filesystem-primary, #0969da);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }

  .breadcrumb:hover {
    background: var(--filesystem-hover-bg, #f3f4f6);
  }

  .separator {
    color: var(--text-secondary, #57606a);
  }

  /* Browser View */
  .browser-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  /* File List */
  .file-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .file-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }

  .file-entry:hover {
    background: var(--filesystem-hover-bg, #f6f8fa);
  }

  .file-entry.selected {
    background: var(--filesystem-selected-bg, #ddf4ff);
  }

  .file-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .file-name {
    flex: 1;
    font-size: 14px;
    color: var(--text-color, #24292f);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-meta {
    font-size: 12px;
    color: var(--text-secondary, #57606a);
    flex-shrink: 0;
  }

  /* Editor View */
  .editor-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--filesystem-editor-toolbar, #f6f8fa);
    border-bottom: 1px solid var(--border-color, #d0d7de);
  }

  .toolbar-button {
    padding: 6px 12px;
    background: var(--surface-color, #ffffff);
    color: var(--text-color, #24292f);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toolbar-button:hover {
    background: var(--filesystem-hover-bg, #f3f4f6);
  }

  .toolbar-button.primary {
    background: var(--filesystem-primary, #0969da);
    color: #ffffff;
    border-color: var(--filesystem-primary, #0969da);
    font-weight: 500;
  }

  .toolbar-button.primary:hover {
    background: var(--filesystem-primary-dark, #0860ca);
  }

  .editor-title {
    flex: 1;
    font-size: 14px;
    font-family: ui-monospace, monospace;
    color: var(--text-secondary, #57606a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-content {
    flex: 1;
    padding: 16px;
    background: var(--filesystem-editor-bg, #ffffff);
    color: var(--text-color, #24292f);
    border: none;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    resize: none;
    outline: none;
    tab-size: 2;
  }

  .editor-content:focus {
    background: var(--surface-color, #ffffff);
  }

  /* Search View */
  .search-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .search-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--filesystem-search-toolbar, #f6f8fa);
    border-bottom: 1px solid var(--border-color, #d0d7de);
  }

  .search-input {
    flex: 1;
    padding: 8px 12px;
    background: var(--surface-color, #ffffff);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-size: 14px;
    font-family: ui-monospace, monospace;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--filesystem-primary, #0969da);
    box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.1);
  }

  .search-results {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .search-result {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .search-result:hover {
    background: var(--filesystem-hover-bg, #f6f8fa);
  }

  .result-path {
    font-size: 14px;
    font-family: ui-monospace, monospace;
    color: var(--text-color, #24292f);
  }

  .result-matches {
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
  }

  .error {
    color: var(--filesystem-danger, #cf222e);
  }

  .loading::after {
    content: '';
    width: 20px;
    height: 20px;
    margin-left: 8px;
    border: 2px solid var(--filesystem-primary, #0969da);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Scrollbar */
  .file-list::-webkit-scrollbar,
  .search-results::-webkit-scrollbar,
  .editor-content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .file-list::-webkit-scrollbar-track,
  .search-results::-webkit-scrollbar-track,
  .editor-content::-webkit-scrollbar-track {
    background: var(--surface-color, #ffffff);
  }

  .file-list::-webkit-scrollbar-thumb,
  .search-results::-webkit-scrollbar-thumb,
  .editor-content::-webkit-scrollbar-thumb {
    background: var(--border-color, #d0d7de);
    border-radius: 4px;
  }

  .file-list::-webkit-scrollbar-thumb:hover,
  .search-results::-webkit-scrollbar-thumb:hover,
  .editor-content::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary, #8b949e);
  }

  /* Accessibility */
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--filesystem-primary, #0969da);
    outline-offset: 2px;
  }

  /* Dark Mode */
  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #c9d1d9;
      --text-secondary: #8b949e;
      --surface-color: #0d1117;
      --border-color: #30363d;
      --filesystem-header-bg: #161b22;
      --filesystem-hover-bg: #161b22;
      --filesystem-selected-bg: #1f6feb;
      --filesystem-primary: #58a6ff;
      --filesystem-primary-dark: #4493e7;
      --filesystem-editor-bg: #0d1117;
      --filesystem-editor-toolbar: #161b22;
    }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .breadcrumbs {
      font-size: 12px;
    }

    .file-entry {
      padding: 8px;
    }

    .file-icon {
      font-size: 18px;
    }

    .editor-toolbar {
      flex-wrap: wrap;
    }
  }

  /* Print */
  @media print {
    .widget-header,
    .breadcrumbs,
    .editor-toolbar,
    .search-toolbar {
      display: none;
    }

    .editor-content {
      border: 1px solid #000;
    }
  }
`;
