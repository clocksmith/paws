/**
 * Reploid Metrics Dashboard Widget
 *
 * Performance metrics and statistics dashboard
 * Shows session info, performance stats, resource usage, and code changes
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockMetricsData: any;
if (USE_MOCK_DATA) {
  mockMetricsData = {
    "session": {
      "id": "session_2025_10_30_150000",
      "started_at": "2025-10-30T15:00:00Z",
      "uptime_seconds": 1800,
      "total_tasks": 5,
      "completed_tasks": 4,
      "failed_tasks": 1
    },
    "performance": {
      "average_context_curation_time_seconds": 45,
      "average_planning_time_seconds": 30,
      "average_proposal_generation_time_seconds": 60,
      "average_changeset_application_time_seconds": 15,
      "average_approval_wait_time_seconds": 120,
      "total_cycle_time_seconds": 270
    },
    "resources": {
      "memory_usage_mb": 256,
      "memory_peak_mb": 384,
      "cpu_usage_percent": 12,
      "disk_reads_mb": 45,
      "disk_writes_mb": 12
    },
    "code_changes": {
      "total_files_modified": 15,
      "total_lines_added": 450,
      "total_lines_removed": 120,
      "total_lines_modified": 89,
      "files_created": 3,
      "files_deleted": 1
    },
    "approvals": {
      "context_approvals": 4,
      "context_rejections": 1,
      "proposal_approvals": 3,
      "proposal_rejections": 2,
      "auto_approvals": 0,
      "average_review_time_seconds": 45
    },
    "errors": {
      "total_errors": 2,
      "context_errors": 1,
      "proposal_errors": 0,
      "application_errors": 1,
      "last_error": {
        "message": "Failed to parse file: syntax error",
        "timestamp": "2025-10-30T15:25:00Z",
        "state": "CURATING_CONTEXT"
      }
    }
  };
}

export default function createMetricsWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class MetricsWidget extends HTMLElement {
    private metricsData: any = null;
    private pollInterval: any;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.loadMetrics();

      // Poll for updates in production mode
      if (!USE_MOCK_DATA) {
        this.pollInterval = setInterval(() => {
          this.loadMetrics();
        }, 5000);
      }
    }

    disconnectedCallback() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadMetrics() {
      if (USE_MOCK_DATA) {
        this.metricsData = mockMetricsData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_metrics',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          this.metricsData = JSON.parse(result.content[0].text);
          this.render();
        }
      } catch (error) {
        console.error('Failed to load metrics:', error);
        this.showError('Failed to load metrics');
      }
    }

    private showError(message: string) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-toast';
      errorDiv.textContent = message;
      this.shadowRoot?.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
    }

    private render() {
      if (!this.shadowRoot) return;

      if (!this.metricsData) {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="metrics-empty">
            <div class="empty-icon">📊</div>
            <div class="empty-text">Loading metrics...</div>
          </div>
        `;
        return;
      }

      const uptime = this.formatDuration(this.metricsData.session.uptime_seconds);
      const successRate = this.calculateSuccessRate();

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="metrics-container">
          <!-- Session Overview -->
          <div class="metrics-section">
            <div class="section-title">📋 SESSION OVERVIEW</div>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Session ID</div>
                <div class="metric-value small">${this.escapeHtml(this.metricsData.session.id)}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Uptime</div>
                <div class="metric-value">${uptime}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Total Tasks</div>
                <div class="metric-value">${this.metricsData.session.total_tasks}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Success Rate</div>
                <div class="metric-value ${successRate >= 75 ? 'success' : successRate >= 50 ? 'warning' : 'error'}">
                  ${successRate}%
                </div>
              </div>
            </div>
          </div>

          <!-- Performance -->
          <div class="metrics-section">
            <div class="section-title">⚡ PERFORMANCE</div>
            <div class="perf-grid">
              ${this.renderPerformanceBar('Context Curation', this.metricsData.performance.average_context_curation_time_seconds, 60)}
              ${this.renderPerformanceBar('Planning', this.metricsData.performance.average_planning_time_seconds, 60)}
              ${this.renderPerformanceBar('Proposal Generation', this.metricsData.performance.average_proposal_generation_time_seconds, 120)}
              ${this.renderPerformanceBar('Changeset Application', this.metricsData.performance.average_changeset_application_time_seconds, 30)}
              ${this.renderPerformanceBar('Approval Wait Time', this.metricsData.performance.average_approval_wait_time_seconds, 180)}
            </div>
            <div class="total-cycle">
              <span class="total-label">Total Cycle Time:</span>
              <span class="total-value">${this.formatDuration(this.metricsData.performance.total_cycle_time_seconds)}</span>
            </div>
          </div>

          <!-- Resources -->
          <div class="metrics-section">
            <div class="section-title">💾 RESOURCE USAGE</div>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Memory</div>
                <div class="metric-value">${this.metricsData.resources.memory_usage_mb}MB</div>
                <div class="metric-subtext">Peak: ${this.metricsData.resources.memory_peak_mb}MB</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">CPU</div>
                <div class="metric-value">${this.metricsData.resources.cpu_usage_percent}%</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Disk Reads</div>
                <div class="metric-value">${this.metricsData.resources.disk_reads_mb}MB</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Disk Writes</div>
                <div class="metric-value">${this.metricsData.resources.disk_writes_mb}MB</div>
              </div>
            </div>
          </div>

          <!-- Code Changes -->
          <div class="metrics-section">
            <div class="section-title">📝 CODE CHANGES</div>
            <div class="changes-grid">
              <div class="change-stat">
                <div class="change-icon create">⊕</div>
                <div class="change-info">
                  <div class="change-count">${this.metricsData.code_changes.files_created}</div>
                  <div class="change-label">Files Created</div>
                </div>
              </div>
              <div class="change-stat">
                <div class="change-icon modify">✏️</div>
                <div class="change-info">
                  <div class="change-count">${this.metricsData.code_changes.total_files_modified}</div>
                  <div class="change-label">Files Modified</div>
                </div>
              </div>
              <div class="change-stat">
                <div class="change-icon delete">⛶️</div>
                <div class="change-info">
                  <div class="change-count">${this.metricsData.code_changes.files_deleted}</div>
                  <div class="change-label">Files Deleted</div>
                </div>
              </div>
            </div>
            <div class="lines-stats">
              <div class="line-stat added">
                <span class="line-label">+${this.metricsData.code_changes.total_lines_added}</span>
                <span class="line-text">lines added</span>
              </div>
              <div class="line-stat removed">
                <span class="line-label">-${this.metricsData.code_changes.total_lines_removed}</span>
                <span class="line-text">lines removed</span>
              </div>
              <div class="line-stat modified">
                <span class="line-label">~${this.metricsData.code_changes.total_lines_modified}</span>
                <span class="line-text">lines modified</span>
              </div>
            </div>
          </div>

          <!-- Approvals -->
          <div class="metrics-section">
            <div class="section-title">✓ APPROVALS</div>
            <div class="approval-stats">
              <div class="approval-row">
                <span class="approval-label">Context Approvals:</span>
                <span class="approval-value success">${this.metricsData.approvals.context_approvals}</span>
                <span class="approval-vs">vs</span>
                <span class="approval-value error">${this.metricsData.approvals.context_rejections}</span>
                <span class="approval-label">rejections</span>
              </div>
              <div class="approval-row">
                <span class="approval-label">Proposal Approvals:</span>
                <span class="approval-value success">${this.metricsData.approvals.proposal_approvals}</span>
                <span class="approval-vs">vs</span>
                <span class="approval-value error">${this.metricsData.approvals.proposal_rejections}</span>
                <span class="approval-label">rejections</span>
              </div>
              <div class="approval-row">
                <span class="approval-label">Avg Review Time:</span>
                <span class="approval-value">${this.formatDuration(this.metricsData.approvals.average_review_time_seconds)}</span>
              </div>
            </div>
          </div>

          <!-- Errors -->
          ${this.metricsData.errors.total_errors > 0 ? `
          <div class="metrics-section error-section">
            <div class="section-title">⚠️ ERRORS (${this.metricsData.errors.total_errors})</div>
            <div class="error-breakdown">
              <div class="error-stat">Context: ${this.metricsData.errors.context_errors}</div>
              <div class="error-stat">Proposal: ${this.metricsData.errors.proposal_errors}</div>
              <div class="error-stat">Application: ${this.metricsData.errors.application_errors}</div>
            </div>
            ${this.metricsData.errors.last_error ? `
              <div class="last-error">
                <div class="last-error-label">Last Error:</div>
                <div class="last-error-message">${this.escapeHtml(this.metricsData.errors.last_error.message)}</div>
                <div class="last-error-meta">
                  <span>${this.metricsData.errors.last_error.state}</span>
                  <span>·</span>
                  <span>${new Date(this.metricsData.errors.last_error.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ` : ''}
          </div>
          ` : ''}
        </div>
      `;
    }

    private renderPerformanceBar(label: string, value: number, max: number) {
      const percentage = Math.min((value / max) * 100, 100);
      const color = percentage < 50 ? '#4ec9b0' : percentage < 75 ? '#ffc107' : '#ff4444';

      return `
        <div class="perf-bar">
          <div class="perf-label">
            <span>${label}</span>
            <span class="perf-time">${this.formatDuration(value)}</span>
          </div>
          <div class="perf-bar-bg">
            <div class="perf-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
          </div>
        </div>
      `;
    }

    private calculateSuccessRate(): number {
      const total = this.metricsData.session.total_tasks;
      const completed = this.metricsData.session.completed_tasks;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    private formatDuration(seconds: number): string {
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (minutes < 60) return `${minutes}m ${secs}s`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }

    private escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    private getStyles() {
      return `
        :host {
          display: block;
          font-family: 'Courier New', monospace;
          color: #e0e0e0;
        }

        .metrics-empty {
          padding: 60px 20px;
          text-align: center;
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 18px;
          color: #888;
        }

        .metrics-container {
          background: rgba(20, 20, 20, 0.8);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-height: 100%;
          overflow-y: auto;
        }

        .metrics-section {
          background: rgba(40, 40, 40, 0.6);
          border: 1px solid #333;
          padding: 16px;
        }

        .section-title {
          font-size: 12px;
          color: #4ec9b0;
          font-weight: bold;
          margin-bottom: 16px;
          letter-spacing: 1px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }

        .metric-card {
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid #333;
          padding: 16px;
          text-align: center;
        }

        .metric-label {
          font-size: 11px;
          color: #888;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metric-value {
          font-size: 24px;
          font-weight: bold;
          color: #4ec9b0;
        }

        .metric-value.small {
          font-size: 12px;
        }

        .metric-value.success {
          color: #4ec9b0;
        }

        .metric-value.warning {
          color: #ffc107;
        }

        .metric-value.error {
          color: #ff4444;
        }

        .metric-subtext {
          font-size: 11px;
          color: #666;
          margin-top: 4px;
        }

        .perf-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .perf-bar {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .perf-label {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #e0e0e0;
        }

        .perf-time {
          color: #4ec9b0;
          font-weight: bold;
        }

        .perf-bar-bg {
          height: 8px;
          background: rgba(40, 40, 40, 0.8);
          border: 1px solid #333;
          overflow: hidden;
        }

        .perf-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .total-cycle {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #333;
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }

        .total-label {
          color: #888;
        }

        .total-value {
          color: #4ec9b0;
          font-weight: bold;
        }

        .changes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .change-stat {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid #333;
        }

        .change-icon {
          font-size: 32px;
        }

        .change-count {
          font-size: 24px;
          font-weight: bold;
          color: #4ec9b0;
        }

        .change-label {
          font-size: 11px;
          color: #888;
        }

        .lines-stats {
          display: flex;
          gap: 16px;
          padding: 12px;
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid #333;
          justify-content: space-around;
        }

        .line-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .line-label {
          font-size: 20px;
          font-weight: bold;
        }

        .line-text {
          font-size: 11px;
          color: #888;
        }

        .line-stat.added .line-label {
          color: #4ec9b0;
        }

        .line-stat.removed .line-label {
          color: #f48771;
        }

        .line-stat.modified .line-label {
          color: #ffd700;
        }

        .approval-stats {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .approval-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid #333;
          font-size: 13px;
        }

        .approval-label {
          color: #888;
        }

        .approval-value {
          color: #e0e0e0;
          font-weight: bold;
        }

        .approval-value.success {
          color: #4ec9b0;
        }

        .approval-value.error {
          color: #ff4444;
        }

        .approval-vs {
          color: #666;
        }

        .error-section {
          border-color: #ff4444;
        }

        .error-breakdown {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .error-stat {
          color: #ff4444;
        }

        .last-error {
          padding: 12px;
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid rgba(255, 68, 68, 0.3);
        }

        .last-error-label {
          font-size: 11px;
          color: #888;
          margin-bottom: 6px;
        }

        .last-error-message {
          font-size: 13px;
          color: #ff4444;
          margin-bottom: 6px;
        }

        .last-error-meta {
          font-size: 11px;
          color: #666;
        }

        .error-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #ff4444;
          color: white;
          padding: 12px 20px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 10000;
        }
      `;
    }
  }

  // Register custom element
  if (!customElements.get('reploid-metrics-dashboard')) {
    customElements.define('reploid-metrics-dashboard', MetricsWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[MetricsWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-metrics-dashboard',
          displayName: 'Reploid Metrics Dashboard'
        });
      },
      async destroy() {
        console.log('[MetricsWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-metrics-dashboard',
          displayName: 'Reploid Metrics Dashboard'
        });
      },
      async refresh() {
        console.log('[MetricsWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-metrics-dashboard',
          displayName: 'Reploid Metrics Dashboard'
        });
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-metrics-dashboard',
      displayName: 'Reploid Metrics Dashboard',
      description: 'Performance metrics and statistics dashboard',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_metrics']
      },
      category: 'data-visualization',
      tags: ['reploid', 'metrics', 'performance', 'statistics']
    }
  };
}
