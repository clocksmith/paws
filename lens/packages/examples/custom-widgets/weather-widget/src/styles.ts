export const styles = `
  :host {
    display: block;
    font-family: var(--mcp-font-family, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.08));
    border-radius: var(--mcp-radius-lg, 16px);
    color: var(--mcp-text-primary, #0f172a);
    padding: 16px;
    box-sizing: border-box;
    min-width: 260px;
  }

  .widget {
    display: grid;
    gap: 16px;
  }

  .snapshot {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 12px;
    align-items: center;
    background: rgba(255, 255, 255, 0.92);
    border-radius: 14px;
    padding: 14px;
    box-shadow: 0 10px 24px rgba(15, 118, 110, 0.15);
  }

  .icon {
    font-size: 42px;
  }

  .temperature {
    font-size: 32px;
    font-weight: 700;
  }

  .meta {
    font-size: 13px;
    color: var(--mcp-text-secondary, #334155);
  }

  .forecast {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(86px, 1fr));
    gap: 10px;
  }

  .forecast-item {
    background: rgba(255, 255, 255, 0.85);
    border-radius: 12px;
    padding: 10px;
    text-align: center;
    font-size: 12px;
    color: var(--mcp-text-secondary, #334155);
  }

  .forecast-item strong {
    display: block;
    font-size: 14px;
    color: var(--mcp-text-primary, #0f172a);
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--mcp-text-secondary, #475569);
  }

  .unit-toggle {
    border: none;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 999px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 11px;
    color: #0369a1;
  }

  .unit-toggle.active {
    background: rgba(14, 165, 233, 0.2);
    color: #0ea5e9;
  }

  .error {
    background: rgba(239, 68, 68, 0.16);
    color: #b91c1c;
    padding: 12px;
    border-radius: 12px;
    font-size: 12px;
    text-align: center;
  }
`;
