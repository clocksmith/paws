/**
 * @fileoverview Browser-native DOGS/CATS Parser for REPLOID
 * Self-contained implementation with zero external dependencies
 *
 * @blueprint 0x000042 - Browser-native DOGS/CATS parser for zero-dependency bundle handling in REPLOID.
 * @module DogsParserBrowser
 * @version 1.0.0
 * @category parser
 */

const DogsParserBrowser = {
  metadata: {
    id: 'DogsParserBrowser',
    version: '1.0.0',
    dependencies: ['Utils'],
    async: false,
    type: 'pure'
  },

  factory: (deps) => {
    const { Utils } = deps;
    const { logger } = Utils;

    // Widget tracking
    const _parseHistory = [];
    const MAX_HISTORY = 50;
    let _parseStats = {
      dogsTotal: 0,
      dogsSuccess: 0,
      dogsErrors: 0,
      catsTotal: 0,
      catsSuccess: 0,
      catsErrors: 0
    };
    let _lastParseTime = null;
    const _errorLog = [];
    const MAX_ERROR_LOG = 20;

    // DOGS/CATS marker patterns
    const DOGS_MARKER_REGEX = /🐕\s*---\s*DOGS_(START|END)_FILE:\s*(.+?)(\s*\(Content:Base64\))?\s*---/;
    const CATS_MARKER_REGEX = /🐈\s*---\s*CATS_(START|END)_FILE:\s*(.+?)(\s*\(Content:Base64\))?\s*---/;
    const PAWS_CHANGE_BLOCK = /```paws-change\s*([\s\S]*?)```\s*```([a-z]*)\s*([\s\S]*?)```/g;

    /**
     * File operation types
     */
    const FileOperation = {
      CREATE: 'CREATE',
      MODIFY: 'MODIFY',
      DELETE: 'DELETE'
    };

    /**
     * Parse DOGS bundle into structured change set
     * @param {string} dogsContent - Raw DOGS markdown content
     * @returns {Object} Parsed change set with operations
     */
    const parseDogs = (dogsContent) => {
      logger.info('[DogsParser] Parsing DOGS bundle');
      const startTime = Date.now();

      try {
        const changes = [];
        const blocks = dogsContent.split('```paws-change');

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const metaEnd = block.indexOf('```');
        if (metaEnd === -1) continue;

        const meta = block.substring(0, metaEnd).trim();
        const operationMatch = meta.match(/operation:\s*(\w+)/i);
        const filePathMatch = meta.match(/file_path:\s*(.+)/i);
        const reasonMatch = meta.match(/reason:\s*(.+)/i);

        if (!operationMatch || !filePathMatch) {
          logger.warn('[DogsParser] Skipping block - missing operation or file_path');
          continue;
        }

        const operation = operationMatch[1].toUpperCase();
        const filePath = filePathMatch[1].trim();
        const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';

        // Validate operation
        if (!Object.values(FileOperation).includes(operation)) {
          logger.warn(`[DogsParser] Invalid operation: ${operation}`);
          continue;
        }

        let newContent = '';
        if (operation !== FileOperation.DELETE) {
          const contentStart = block.indexOf('```', metaEnd + 3);
          if (contentStart !== -1) {
            const actualStart = contentStart + 3;
            const contentEnd = block.indexOf('```', actualStart);
            if (contentEnd !== -1) {
              // Handle newline after opening ```
              let startIdx = actualStart;
              if (block[startIdx] === '\n') startIdx++;
              newContent = block.substring(startIdx, contentEnd);
            }
          }
        }

        changes.push({
          operation,
          file_path: filePath,
          new_content: newContent,
          reason
        });
      }

        logger.info(`[DogsParser] Parsed ${changes.length} changes`);

        // Track successful parse
        const duration = Date.now() - startTime;
        _lastParseTime = Date.now();
        _parseStats.dogsTotal++;
        _parseStats.dogsSuccess++;
        _parseHistory.push({
          type: 'DOGS',
          timestamp: _lastParseTime,
          success: true,
          changeCount: changes.length,
          duration
        });
        if (_parseHistory.length > MAX_HISTORY) {
          _parseHistory.shift();
        }

        return {
          changes,
          total: changes.length,
          creates: changes.filter(c => c.operation === FileOperation.CREATE).length,
          modifies: changes.filter(c => c.operation === FileOperation.MODIFY).length,
          deletes: changes.filter(c => c.operation === FileOperation.DELETE).length
        };
      } catch (error) {
        // Track parse error
        const duration = Date.now() - startTime;
        _lastParseTime = Date.now();
        _parseStats.dogsTotal++;
        _parseStats.dogsErrors++;
        _parseHistory.push({
          type: 'DOGS',
          timestamp: _lastParseTime,
          success: false,
          error: error.message,
          duration
        });
        if (_parseHistory.length > MAX_HISTORY) {
          _parseHistory.shift();
        }
        _errorLog.push({
          type: 'DOGS',
          timestamp: _lastParseTime,
          error: error.message
        });
        if (_errorLog.length > MAX_ERROR_LOG) {
          _errorLog.shift();
        }
        throw error;
      }
    };

    /**
     * Parse CATS bundle into file list with contents
     * @param {string} catsContent - Raw CATS markdown content
     * @returns {Object} Parsed file list
     */
    const parseCats = (catsContent) => {
      logger.info('[DogsParser] Parsing CATS bundle');

      const files = [];
      const lines = catsContent.split('\n');
      let currentFile = null;
      let currentContent = [];
      let inCodeBlock = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for CATS file markers
        const startMatch = line.match(CATS_MARKER_REGEX);
        if (startMatch && startMatch[1] === 'START') {
          if (currentFile) {
            // Save previous file
            files.push({
              path: currentFile,
              content: currentContent.join('\n')
            });
          }
          currentFile = startMatch[2];
          currentContent = [];
          inCodeBlock = false;
          continue;
        }

        const endMatch = line.match(CATS_MARKER_REGEX);
        if (endMatch && endMatch[1] === 'END') {
          if (currentFile) {
            files.push({
              path: currentFile,
              content: currentContent.join('\n')
            });
          }
          currentFile = null;
          currentContent = [];
          inCodeBlock = false;
          continue;
        }

        // Collect content
        if (currentFile) {
          // Track code block boundaries
          if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
          }
          currentContent.push(line);
        }
      }

      // Handle last file if no END marker
      if (currentFile) {
        files.push({
          path: currentFile,
          content: currentContent.join('\n')
        });
      }

      logger.info(`[DogsParser] Parsed ${files.length} files from CATS bundle`);
      return {
        files,
        total: files.length
      };
    };

    /**
     * Create DOGS bundle from change set
     * @param {Array} changes - Array of {operation, file_path, new_content, reason}
     * @returns {string} DOGS markdown
     */
    const createDogsBundle = (changes, metadata = {}) => {
      const { reason = 'Change proposal', timestamp = new Date().toISOString() } = metadata;

      let bundle = `## PAWS Change Proposal (dogs.md)\n\n`;
      bundle += `**Reason:** ${reason}\n`;
      bundle += `**Timestamp:** ${timestamp}\n`;
      bundle += `**Changes:** ${changes.length}\n\n`;
      bundle += `---\n\n`;

      for (const change of changes) {
        bundle += `\`\`\`paws-change\n`;
        bundle += `operation: ${change.operation}\n`;
        bundle += `file_path: ${change.file_path}\n`;
        bundle += `reason: ${change.reason || 'No reason provided'}\n`;
        bundle += `\`\`\`\n\n`;

        if (change.operation !== FileOperation.DELETE) {
          const ext = change.file_path.split('.').pop();
          bundle += `\`\`\`${ext}\n`;
          bundle += change.new_content;
          bundle += `\n\`\`\`\n\n`;
        }
      }

      return bundle;
    };

    /**
     * Create CATS bundle from file list
     * @param {Array} files - Array of {path, content}
     * @returns {string} CATS markdown
     */
    const createCatsBundle = (files, metadata = {}) => {
      const { reason = 'Context bundle', timestamp = new Date().toISOString() } = metadata;

      let bundle = `## PAWS Context Bundle (cats.md)\n\n`;
      bundle += `**Reason:** ${reason}\n`;
      bundle += `**Timestamp:** ${timestamp}\n`;
      bundle += `**Files:** ${files.length}\n\n`;
      bundle += `---\n\n`;

      for (const file of files) {
        bundle += `🐈 --- CATS_START_FILE: ${file.path} ---\n\n`;
        bundle += file.content;
        bundle += `\n\n🐈 --- CATS_END_FILE: ${file.path} ---\n\n`;
      }

      return bundle;
    };

    /**
     * Validate DOGS bundle format
     * @param {string} dogsContent - DOGS markdown
     * @returns {Object} {valid: boolean, errors: string[]}
     */
    const validateDogs = (dogsContent) => {
      const errors = [];

      if (!dogsContent || dogsContent.trim().length === 0) {
        errors.push('DOGS bundle is empty');
      }

      const blocks = dogsContent.split('```paws-change');
      if (blocks.length < 2) {
        errors.push('No paws-change blocks found');
      }

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block.includes('operation:')) {
          errors.push(`Block ${i} missing operation`);
        }
        if (!block.includes('file_path:')) {
          errors.push(`Block ${i} missing file_path`);
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    };

    /**
     * Validate CATS bundle format
     * @param {string} catsContent - CATS markdown
     * @returns {Object} {valid: boolean, errors: string[]}
     */
    const validateCats = (catsContent) => {
      const errors = [];

      if (!catsContent || catsContent.trim().length === 0) {
        errors.push('CATS bundle is empty');
      }

      const startCount = (catsContent.match(/CATS_START_FILE/g) || []).length;
      const endCount = (catsContent.match(/CATS_END_FILE/g) || []).length;

      if (startCount !== endCount) {
        errors.push(`Mismatched markers: ${startCount} START vs ${endCount} END`);
      }

      if (startCount === 0) {
        errors.push('No CATS file markers found');
      }

      return {
        valid: errors.length === 0,
        errors
      };
    };

    /**
     * Clear parse history and stats (for widget)
     */
    const clearHistory = () => {
      _parseHistory.length = 0;
      _parseStats = {
        dogsTotal: 0,
        dogsSuccess: 0,
        dogsErrors: 0,
        catsTotal: 0,
        catsSuccess: 0,
        catsErrors: 0
      };
      _errorLog.length = 0;
      const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
      ToastNotifications?.show?.('Parser history cleared', 'success');
    };

    /**
     * Expose state for widget
     */
    const getState = () => ({
      parseHistory: _parseHistory,
      parseStats: _parseStats,
      errorLog: _errorLog,
      lastParseTime: _lastParseTime
    });

    return {
      api: {
        // Core parsing
        parseDogs,
        parseCats,

        // Bundle creation
        createDogsBundle,
        createCatsBundle,

        // Validation
        validateDogs,
        validateCats,

        // Widget support
        clearHistory,
        getState,

        // Constants
        FileOperation,
        DOGS_MARKER_REGEX,
        CATS_MARKER_REGEX
      },

      widget: {
        element: 'dogs-parser-browser-widget',
        displayName: 'DOGS/CATS Parser',
        icon: '▸',
        category: 'parser',
        updateInterval: 2000
      }
    };
  }
};

// Web Component for DOGS/CATS Parser Widget
if (typeof HTMLElement !== 'undefined') {
class DogsParserBrowserWidget extends HTMLElement {
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
    const totalParses = state.parseStats.dogsTotal + state.parseStats.catsTotal;
    const totalErrors = state.parseStats.dogsErrors + state.parseStats.catsErrors;
    const successRate = totalParses > 0
      ? ((totalParses - totalErrors) / totalParses * 100).toFixed(0)
      : 100;

    let status = 'idle';
    if (state.parseHistory.length > 0 && Date.now() - state.lastParseTime < 5000) status = 'active';
    if (totalErrors > 0 && totalErrors / totalParses > 0.2) status = 'error';

    return {
      state: status,
      primaryMetric: `${totalParses} bundles`,
      secondaryMetric: `${successRate}% success`,
      lastActivity: state.lastParseTime
    };
  }

  render() {
    if (!this._api) {
      this.shadowRoot.innerHTML = '<div>Loading...</div>';
      return;
    }

    const state = this._api.getState();
    const { parseHistory, parseStats, errorLog } = state;

    const formatTime = (timestamp) => {
      if (!timestamp) return 'Never';
      return new Date(timestamp).toLocaleTimeString();
    };

    const formatDuration = (ms) => {
      if (ms < 1000) return `${ms}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    };

    const totalParses = parseStats.dogsTotal + parseStats.catsTotal;
    const avgDuration = parseHistory.length > 0
      ? (parseHistory.reduce((sum, p) => sum + (p.duration || 0), 0) / parseHistory.length).toFixed(0)
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

        .parse-stats-breakdown {
          background: rgba(255,255,255,0.03);
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .parse-stat-row {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 6px 0;
        }

        .parse-type {
          font-weight: bold;
          color: #4fc3f7;
          min-width: 60px;
        }

        .parse-success {
          color: #66bb6a;
          font-size: 0.9em;
        }

        .parse-errors {
          color: #f48771;
          font-size: 0.9em;
        }

        .parse-history-list {
          max-height: 250px;
          overflow-y: auto;
        }

        .parse-history-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
          margin-bottom: 6px;
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 0.9em;
          border-left: 3px solid #4fc3f7;
        }

        .parse-history-item.parse-error {
          border-left-color: #f48771;
          background: rgba(244, 135, 113, 0.1);
        }

        .parse-time {
          color: #888;
          font-size: 0.85em;
          min-width: 80px;
        }

        .parse-type-badge {
          background: rgba(79, 195, 247, 0.2);
          color: #4fc3f7;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 0.8em;
          font-weight: bold;
          min-width: 45px;
          text-align: center;
        }

        .parse-status {
          font-weight: bold;
        }

        .parse-changes {
          color: #aaa;
          font-size: 0.85em;
        }

        .parse-duration {
          color: #666;
          font-size: 0.85em;
          margin-left: auto;
        }

        .error-log-list {
          max-height: 150px;
          overflow-y: auto;
        }

        .error-log-item {
          padding: 8px;
          background: rgba(244, 135, 113, 0.1);
          border-left: 3px solid #f48771;
          border-radius: 4px;
          margin-bottom: 6px;
          font-size: 0.85em;
        }

        .error-time {
          color: #888;
          margin-right: 8px;
        }

        .error-type {
          color: #f48771;
          font-weight: bold;
          margin-right: 8px;
        }

        .error-message {
          color: #aaa;
        }

        button {
          background: rgba(79, 195, 247, 0.3);
          border: 1px solid #4fc3f7;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 8px 12px;
          font-size: 0.9em;
          font-weight: bold;
          transition: background 0.2s;
          margin-top: 12px;
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

      <div class="dogs-parser-panel">
        <h4>▸ DOGS/CATS Parser</h4>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">DOGS Bundles</div>
            <div class="stat-value">${parseStats.dogsTotal}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">CATS Bundles</div>
            <div class="stat-value">${parseStats.catsTotal}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Errors</div>
            <div class="stat-value">${parseStats.dogsErrors + parseStats.catsErrors}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg Time</div>
            <div class="stat-value">${avgDuration}ms</div>
          </div>
        </div>

        <h5>Parse Statistics</h5>
        <div class="parse-stats-breakdown">
          <div class="parse-stat-row">
            <span class="parse-type">▸ DOGS</span>
            <span class="parse-success">${parseStats.dogsSuccess} success</span>
            <span class="parse-errors">${parseStats.dogsErrors} errors</span>
          </div>
          <div class="parse-stat-row">
            <span class="parse-type">● CATS</span>
            <span class="parse-success">${parseStats.catsSuccess} success</span>
            <span class="parse-errors">${parseStats.catsErrors} errors</span>
          </div>
        </div>

        <h5>Recent Parses (${Math.min(15, parseHistory.length)})</h5>
        <div class="parse-history-list scrollable">
          ${parseHistory.length > 0 ? parseHistory.slice(-15).reverse().map(parse => `
            <div class="parse-history-item ${parse.success ? '' : 'parse-error'}">
              <span class="parse-time">${formatTime(parse.timestamp)}</span>
              <span class="parse-type-badge">${parse.type}</span>
              <span class="parse-status">${parse.success ? '✓' : '✗'}</span>
              ${parse.success ? `<span class="parse-changes">${parse.changeCount} changes</span>` : ''}
              <span class="parse-duration">${formatDuration(parse.duration)}</span>
            </div>
          `).join('') : '<p style="color: #888; padding: 20px; text-align: center;">No parses yet</p>'}
        </div>

        ${errorLog.length > 0 ? `
          <h5>Recent Errors (${Math.min(5, errorLog.length)})</h5>
          <div class="error-log-list scrollable">
            ${errorLog.slice(-5).reverse().map(err => `
              <div class="error-log-item">
                <span class="error-time">${formatTime(err.timestamp)}</span>
                <span class="error-type">${err.type}</span>
                <span class="error-message">${err.error}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <button id="clear-history">⌦ Clear History</button>

        <div class="info-panel">
          <strong>ⓘ DOGS/CATS Parser</strong>
          <div style="color: #aaa; font-size: 0.9em;">
            Browser-native parser with zero external dependencies for DOGS (change proposals) and CATS (context bundles).<br>
            Tracks parse history, success rates, and errors.
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const clearBtn = this.shadowRoot.getElementById('clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._api.clearHistory();
        this.render();
      });
    }
  }
}

// Define the custom element
if (!customElements.get('dogs-parser-browser-widget')) {
  customElements.define('dogs-parser-browser-widget', DogsParserBrowserWidget);
}
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DogsParserBrowser;
}
export default DogsParserBrowser;
