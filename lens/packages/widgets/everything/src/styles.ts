export const styles = `
  :host {
    display: block;
    font-family: var(--mcp-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    color: var(--mcp-text-primary, #1f2933);
    background: var(--mcp-surface, #ffffff);
    border-radius: var(--mcp-radius-md, 8px);
    border: 1px solid var(--mcp-border, #d0d7de);
    overflow: hidden;
  }

  .widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 320px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--mcp-spacing-md, 12px) var(--mcp-spacing-lg, 16px);
    background: var(--mcp-surface, #ffffff);
    border-bottom: 1px solid var(--mcp-border, #d0d7de);
  }

  .header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: inherit;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--mcp-success-light, #d1fae5);
    color: var(--mcp-success-medium, #10b981);
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--mcp-spacing-md, 12px);
    padding: var(--mcp-spacing-lg, 16px);
  }

  .stat-card {
    border: 1px solid var(--mcp-border, #d0d7de);
    border-radius: var(--mcp-radius-md, 8px);
    padding: 12px;
    background: var(--mcp-background, #f8fafc);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
  }

  .stat-label {
    font-size: 12px;
    color: var(--mcp-text-secondary, #52606d);
  }

  .tabs {
    display: flex;
    gap: 8px;
    padding: 0 var(--mcp-spacing-lg, 16px);
  }

  .tab {
    border: none;
    background: transparent;
    padding: 8px 12px;
    border-radius: var(--mcp-radius-sm, 6px);
    cursor: pointer;
    font-size: 13px;
    color: var(--mcp-text-secondary, #52606d);
    transition: background 0.2s ease;
  }

  .tab.active {
    background: var(--mcp-primary-color, #2563eb);
    color: #ffffff;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: var(--mcp-spacing-lg, 16px);
    display: grid;
    gap: 12px;
  }

  .empty-state {
    padding: 24px;
    text-align: center;
    color: var(--mcp-text-secondary, #52606d);
    border: 1px dashed var(--mcp-border, #d0d7de);
    border-radius: var(--mcp-radius-md, 8px);
  }

  .item {
    border: 1px solid var(--mcp-border, #d0d7de);
    border-radius: var(--mcp-radius-md, 8px);
    padding: 12px;
    background: var(--mcp-surface, #ffffff);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .item-title {
    font-weight: 600;
  }

  .item-description {
    font-size: 13px;
    color: var(--mcp-text-secondary, #52606d);
  }

  .item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
    color: var(--mcp-text-secondary, #52606d);
  }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--mcp-accent-1, rgba(37, 99, 235, 0.15));
    color: var(--mcp-primary-color, #2563eb);
    font-weight: 500;
  }

  .error {
    padding: 12px;
    border-radius: var(--mcp-radius-md, 8px);
    border: 1px solid var(--mcp-error-medium, #ef4444);
    background: var(--mcp-error-light, #fee2e2);
    color: var(--mcp-error-dark, #991b1b);
  }

  .loading {
    padding: 24px;
    text-align: center;
    color: var(--mcp-text-secondary, #52606d);
  }

  .search-panel {
    display: flex;
    flex-direction: column;
    gap: var(--mcp-spacing-md, 12px);
  }

  .search-controls {
    display: flex;
    flex-direction: column;
    gap: var(--mcp-spacing-md, 12px);
    padding: var(--mcp-spacing-md, 12px);
    border: 1px solid var(--mcp-border, #d0d7de);
    border-radius: var(--mcp-radius-md, 8px);
    background: var(--mcp-background, #f8fafc);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .control-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--mcp-text-secondary, #52606d);
  }

  .control-group input[type='search'] {
    padding: 8px 10px;
    border-radius: var(--mcp-radius-sm, 6px);
    border: 1px solid var(--mcp-border, #d0d7de);
    font-size: 14px;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--mcp-spacing-sm, 8px);
  }

  .filter-control {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--mcp-text-secondary, #52606d);
  }

  .filter-control input[type='text'] {
    padding: 6px 8px;
    border-radius: var(--mcp-radius-sm, 6px);
    border: 1px solid var(--mcp-border, #d0d7de);
    font-size: 13px;
    min-width: 180px;
  }

  .filter-control.toggle {
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }

  .search-actions {
    display: flex;
    gap: 8px;
  }

  .search-actions button {
    padding: 8px 12px;
    border-radius: var(--mcp-radius-sm, 6px);
    border: 1px solid var(--mcp-border, #d0d7de);
    background: var(--mcp-surface, #ffffff);
    cursor: pointer;
    font-size: 13px;
  }

  .search-actions .primary {
    background: var(--mcp-primary-color, #2563eb);
    color: #ffffff;
    border-color: var(--mcp-primary-color, #2563eb);
  }

  .search-results-container {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) minmax(320px, 2fr);
    gap: var(--mcp-spacing-md, 12px);
  }

  .search-results {
    border: 1px solid var(--mcp-border, #d0d7de);
    border-radius: var(--mcp-radius-md, 8px);
    background: var(--mcp-surface, #ffffff);
    display: flex;
    flex-direction: column;
    min-height: 240px;
  }

  .results-header {
    font-weight: 600;
    padding: 10px 12px;
    border-bottom: 1px solid var(--mcp-border, #d0d7de);
    background: var(--mcp-background, #f8fafc);
  }

  .search-result-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
  }

  .search-result-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--mcp-border, #edf1f5);
    transition: background 0.15s ease;
  }

  .search-result-item:hover {
    background: rgba(37, 99, 235, 0.06);
  }

  .search-result-item.selected {
    background: rgba(37, 99, 235, 0.12);
  }

  .result-icon {
    font-size: 18px;
    line-height: 24px;
  }

  .result-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-title {
    font-weight: 600;
    font-size: 14px;
  }

  .result-path {
    font-size: 12px;
    color: var(--mcp-text-secondary, #52606d);
    word-break: break-all;
  }

  .result-snippet {
    font-size: 12px;
    color: var(--mcp-text-secondary, #52606d);
  }

  .result-score {
    font-size: 12px;
    color: var(--mcp-text-secondary, #52606d);
  }

  .preview-panel {
    border: 1px solid var(--mcp-border, #d0d7de);
    border-radius: var(--mcp-radius-md, 8px);
    background: var(--mcp-surface, #ffffff);
    display: flex;
    flex-direction: column;
    min-height: 240px;
  }

  .preview-header {
    font-weight: 600;
    padding: 10px 12px;
    border-bottom: 1px solid var(--mcp-border, #d0d7de);
    background: var(--mcp-background, #f8fafc);
  }

  .preview-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .preview-metadata {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 12px;
    row-gap: 6px;
    font-size: 12px;
  }

  .preview-metadata dt {
    font-weight: 600;
    color: var(--mcp-text-secondary, #52606d);
  }

  .preview-metadata dd {
    margin: 0;
  }

  .snippet-line {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .snippet-line-number {
    color: var(--mcp-text-secondary, #9aa5b1);
    font-size: 11px;
    width: 32px;
    text-align: right;
    flex-shrink: 0;
  }

  .snippet-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .snippet-highlight {
    background: rgba(37, 99, 235, 0.25);
    color: var(--mcp-primary-color, #1d4ed8);
    padding: 0 2px;
    border-radius: 3px;
  }

  .preview-snippet,
  .preview-raw {
    margin: 0;
    background: #0f172a;
    color: #e2e8f0;
    border-radius: var(--mcp-radius-sm, 6px);
    padding: 12px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
  }

  .preview-raw {
    background: #111827;
  }
`;
