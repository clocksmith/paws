// @blueprint 0x000046 - Diff Utilities for code comparison
/**
 * @fileoverview Simple Diff Utilities for REPLOID
 * Provides line-based diff comparison without external dependencies
 *
 * @module DiffUtils
 * @version 1.0.0
 * @category pure
 */

const DiffUtils = {
  metadata: {
    id: 'DiffUtils',
    version: '1.0.0',
    dependencies: [],
    async: false,
    type: 'pure'
  },

  factory: () => {
    // Widget tracking
    const _diffHistory = [];
    const MAX_HISTORY = 50;
    let _diffStats = {
      total: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalAdditions: 0,
      totalDeletions: 0
    };
    let _lastDiffTime = null;
    const _diffCache = new Map(); // Simple cache for repeated diffs

    /**
     * Longest Common Subsequence algorithm
     * Used as foundation for diff computation
     */
    const computeLCS = (a, b) => {
      const m = a.length;
      const n = b.length;
      const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (a[i - 1] === b[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1] + 1;
          } else {
            dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
          }
        }
      }

      return dp;
    };

    /**
     * Compute diff operations from LCS matrix
     */
    const computeDiff = (a, b, dp) => {
      const changes = [];
      let i = a.length;
      let j = b.length;

      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
          // No change
          changes.unshift({ type: 'equal', line: a[i - 1], lineNum: i });
          i--;
          j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          // Addition
          changes.unshift({ type: 'add', line: b[j - 1], lineNum: j });
          j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
          // Deletion
          changes.unshift({ type: 'delete', line: a[i - 1], lineNum: i });
          i--;
        }
      }

      return changes;
    };

    /**
     * Create unified diff format output
     */
    const formatUnifiedDiff = (changes, contextLines = 3) => {
      const lines = [];
      let i = 0;

      while (i < changes.length) {
        const change = changes[i];

        if (change.type !== 'equal') {
          // Find start of hunk (include context)
          const hunkStart = Math.max(0, i - contextLines);

          // Find end of hunk (include all changes + context)
          let hunkEnd = i;
          while (hunkEnd < changes.length &&
                 (changes[hunkEnd].type !== 'equal' ||
                  hunkEnd - i < contextLines * 2)) {
            hunkEnd++;
          }
          hunkEnd = Math.min(changes.length, hunkEnd + contextLines);

          // Calculate line numbers for hunk header
          let oldStart = 0, oldCount = 0, newStart = 0, newCount = 0;
          for (let j = 0; j < hunkStart; j++) {
            if (changes[j].type !== 'add') oldStart++;
            if (changes[j].type !== 'delete') newStart++;
          }
          oldStart++;
          newStart++;

          for (let j = hunkStart; j < hunkEnd; j++) {
            if (changes[j].type !== 'add') oldCount++;
            if (changes[j].type !== 'delete') newCount++;
          }

          // Write hunk header
          lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);

          // Write hunk content
          for (let j = hunkStart; j < hunkEnd; j++) {
            const c = changes[j];
            if (c.type === 'add') {
              lines.push(`+ ${c.line}`);
            } else if (c.type === 'delete') {
              lines.push(`- ${c.line}`);
            } else {
              lines.push(`  ${c.line}`);
            }
          }

          i = hunkEnd;
        } else {
          i++;
        }
      }

      return lines.join('\n');
    };

    /**
     * Create side-by-side diff format
     */
    const formatSideBySide = (changes, maxWidth = 80) => {
      const lines = [];
      const colWidth = Math.floor(maxWidth / 2) - 3;

      for (const change of changes) {
        const truncated = change.line.length > colWidth
          ? change.line.substring(0, colWidth - 3) + '...'
          : change.line.padEnd(colWidth);

        if (change.type === 'add') {
          lines.push(`${''.padEnd(colWidth)} | + ${truncated}`);
        } else if (change.type === 'delete') {
          lines.push(`- ${truncated} | ${''.padEnd(colWidth)}`);
        } else {
          lines.push(`  ${truncated} |   ${truncated}`);
        }
      }

      return lines.join('\n');
    };

    /**
     * Main diff function - compares two strings line by line
     *
     * @param {string} textA - Original text
     * @param {string} textB - New text
     * @param {Object} options - Diff options
     * @returns {Object} Diff result with statistics and formatted output
     */
    const diff = (textA, textB, options = {}) => {
      const {
        format = 'unified',  // 'unified', 'sideBySide', or 'json'
        contextLines = 3,
        ignoreWhitespace = false
      } = options;

      // Split into lines
      let linesA = textA.split('\n');
      let linesB = textB.split('\n');

      // Optionally ignore whitespace
      if (ignoreWhitespace) {
        linesA = linesA.map(l => l.trim());
        linesB = linesB.map(l => l.trim());
      }

      // Compute LCS and diff
      const dp = computeLCS(linesA, linesB);
      const changes = computeDiff(linesA, linesB, dp);

      // Calculate statistics
      const stats = {
        additions: changes.filter(c => c.type === 'add').length,
        deletions: changes.filter(c => c.type === 'delete').length,
        unchanged: changes.filter(c => c.type === 'equal').length,
        total: changes.length
      };

      // Format output
      let formatted;
      if (format === 'unified') {
        formatted = formatUnifiedDiff(changes, contextLines);
      } else if (format === 'sideBySide') {
        formatted = formatSideBySide(changes);
      } else {
        formatted = changes; // JSON format
      }

      // Track diff execution
      _lastDiffTime = Date.now();
      _diffStats.total++;
      _diffStats.totalAdditions += stats.additions;
      _diffStats.totalDeletions += stats.deletions;
      _diffHistory.push({
        timestamp: _lastDiffTime,
        additions: stats.additions,
        deletions: stats.deletions,
        totalChanges: stats.additions + stats.deletions,
        identical: stats.additions === 0 && stats.deletions === 0
      });
      if (_diffHistory.length > MAX_HISTORY) {
        _diffHistory.shift();
      }

      return {
        changes,
        stats,
        formatted,
        identical: stats.additions === 0 && stats.deletions === 0
      };
    };

    /**
     * Quick comparison - just check if texts are different
     */
    const areEqual = (textA, textB, ignoreWhitespace = false) => {
      if (ignoreWhitespace) {
        return textA.trim() === textB.trim();
      }
      return textA === textB;
    };

    /**
     * Get diff summary without full diff computation
     */
    const getSummary = (textA, textB) => {
      const linesA = textA.split('\n');
      const linesB = textB.split('\n');

      return {
        linesA: linesA.length,
        linesB: linesB.length,
        lineDiff: linesB.length - linesA.length,
        bytesA: textA.length,
        bytesB: textB.length,
        byteDiff: textB.length - textA.length,
        identical: textA === textB
      };
    };

    /**
     * Clear diff history and stats (for widget)
     */
    const clearHistory = () => {
      _diffHistory.length = 0;
      _diffStats = {
        total: 0,
        cacheHits: 0,
        cacheMisses: 0,
        totalAdditions: 0,
        totalDeletions: 0
      };
      _diffCache.clear();
      const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
      ToastNotifications?.show?.('Diff history cleared', 'success');
    };

    /**
     * Clear diff cache (for widget)
     */
    const clearCache = () => {
      _diffCache.clear();
      const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
      ToastNotifications?.show?.('Diff cache cleared', 'success');
    };

    /**
     * Expose state for widget
     */
    const getState = () => ({
      diffHistory: _diffHistory,
      diffStats: _diffStats,
      cacheSize: _diffCache.size,
      lastDiffTime: _lastDiffTime
    });

    return {
      api: {
        diff,
        areEqual,
        getSummary,
        formatUnifiedDiff,
        formatSideBySide,
        clearHistory,
        clearCache,
        getState
      },

      widget: {
        element: 'diff-utils-widget',
        displayName: 'Diff Utilities',
        icon: '◎',
        category: 'utils',
        updateInterval: 2000
      }
    };
  }
};

// Web Component for Diff Utilities Widget
if (typeof HTMLElement !== 'undefined') {
class DiffUtilsWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();

    // Auto-refresh with updateInterval
    if (this.updateInterval) {
      this._interval = setInterval(() => this.render(), this.updateInterval);
    }
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  set updateInterval(interval) {
    this._updateInterval = interval;
  }

  get updateInterval() {
    return this._updateInterval || 2000;
  }

  getStatus() {
    if (!this._api) return { state: 'idle', primaryMetric: 'Loading...', secondaryMetric: '' };

    const state = this._api.getState();
    const avgChanges = state.diffStats.total > 0
      ? ((state.diffStats.totalAdditions + state.diffStats.totalDeletions) / state.diffStats.total).toFixed(0)
      : 0;

    return {
      state: 'idle',
      primaryMetric: `${state.diffStats.total} diffs`,
      secondaryMetric: `~${avgChanges} changes/diff`,
      lastActivity: state.lastDiffTime
    };
  }

  render() {
    if (!this._api) {
      this.shadowRoot.innerHTML = '<div>Loading...</div>';
      return;
    }

    const state = this._api.getState();
    const { diffHistory, diffStats, cacheSize } = state;

    const formatTimeAgo = (timestamp) => {
      if (!timestamp) return 'Never';
      const diff = Date.now() - timestamp;
      if (diff < 1000) return 'Just now';
      if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
      if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
      return `${Math.floor(diff/3600000)}h ago`;
    };

    const avgAdditions = diffStats.total > 0
      ? (diffStats.totalAdditions / diffStats.total).toFixed(1)
      : 0;
    const avgDeletions = diffStats.total > 0
      ? (diffStats.totalDeletions / diffStats.total).toFixed(1)
      : 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        h4 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #4fc3f7;
        }

        h5 {
          margin: 16px 0 8px 0;
          font-size: 1em;
          color: #aaa;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 12px;
        }

        .stat-label {
          font-size: 0.85em;
          color: #888;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.5em;
          font-weight: bold;
          color: #4fc3f7;
        }

        .diff-averages {
          background: rgba(255,255,255,0.03);
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .diff-stat-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
        }

        .diff-stat-label {
          color: #aaa;
        }

        .diff-stat-value {
          color: #4fc3f7;
          font-weight: bold;
        }

        .diff-history-list {
          max-height: 250px;
          overflow-y: auto;
        }

        .diff-history-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
          margin-bottom: 6px;
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 0.9em;
        }

        .diff-time {
          color: #888;
          font-size: 0.85em;
          min-width: 80px;
        }

        .diff-additions {
          color: #66bb6a;
          font-weight: bold;
        }

        .diff-deletions {
          color: #f48771;
          font-weight: bold;
        }

        .diff-total {
          color: #aaa;
          font-size: 0.85em;
        }

        .diff-identical {
          color: #4fc3f7;
          font-size: 0.85em;
          margin-left: auto;
        }

        .button-group {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        button {
          flex: 1;
          background: rgba(79, 195, 247, 0.3);
          border: 1px solid #4fc3f7;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 8px 12px;
          font-size: 0.9em;
          font-weight: bold;
          transition: background 0.2s;
        }

        button:hover {
          background: rgba(79, 195, 247, 0.5);
        }

        .info-panel {
          margin-top: 16px;
          padding: 12px;
          background: rgba(100,150,255,0.1);
          border-left: 3px solid #6496ff;
          border-radius: 4px;
        }

        .info-panel strong {
          display: block;
          margin-bottom: 6px;
        }

        .scrollable {
          scrollbar-width: thin;
          scrollbar-color: rgba(79, 195, 247, 0.5) rgba(255,255,255,0.1);
        }

        .scrollable::-webkit-scrollbar {
          width: 6px;
        }

        .scrollable::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }

        .scrollable::-webkit-scrollbar-thumb {
          background: rgba(79, 195, 247, 0.5);
          border-radius: 3px;
        }
      </style>

      <div class="diff-utils-panel">
        <h4>◎ Diff Utilities</h4>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Diffs</div>
            <div class="stat-value">${diffStats.total}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cache Size</div>
            <div class="stat-value">${cacheSize}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Additions</div>
            <div class="stat-value">${diffStats.totalAdditions}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Deletions</div>
            <div class="stat-value">${diffStats.totalDeletions}</div>
          </div>
        </div>

        <h5>Average Changes per Diff</h5>
        <div class="diff-averages">
          <div class="diff-stat-row">
            <span class="diff-stat-label">Additions:</span>
            <span class="diff-stat-value">+${avgAdditions}</span>
          </div>
          <div class="diff-stat-row">
            <span class="diff-stat-label">Deletions:</span>
            <span class="diff-stat-value">-${avgDeletions}</span>
          </div>
          <div class="diff-stat-row">
            <span class="diff-stat-label">Total Changes:</span>
            <span class="diff-stat-value">${(parseFloat(avgAdditions) + parseFloat(avgDeletions)).toFixed(1)}</span>
          </div>
        </div>

        <h5>Recent Diffs (${Math.min(20, diffHistory.length)})</h5>
        <div class="diff-history-list scrollable">
          ${diffHistory.length > 0 ? diffHistory.slice(-20).reverse().map(diff => `
            <div class="diff-history-item">
              <span class="diff-time">${formatTimeAgo(diff.timestamp)}</span>
              <span class="diff-additions">+${diff.additions}</span>
              <span class="diff-deletions">-${diff.deletions}</span>
              <span class="diff-total">${diff.totalChanges} changes</span>
              ${diff.identical ? '<span class="diff-identical">✓ Identical</span>' : ''}
            </div>
          `).join('') : '<p style="color: #888; padding: 20px; text-align: center;">No diffs computed yet</p>'}
        </div>

        <div class="button-group">
          <button id="clear-history">⌦ Clear History</button>
          <button id="clear-cache">▼ Clear Cache</button>
        </div>

        <div class="info-panel">
          <strong>ⓘ Diff Utilities</strong>
          <div style="color: #aaa; font-size: 0.9em;">
            Line-based diff comparison with no external dependencies.<br>
            Tracks diff operations, additions, deletions, and maintains a cache for performance.
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const clearHistoryBtn = this.shadowRoot.getElementById('clear-history');
    const clearCacheBtn = this.shadowRoot.getElementById('clear-cache');

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this._api.clearHistory();
        this.render();
      });
    }

    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => {
        this._api.clearCache();
        this.render();
      });
    }
  }
}

// Define the custom element
if (!customElements.get('diff-utils-widget')) {
  customElements.define('diff-utils-widget', DiffUtilsWidget);
}
}

// Export for browser usage (REPLOID module system)
export default DiffUtils;
