/**
 * Memory Widget Styles
 *
 * CSS styles for the Memory widget component.
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

  .memory-widget {
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
    background: var(--memory-header-bg, #f0f9ff);
    gap: 12px;
  }

  .widget-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color, #24292f);
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex: 1;
    max-width: 800px;
  }

  .search-input {
    flex: 1;
    max-width: 300px;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--memory-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* Buttons */
  button, .icon-button {
    padding: 8px 16px;
    background: var(--memory-button-bg, #3b82f6);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  button:hover,
  .icon-button:hover {
    background: var(--memory-button-hover, #2563eb);
  }

  button:active {
    transform: scale(0.98);
  }

  .icon-button {
    padding: 6px 12px;
    font-size: 13px;
  }

  .back-button {
    background: transparent;
    color: var(--memory-primary, #3b82f6);
    border: none;
    padding: 8px 0;
    margin-bottom: 16px;
  }

  .back-button:hover {
    text-decoration: underline;
    background: transparent;
  }

  .danger-button {
    background: var(--memory-danger, #ef4444);
  }

  .danger-button:hover {
    background: var(--memory-danger-hover, #dc2626);
  }

  /* List View */
  .list-view {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .entity-group {
    margin-bottom: 24px;
  }

  .group-header {
    margin: 0 0 12px 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color, #24292f);
    padding-bottom: 8px;
    border-bottom: 2px solid var(--border-color, #d0d7de);
  }

  .entity-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
  }

  /* Entity Card */
  .entity-card {
    padding: 16px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 8px;
    background: var(--surface-color, #ffffff);
    cursor: pointer;
    transition: all 0.2s;
  }

  .entity-card:hover {
    border-color: var(--memory-primary, #3b82f6);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    transform: translateY(-2px);
  }

  .entity-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .entity-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 20px;
    flex-shrink: 0;
  }

  .entity-title h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color, #24292f);
  }

  .entity-type {
    display: inline-block;
    margin-top: 2px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary, #57606a);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .entity-observations {
    margin-top: 12px;
  }

  .observation {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary, #57606a);
    margin-bottom: 4px;
  }

  .observation-more {
    font-size: 12px;
    color: var(--memory-primary, #3b82f6);
    font-weight: 500;
    margin-top: 4px;
  }

  /* Graph View */
  .graph-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .graph-canvas {
    flex: 1;
    overflow: hidden;
    background: var(--memory-graph-bg, #fafbfc);
    position: relative;
  }

  .graph-canvas svg {
    display: block;
  }

  .graph-node {
    cursor: pointer;
    transition: all 0.2s;
  }

  .graph-node:hover circle {
    stroke-width: 3;
    filter: brightness(1.1);
  }

  .graph-stats {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #d0d7de);
    background: var(--memory-stats-bg, #f6f8fa);
    font-size: 13px;
    color: var(--text-secondary, #57606a);
    text-align: center;
  }

  /* Entity Details */
  .entity-details {
    padding: 16px;
    overflow-y: auto;
  }

  .entity-detail-header {
    padding: 16px;
    padding-left: 20px;
    margin-bottom: 24px;
    border-radius: 8px;
    background: var(--memory-detail-header-bg, #f9fafb);
  }

  .entity-detail-header h3 {
    margin: 0 0 4px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color, #24292f);
  }

  .detail-section {
    margin-bottom: 24px;
  }

  .detail-section h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color, #24292f);
  }

  .observations-list {
    background: var(--memory-observations-bg, #f9fafb);
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    padding: 12px;
  }

  .observations-list .observation {
    padding: 6px 0;
  }

  .relations-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relation {
    padding: 12px;
    background: var(--memory-relation-bg, #f0f9ff);
    border: 1px solid var(--memory-relation-border, #bfdbfe);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-color, #24292f);
  }

  .relation-type {
    display: inline-block;
    padding: 2px 8px;
    background: var(--memory-primary, #3b82f6);
    color: #ffffff;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    margin: 0 4px;
  }

  .detail-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--border-color, #d0d7de);
  }

  /* Search Results */
  .search-results {
    padding: 16px;
    overflow-y: auto;
  }

  .search-results h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color, #24292f);
  }

  .results-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
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
    min-height: 300px;
  }

  .error {
    color: var(--memory-danger, #ef4444);
  }

  .loading::after {
    content: '';
    width: 20px;
    height: 20px;
    margin-left: 8px;
    border: 2px solid var(--memory-primary, #3b82f6);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Scrollbar */
  .list-view::-webkit-scrollbar,
  .entity-details::-webkit-scrollbar,
  .search-results::-webkit-scrollbar {
    width: 8px;
  }

  .list-view::-webkit-scrollbar-track,
  .entity-details::-webkit-scrollbar-track,
  .search-results::-webkit-scrollbar-track {
    background: var(--memory-scrollbar-track, #f1f1f1);
  }

  .list-view::-webkit-scrollbar-thumb,
  .entity-details::-webkit-scrollbar-thumb,
  .search-results::-webkit-scrollbar-thumb {
    background: var(--memory-scrollbar-thumb, #888);
    border-radius: 4px;
  }

  .list-view::-webkit-scrollbar-thumb:hover,
  .entity-details::-webkit-scrollbar-thumb:hover,
  .search-results::-webkit-scrollbar-thumb:hover {
    background: var(--memory-scrollbar-thumb-hover, #555);
  }

  /* Accessibility */
  button:focus-visible,
  .icon-button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--memory-primary, #3b82f6);
    outline-offset: 2px;
  }

  .entity-card:focus-visible {
    outline: 2px solid var(--memory-primary, #3b82f6);
    outline-offset: 2px;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #c9d1d9;
      --text-secondary: #8b949e;
      --surface-color: #0d1117;
      --border-color: #30363d;
      --memory-header-bg: #0c1219;
      --memory-button-bg: #3b82f6;
      --memory-button-hover: #60a5fa;
      --memory-primary: #60a5fa;
      --memory-danger: #ef4444;
      --memory-danger-hover: #f87171;
      --memory-graph-bg: #0d1117;
      --memory-stats-bg: #161b22;
      --memory-detail-header-bg: #161b22;
      --memory-observations-bg: #161b22;
      --memory-relation-bg: #0c1d2d;
      --memory-relation-border: #1e3a5f;
      --memory-scrollbar-track: #161b22;
      --memory-scrollbar-thumb: #30363d;
      --memory-scrollbar-thumb-hover: #484f58;
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .widget-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .header-actions {
      flex-direction: column;
      max-width: none;
    }

    .search-input {
      max-width: none;
      width: 100%;
    }

    .entity-list,
    .results-list {
      grid-template-columns: 1fr;
    }

    .detail-actions {
      flex-direction: column;
    }
  }

  /* Print */
  @media print {
    .widget-header button,
    .back-button,
    .detail-actions {
      display: none;
    }

    .entity-card {
      page-break-inside: avoid;
    }
  }
`;
