/**
 * Brave Search Widget Styles
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

  .brave-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
  }

  /* Header */
  .widget-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
    background: var(--brave-header-bg, #f6f8fa);
  }

  .widget-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--brave-primary, #fb542b);
  }

  /* Search Bar */
  .search-bar {
    display: flex;
    gap: 8px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
  }

  .search-input {
    flex: 1;
    padding: 12px 16px;
    background: var(--surface-color, #ffffff);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 24px;
    font-size: 15px;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--brave-primary, #fb542b);
    box-shadow: 0 0 0 3px rgba(251, 84, 43, 0.1);
  }

  .search-button {
    padding: 12px 24px;
    background: var(--brave-primary, #fb542b);
    color: #ffffff;
    border: none;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .search-button:hover {
    background: var(--brave-primary-dark, #e84a26);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(251, 84, 43, 0.3);
  }

  .search-button:active {
    transform: translateY(0);
  }

  /* Filters */
  .filters {
    display: flex;
    gap: 16px;
    padding: 12px 16px;
    background: var(--surface-color, #ffffff);
    border-bottom: 1px solid var(--border-color, #d0d7de);
    overflow-x: auto;
  }

  .filter-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .filter-button {
    padding: 6px 16px;
    background: transparent;
    color: var(--text-secondary, #57606a);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 16px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .filter-button:hover {
    background: var(--brave-hover-bg, #f6f8fa);
  }

  .filter-button.active {
    background: var(--brave-primary, #fb542b);
    color: #ffffff;
    border-color: var(--brave-primary, #fb542b);
    font-weight: 600;
  }

  .filter-select {
    padding: 6px 12px;
    background: var(--surface-color, #ffffff);
    color: var(--text-color, #24292f);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 16px;
    font-size: 13px;
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--brave-primary, #fb542b);
  }

  /* Results */
  .results {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .results-info {
    margin-bottom: 16px;
    font-size: 13px;
    color: var(--text-secondary, #57606a);
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .result-item {
    display: flex;
    gap: 12px;
    padding: 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .result-item:hover {
    background: var(--brave-result-hover, #f6f8fa);
  }

  .result-position {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary, #57606a);
  }

  .result-content {
    flex: 1;
    min-width: 0;
  }

  .result-title {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 500;
    color: var(--brave-result-title, #1a0dab);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-title:hover {
    text-decoration: underline;
  }

  .result-url {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--brave-result-url, #006621);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-snippet {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--brave-result-snippet, #545454);
  }

  .highlight {
    background: var(--brave-highlight, #ffeb3b);
    font-weight: 600;
    padding: 0 2px;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 24px 16px 16px;
    border-top: 1px solid var(--border-color, #d0d7de);
    margin-top: 16px;
  }

  .pagination-button {
    padding: 8px 16px;
    background: var(--surface-color, #ffffff);
    color: var(--text-color, #24292f);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pagination-button:hover:not(:disabled) {
    background: var(--brave-hover-bg, #f6f8fa);
    border-color: var(--brave-primary, #fb542b);
  }

  .pagination-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-info {
    font-size: 14px;
    color: var(--text-secondary, #57606a);
  }

  /* History */
  .history {
    padding: 16px;
  }

  .history-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary, #57606a);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .history-item:hover {
    background: var(--brave-hover-bg, #f6f8fa);
  }

  .history-query {
    font-size: 14px;
    color: var(--text-color, #24292f);
  }

  .history-meta {
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
    font-size: 15px;
  }

  .error {
    color: var(--brave-danger, #cf222e);
  }

  .loading::after {
    content: '';
    width: 20px;
    height: 20px;
    margin-left: 8px;
    border: 2px solid var(--brave-primary, #fb542b);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Scrollbar */
  .results::-webkit-scrollbar {
    width: 8px;
  }

  .results::-webkit-scrollbar-track {
    background: var(--surface-color, #ffffff);
  }

  .results::-webkit-scrollbar-thumb {
    background: var(--border-color, #d0d7de);
    border-radius: 4px;
  }

  .results::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary, #8b949e);
  }

  /* Accessibility */
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--brave-primary, #fb542b);
    outline-offset: 2px;
  }

  /* Dark Mode */
  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #c9d1d9;
      --text-secondary: #8b949e;
      --surface-color: #0d1117;
      --border-color: #30363d;
      --brave-header-bg: #161b22;
      --brave-hover-bg: #161b22;
      --brave-result-hover: #161b22;
      --brave-result-title: #58a6ff;
      --brave-result-url: #3fb950;
      --brave-result-snippet: #c9d1d9;
      --brave-highlight: #9e6a03;
    }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .search-bar {
      flex-direction: column;
    }

    .search-button {
      width: 100%;
    }

    .filters {
      flex-wrap: wrap;
    }

    .result-title {
      font-size: 16px;
    }

    .pagination {
      flex-direction: column;
      gap: 8px;
    }

    .pagination-button {
      width: 100%;
    }
  }

  /* Print */
  @media print {
    .widget-header,
    .search-bar,
    .filters,
    .pagination {
      display: none;
    }

    .result-item {
      break-inside: avoid;
    }
  }
`;
