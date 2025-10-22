/**
 * GitHub Widget Styles
 *
 * CSS styles for the GitHub widget component.
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

  .github-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 300px;
  }

  /* Header */
  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
    background: var(--github-header-bg, #f6f8fa);
  }

  .widget-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color, #24292f);
  }

  /* Buttons */
  button {
    padding: 8px 16px;
    background: var(--github-button-bg, #0969da);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover {
    background: var(--github-button-hover, #0860ca);
  }

  button:active {
    transform: scale(0.98);
  }

  .refresh-button {
    background: transparent;
    color: var(--text-color, #24292f);
    border: 1px solid var(--border-color, #d0d7de);
  }

  .refresh-button:hover {
    background: var(--github-hover-bg, #f3f4f6);
  }

  .back-button {
    background: transparent;
    color: var(--github-primary, #0969da);
    border: none;
    padding: 8px 0;
    margin-bottom: 16px;
  }

  .back-button:hover {
    text-decoration: underline;
  }

  .create-button {
    background: var(--github-success, #1a7f37);
    margin-bottom: 16px;
  }

  .create-button:hover {
    background: var(--github-success-hover, #1a7f37dd);
  }

  /* Repository List */
  .repo-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
  }

  .repo-card {
    padding: 16px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    background: var(--surface-color, #ffffff);
    cursor: pointer;
    transition: all 0.2s;
  }

  .repo-card:hover {
    border-color: var(--github-primary, #0969da);
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .repo-card h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--github-primary, #0969da);
  }

  .repo-card p {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: var(--text-secondary, #57606a);
    line-height: 1.5;
  }

  .repo-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--text-secondary, #57606a);
  }

  .repo-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Issues and PRs */
  .issues-view,
  .prs-view {
    padding: 16px;
  }

  .issues-list,
  .prs-list {
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    background: var(--surface-color, #ffffff);
    overflow: hidden;
  }

  /* Create Issue Form */
  .create-issue-form {
    padding: 16px;
  }

  .create-issue-form h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
  }

  .create-issue-form input,
  .create-issue-form textarea {
    width: 100%;
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--border-color, #d0d7de);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    box-sizing: border-box;
  }

  .create-issue-form input:focus,
  .create-issue-form textarea:focus {
    outline: none;
    border-color: var(--github-primary, #0969da);
    box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.1);
  }

  .create-issue-form textarea {
    min-height: 150px;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
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
    color: var(--github-danger, #cf222e);
  }

  .loading::after {
    content: '';
    width: 20px;
    height: 20px;
    margin-left: 8px;
    border: 2px solid var(--github-primary, #0969da);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Accessibility */
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--github-primary, #0969da);
    outline-offset: 2px;
  }

  .repo-card:focus-visible {
    outline: 2px solid var(--github-primary, #0969da);
    outline-offset: 2px;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #c9d1d9;
      --text-secondary: #8b949e;
      --surface-color: #0d1117;
      --border-color: #30363d;
      --github-header-bg: #161b22;
      --github-hover-bg: #161b22;
      --github-primary: #58a6ff;
      --github-button-bg: #238636;
      --github-button-hover: #2ea043;
      --github-success: #238636;
      --github-success-hover: #2ea043;
      --github-danger: #f85149;
    }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .repo-list {
      grid-template-columns: 1fr;
    }

    .widget-header {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
  }

  /* Print */
  @media print {
    .refresh-button,
    .back-button,
    .create-button {
      display: none;
    }
  }
`;
