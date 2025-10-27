export const styles = `
  :host {
    display: block;
    font-family: var(--mcp-font-family, 'JetBrains Mono', 'Fira Code', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    color: var(--mcp-text-primary, #0f172a);
    background: var(--mcp-surface, #ffffff);
    border-radius: var(--mcp-radius-md, 12px);
    border: 1px solid var(--mcp-border, #e2e8f0);
    overflow: hidden;
  }

  .widget {
    display: flex;
    flex-direction: column;
    min-height: 460px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px 12px;
  }

  .header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .status {
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.12);
    color: #047857;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .nav {
    display: flex;
    gap: 12px;
    padding: 0 24px 12px;
    border-bottom: 1px solid var(--mcp-border, #e2e8f0);
  }

  .nav-tab {
    border: none;
    background: none;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 8px;
    color: var(--mcp-text-secondary, #64748b);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .nav-tab:hover {
    background: rgba(16, 185, 129, 0.12);
    color: #047857;
  }

  .nav-tab.active {
    background: rgba(16, 185, 129, 0.16);
    color: #047857;
  }

  .body {
    flex: 1;
    padding: 16px 24px 24px;
    overflow-y: auto;
  }

  .schema-layout {
    display: grid;
    grid-template-columns: minmax(200px, 0.3fr) minmax(320px, 1fr);
    gap: 16px;
    height: 100%;
  }

  .schema-sidebar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: 1px solid var(--mcp-border, #e2e8f0);
    border-radius: 12px;
    padding: 12px;
    background: #fbfdff;
  }

  .schema-sidebar select,
  .schema-sidebar input[type='search'] {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--mcp-border, #d0d8e5);
    font-size: 13px;
  }

  .table-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 280px;
    overflow-y: auto;
  }

  .table-list li {
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--mcp-text-secondary, #64748b);
    transition: background 0.1s ease, color 0.1s ease;
  }

  .table-list li:hover {
    background: rgba(59, 130, 246, 0.14);
    color: #1d4ed8;
  }

  .table-list li.active {
    background: rgba(16, 185, 129, 0.2);
    color: #047857;
  }

  .schema-detail {
    border: 1px solid var(--mcp-border, #e2e8f0);
    border-radius: 12px;
    padding: 16px;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .table-header h3 {
    margin: 0;
    font-size: 18px;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .data-table thead {
    background: rgba(15, 118, 110, 0.08);
    text-align: left;
  }

  .data-table th,
  .data-table td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--mcp-border, #e2e8f0);
  }

  .data-table.editable td[data-column] {
    cursor: text;
    background: rgba(15, 118, 110, 0.04);
  }

  .save-button {
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid rgba(15, 118, 110, 0.4);
    background: rgba(16, 185, 129, 0.2);
    cursor: pointer;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .save-button:hover {
    background: rgba(16, 185, 129, 0.3);
  }

  .policy-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .policy-card {
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 10px;
    padding: 10px;
    background: rgba(59, 130, 246, 0.06);
    font-size: 12px;
  }

  .policy-name {
    font-weight: 600;
    margin-bottom: 6px;
    color: #1d4ed8;
  }

  .table-rows {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sql-editor {
    display: grid;
    grid-template-columns: minmax(260px, 0.6fr) minmax(260px, 1fr);
    gap: 12px;
  }

  textarea {
    width: 100%;
    min-height: 160px;
    border-radius: 10px;
    border: 1px solid var(--mcp-border, #d0d8e5);
    padding: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    background: #0f172a;
    color: #e2e8f0;
  }

  .sql-preview {
    margin: 0;
    border-radius: 10px;
    background: #0f172a;
    color: #e2e8f0;
    padding: 12px;
    font-size: 12px;
    overflow: auto;
  }

  .query-actions {
    margin-top: 12px;
    display: flex;
    gap: 10px;
  }

  .query-actions button {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(37, 99, 235, 0.3);
    background: rgba(59, 130, 246, 0.18);
    color: #1d4ed8;
    font-weight: 600;
    cursor: pointer;
  }

  .query-result {
    margin-top: 16px;
    border: 1px solid var(--mcp-border, #e2e8f0);
    border-radius: 12px;
    padding: 12px;
    background: #ffffff;
  }

  .query-meta {
    font-size: 11px;
    color: var(--mcp-text-secondary, #64748b);
    margin-bottom: 8px;
  }

  .realtime-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: 1px solid var(--mcp-border, #e2e8f0);
    border-radius: 12px;
    padding: 12px;
    background: #ffffff;
  }

  .realtime-actions {
    display: flex;
    justify-content: flex-start;
  }

  .realtime-actions button {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.14);
    color: #b45309;
    cursor: pointer;
  }

  .realtime-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 320px;
    overflow-y: auto;
  }

  .realtime-list li {
    border: 1px solid var(--mcp-border, #e2e8f0);
    border-radius: 10px;
    padding: 10px;
    background: rgba(30, 64, 175, 0.04);
    font-size: 12px;
  }

  .realtime-type {
    font-weight: 600;
    margin-right: 6px;
    color: #1d4ed8;
  }

  .realtime-table {
    color: #0f172a;
    margin-right: 6px;
  }

  .realtime-time {
    color: var(--mcp-text-secondary, #64748b);
  }

  .realtime-list pre {
    margin: 8px 0 0 0;
    background: #0f172a;
    color: #e2e8f0;
    padding: 10px;
    border-radius: 8px;
    overflow-x: auto;
  }

  .metrics-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .metric-card {
    border: 1px solid var(--mcp-border, #e2e8f0);
    border-radius: 12px;
    padding: 12px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metric-label {
    font-size: 11px;
    color: var(--mcp-text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .metric-value {
    font-size: 20px;
    font-weight: 600;
  }

  .overview {
    border: 1px solid var(--mcp-border, #e2e8f0);
    border-radius: 12px;
    padding: 16px;
    background: #ffffff;
  }

  .overview-summary p {
    margin: 6px 0;
    font-size: 13px;
  }

  .message {
    border-radius: 10px;
    padding: 16px;
    text-align: center;
    font-size: 13px;
  }

  .message.loading {
    background: rgba(59, 130, 246, 0.14);
    color: #1d4ed8;
  }

  .message.error {
    background: rgba(239, 68, 68, 0.14);
    color: #b91c1c;
  }

  .message.empty {
    background: rgba(148, 163, 184, 0.12);
    color: #475569;
  }
`;
