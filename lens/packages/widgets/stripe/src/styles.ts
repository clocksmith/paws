export const styles = `
  :host {
    display: block;
    font-family: var(--mcp-font-family, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    color: var(--mcp-text-primary, #111827);
    background: var(--mcp-surface, #ffffff);
    border-radius: var(--mcp-radius-md, 8px);
    border: 1px solid var(--mcp-border, #e5e7eb);
    overflow: hidden;
  }

  .widget {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 420px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px 0 20px;
  }

  .header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .status {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(79, 70, 229, 0.12);
    color: #4338ca;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    padding: 0 20px;
  }

  .metric-tile {
    border: 1px solid var(--mcp-border, #e5e7eb);
    border-radius: var(--mcp-radius-md, 10px);
    padding: 12px;
    background: var(--mcp-background, #f9fafb);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metric-label {
    font-size: 12px;
    color: var(--mcp-text-secondary, #6b7280);
  }

  .metric-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--mcp-text-primary, #111827);
  }

  .segments {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    padding: 0 20px;
  }

  .segment-card {
    border: 1px solid var(--mcp-border, #e5e7eb);
    border-radius: var(--mcp-radius-md, 10px);
    padding: 14px;
    background: #ffffff;
    text-align: left;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .segment-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(79, 70, 229, 0.08);
  }

  .segment-card.active {
    border-color: #4338ca;
    box-shadow: 0 12px 24px rgba(79, 70, 229, 0.18);
    background: rgba(79, 70, 229, 0.06);
  }

  .segment-title {
    font-size: 15px;
    font-weight: 600;
    color: #4338ca;
  }

  .segment-description {
    font-size: 12px;
    color: var(--mcp-text-secondary, #6b7280);
  }

  .segment-panel {
    flex: 1;
    padding: 0 20px 20px 20px;
  }

  .toolbar {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }

  .toolbar input[type='search'],
  .toolbar select {
    padding: 8px 10px;
    border-radius: var(--mcp-radius-sm, 8px);
    border: 1px solid var(--mcp-border, #d1d5db);
    font-size: 13px;
  }

  .split-layout {
    display: grid;
    grid-template-columns: minmax(220px, 1.15fr) minmax(260px, 1fr);
    gap: 14px;
  }

  .split-left,
  .split-right {
    border: 1px solid var(--mcp-border, #e5e7eb);
    border-radius: var(--mcp-radius-md, 10px);
    background: #ffffff;
    padding: 12px;
    min-height: 260px;
    display: flex;
    flex-direction: column;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .data-table thead {
    background: rgba(79, 70, 229, 0.08);
  }

  .data-table th,
  .data-table td {
    padding: 8px 6px;
    border-bottom: 1px solid var(--mcp-border, #edf2f7);
    text-align: left;
  }

  .data-table tr {
    cursor: pointer;
  }

  .data-table tr:hover {
    background: rgba(79, 70, 229, 0.08);
  }

  .data-table tr.selected {
    background: rgba(79, 70, 229, 0.15);
  }

  .status-pill {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: rgba(79, 70, 229, 0.1);
    color: #4338ca;
  }

  .status-pill.status-failed {
    background: rgba(239, 68, 68, 0.12);
    color: #b91c1c;
  }

  .status-pill.status-pending {
    background: rgba(245, 158, 11, 0.12);
    color: #b45309;
  }

  .detail-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-card h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .meta-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px 12px;
  }

  .meta-label {
    display: block;
    font-size: 11px;
    color: var(--mcp-text-secondary, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .meta-value {
    font-size: 13px;
    font-weight: 500;
    color: var(--mcp-text-primary, #111827);
  }

  .timeline-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .timeline-item {
    border-left: 3px solid rgba(79, 70, 229, 0.4);
    padding: 0 0 0 12px;
    position: relative;
  }

  .timeline-item::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #4338ca;
  }

  .timeline-item.failed::before {
    background: #dc2626;
  }

  .timeline-item.pending::before {
    background: #f59e0b;
  }

  .timeline-badge {
    font-weight: 600;
    font-size: 13px;
  }

  .timeline-time {
    display: block;
    font-size: 11px;
    color: var(--mcp-text-secondary, #6b7280);
    margin-top: 2px;
  }

  .timeline-details {
    font-size: 12px;
    color: var(--mcp-text-secondary, #6b7280);
    margin-top: 4px;
  }

  .subscription-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .subscription-card {
    border: 1px solid var(--mcp-border, #e5e7eb);
    border-radius: var(--mcp-radius-md, 10px);
    padding: 12px;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .subscription-header {
    font-size: 14px;
    font-weight: 600;
    color: #4338ca;
  }

  .subscription-body .meta-label {
    font-weight: 500;
  }

  .detail-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .webhook-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .webhook-item {
    border: 1px solid var(--mcp-border, #e5e7eb);
    border-radius: var(--mcp-radius-md, 10px);
    padding: 12px;
    background: #ffffff;
  }

  .webhook-item.failed {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
  }

  .webhook-header {
    font-size: 13px;
    font-weight: 600;
  }

  .webhook-meta {
    font-size: 11px;
    color: var(--mcp-text-secondary, #6b7280);
    margin-top: 4px;
  }

  .webhook-preview {
    margin: 8px 0 0 0;
    background: #111827;
    color: #f9fafb;
    padding: 10px;
    border-radius: var(--mcp-radius-sm, 8px);
    font-size: 11px;
    overflow-x: auto;
  }

  .empty-state {
    border: 1px dashed var(--mcp-border, #d1d5db);
    border-radius: var(--mcp-radius-md, 10px);
    padding: 24px;
    text-align: center;
    font-size: 13px;
    color: var(--mcp-text-secondary, #6b7280);
    margin: auto;
    width: 100%;
  }

  .error {
    border: 1px solid rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.1);
    color: #991b1b;
    border-radius: var(--mcp-radius-md, 10px);
    padding: 16px;
    text-align: center;
  }

  .loading {
    padding: 24px;
    text-align: center;
    color: var(--mcp-text-secondary, #6b7280);
  }
`;
