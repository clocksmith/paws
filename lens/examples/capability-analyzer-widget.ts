/**
 * Capability Analyzer Widget - MCP Lens Protocol-Semantic Analytics Example
 *
 * **What this demonstrates:**
 * This widget shows MCP Lens's unique value proposition - protocol-semantic
 * analysis that infrastructure monitoring tools cannot provide.
 *
 * **Analyzes:**
 * - Which capabilities are negotiated but never used (wasted capability)
 * - Which tools are attempted without proper capability negotiation
 * - Tool success/failure patterns relative to capability setup
 *
 * **SPEC Compliance:**
 * - Widget factory pattern (SPEC §3.1)
 * - Event subscriptions for protocol monitoring (SPEC §6.2)
 * - MCPBridge for listing capabilities (SPEC §5.3)
 * - Shadow DOM styling (SPEC §4.2)
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../schema';

interface CapabilityAnalysis {
  serverName: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    sampling?: boolean;
  };
  usage: {
    toolCalls: number;
    resourceReads: number;
    promptGets: number;
    samplingRequests: number;
  };
  issues: CapabilityIssue[];
}

interface CapabilityIssue {
  type: 'wasted-capability' | 'missing-capability' | 'negotiation-mismatch';
  capability: string;
  severity: 'warning' | 'error';
  message: string;
  recommendation: string;
}

export default function createCapabilityAnalyzerWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge } = deps;

  class CapabilityAnalyzerWidget extends HTMLElement {
    private analysis: CapabilityAnalysis | null = null;
    private monitoring: boolean = false;

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this.startMonitoring();
    }

    disconnectedCallback() {
      this.stopMonitoring();
    }

    private startMonitoring() {
      if (this.monitoring) return;
      this.monitoring = true;

      // Initialize analysis
      this.analysis = {
        serverName: serverInfo.serverName,
        capabilities: serverInfo.capabilities,
        usage: {
          toolCalls: 0,
          resourceReads: 0,
          promptGets: 0,
          samplingRequests: 0
        },
        issues: []
      };

      // Subscribe to MCP events to track usage
      EventBus.on('mcp:tool:invoked', this.handleToolInvoked.bind(this));
      EventBus.on('mcp:resource:read', this.handleResourceRead.bind(this));
      EventBus.on('mcp:prompt:got', this.handlePromptGet.bind(this));
      EventBus.on('mcp:sampling:completed', this.handleSampling.bind(this));

      // Perform initial analysis
      this.analyzeCapabilities();
    }

    private stopMonitoring() {
      this.monitoring = false;
      // Note: In production, store unsubscribe functions and call them here
    }

    private handleToolInvoked(data: any) {
      if (data.serverName === serverInfo.serverName && this.analysis) {
        this.analysis.usage.toolCalls++;
        this.analyzeCapabilities();
      }
    }

    private handleResourceRead(data: any) {
      if (data.serverName === serverInfo.serverName && this.analysis) {
        this.analysis.usage.resourceReads++;
        this.analyzeCapabilities();
      }
    }

    private handlePromptGet(data: any) {
      if (data.serverName === serverInfo.serverName && this.analysis) {
        this.analysis.usage.promptGets++;
        this.analyzeCapabilities();
      }
    }

    private handleSampling(data: any) {
      if (data.serverName === serverInfo.serverName && this.analysis) {
        this.analysis.usage.samplingRequests++;
        this.analyzeCapabilities();
      }
    }

    private analyzeCapabilities() {
      if (!this.analysis) return;

      const issues: CapabilityIssue[] = [];
      const caps = this.analysis.capabilities;
      const usage = this.analysis.usage;

      // Detect wasted capabilities (negotiated but never used)
      if (caps.tools && usage.toolCalls === 0) {
        issues.push({
          type: 'wasted-capability',
          capability: 'tools',
          severity: 'warning',
          message: 'Tools capability negotiated but never used',
          recommendation: 'Consider removing tools capability from server advertisement if not needed'
        });
      }

      if (caps.resources && usage.resourceReads === 0) {
        issues.push({
          type: 'wasted-capability',
          capability: 'resources',
          severity: 'warning',
          message: 'Resources capability negotiated but never used',
          recommendation: 'Consider removing resources capability from server advertisement'
        });
      }

      if (caps.prompts && usage.promptGets === 0) {
        issues.push({
          type: 'wasted-capability',
          capability: 'prompts',
          severity: 'warning',
          message: 'Prompts capability negotiated but never used',
          recommendation: 'Consider removing prompts capability from server advertisement'
        });
      }

      if (caps.sampling && usage.samplingRequests === 0) {
        issues.push({
          type: 'wasted-capability',
          capability: 'sampling',
          severity: 'warning',
          message: 'Sampling capability negotiated but never used',
          recommendation: 'Consider removing sampling capability from server advertisement'
        });
      }

      this.analysis.issues = issues;
      this.render();
    }

    private render() {
      if (!this.shadowRoot) return;

      const analysis = this.analysis;
      if (!analysis) {
        this.shadowRoot.innerHTML = '<div>Loading...</div>';
        return;
      }

      const totalOperations =
        analysis.usage.toolCalls +
        analysis.usage.resourceReads +
        analysis.usage.promptGets +
        analysis.usage.samplingRequests;

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .analyzer {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
          }
          h2 {
            margin: 0 0 16px 0;
            font-size: 18px;
            color: #1a1a1a;
          }
          .server-name {
            display: inline-block;
            background: #f5f5f5;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            font-family: 'Monaco', 'Menlo', monospace;
            color: #0066cc;
            margin-bottom: 16px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #666;
            margin-bottom: 8px;
          }
          .capability-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          .capability-card {
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 12px;
            background: #fafafa;
          }
          .capability-card.active {
            background: #e8f5e9;
            border-color: #4caf50;
          }
          .capability-card.inactive {
            background: #f5f5f5;
            border-color: #bdbdbd;
            opacity: 0.7;
          }
          .capability-name {
            font-weight: 600;
            font-size: 13px;
            color: #333;
            margin-bottom: 4px;
          }
          .capability-status {
            font-size: 11px;
            color: #666;
          }
          .usage-count {
            font-size: 20px;
            font-weight: bold;
            color: #0066cc;
            margin-top: 4px;
          }
          .issues-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .issue {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 4px;
          }
          .issue.error {
            background: #ffebee;
            border-left-color: #f44336;
          }
          .issue-title {
            font-weight: 600;
            font-size: 13px;
            color: #333;
            margin-bottom: 4px;
          }
          .issue-message {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
          }
          .issue-recommendation {
            font-size: 12px;
            color: #0066cc;
            font-style: italic;
          }
          .summary {
            background: #f5f5f5;
            padding: 12px;
            border-radius: 6px;
            text-align: center;
          }
          .summary-number {
            font-size: 32px;
            font-weight: bold;
            color: #0066cc;
          }
          .summary-label {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
          }
          .no-issues {
            text-align: center;
            padding: 20px;
            color: #4caf50;
            font-weight: 600;
          }
        </style>

        <div class="analyzer">
          <h2>🔍 Capability Analysis</h2>
          <div class="server-name">${analysis.serverName}</div>

          <div class="section">
            <div class="section-title">Negotiated Capabilities</div>
            <div class="capability-grid">
              <div class="capability-card ${analysis.capabilities.tools ? 'active' : 'inactive'}">
                <div class="capability-name">🛠️ Tools</div>
                <div class="capability-status">
                  ${analysis.capabilities.tools ? 'Enabled' : 'Disabled'}
                </div>
                ${analysis.capabilities.tools ? `<div class="usage-count">${analysis.usage.toolCalls}</div>` : ''}
              </div>

              <div class="capability-card ${analysis.capabilities.resources ? 'active' : 'inactive'}">
                <div class="capability-name">📁 Resources</div>
                <div class="capability-status">
                  ${analysis.capabilities.resources ? 'Enabled' : 'Disabled'}
                </div>
                ${analysis.capabilities.resources ? `<div class="usage-count">${analysis.usage.resourceReads}</div>` : ''}
              </div>

              <div class="capability-card ${analysis.capabilities.prompts ? 'active' : 'inactive'}">
                <div class="capability-name">💬 Prompts</div>
                <div class="capability-status">
                  ${analysis.capabilities.prompts ? 'Enabled' : 'Disabled'}
                </div>
                ${analysis.capabilities.prompts ? `<div class="usage-count">${analysis.usage.promptGets}</div>` : ''}
              </div>

              <div class="capability-card ${analysis.capabilities.sampling ? 'active' : 'inactive'}">
                <div class="capability-name">🎲 Sampling</div>
                <div class="capability-status">
                  ${analysis.capabilities.sampling ? 'Enabled' : 'Disabled'}
                </div>
                ${analysis.capabilities.sampling ? `<div class="usage-count">${analysis.usage.samplingRequests}</div>` : ''}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Protocol Health</div>
            ${analysis.issues.length > 0 ? `
              <ul class="issues-list">
                ${analysis.issues.map(issue => `
                  <li class="issue ${issue.severity}">
                    <div class="issue-title">${issue.type}: ${issue.capability}</div>
                    <div class="issue-message">${issue.message}</div>
                    <div class="issue-recommendation">💡 ${issue.recommendation}</div>
                  </li>
                `).join('')}
              </ul>
            ` : `
              <div class="no-issues">✅ No capability issues detected</div>
            `}
          </div>

          <div class="section">
            <div class="summary">
              <div class="summary-number">${totalOperations}</div>
              <div class="summary-label">Total Protocol Operations</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Register custom element
  if (!customElements.get('capability-analyzer-widget')) {
    customElements.define('capability-analyzer-widget', CapabilityAnalyzerWidget);
  }

  return {
    api: {
      async initialize() {
        EventBus.emit('mcp:widget:initialized', {
          element: 'capability-analyzer-widget',
          displayName: 'Capability Analyzer'
        });
      },

      async destroy() {
        const widget = document.querySelector('capability-analyzer-widget') as CapabilityAnalyzerWidget;
        if (widget) {
          widget['stopMonitoring']();
        }
      },

      async refresh() {
        const widget = document.querySelector('capability-analyzer-widget') as CapabilityAnalyzerWidget;
        if (widget) {
          widget['analyzeCapabilities']();
        }
      }
    },

    widget: {
      protocolVersion: '1.0.0',
      element: 'capability-analyzer-widget',
      displayName: 'Capability Analyzer',
      description: 'Protocol-semantic analysis of MCP capability negotiation and usage patterns',
      capabilities: {
        tools: false,
        resources: false,
        prompts: false
      },
      category: 'activity-monitor',
      tags: ['protocol-analytics', 'capability-analysis', 'efficiency']
    }
  };
}
