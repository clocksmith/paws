/**
 * Themed Chart Widget Example
 *
 * Demonstrates all enhanced theming features:
 * 1. Extended color tokens (accent, data, semantic)
 * 2. Theme context API (getContrastRatio, adaptColor)
 * 3. Scoped theming (chrome vs content)
 * 4. Color adaptation helpers
 */

import type { Dependencies, ThemeInterface } from '@mwp/core/types/dependencies';
import type { MCPWidgetMetadata } from '@mwp/core/types/metadata';
import { ThemeUtils } from '@mwp/core/utils/theme-helpers';

interface ChartData {
  label: string;
  value: number;
  category: string;
}

class ThemedChartWidget extends HTMLElement {
  private shadow: ShadowRoot;
  private theme?: ThemeInterface;
  private chartData: ChartData[] = [];
  private customBrandColor = '#ff6b35'; // Widget's custom brand color
  private unsubscribeTheme?: () => void;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribeTheme?.();
  }

  /**
   * Initialize widget with host dependencies
   */
  async initialize(dependencies: Dependencies) {
    const { Theme, MCPBridge, EventBus } = dependencies;

    // Store theme reference
    this.theme = Theme;

    // Subscribe to theme changes for real-time updates
    if (Theme?.onChange) {
      this.unsubscribeTheme = Theme.onChange((newTheme) => {
        console.log('Theme changed:', newTheme.mode);
        this.updateThemeStyles();
      });
    }

    // Load sample data
    this.chartData = await this.loadChartData(MCPBridge);

    // Initial render
    this.render();
  }

  /**
   * Load chart data from MCP server
   */
  private async loadChartData(MCPBridge: any): Promise<ChartData[]> {
    // Simulated data - in real implementation, fetch from MCP server
    return [
      { label: 'API Calls', value: 1250, category: 'success' },
      { label: 'Errors', value: 45, category: 'error' },
      { label: 'Warnings', value: 120, category: 'warning' },
      { label: 'Cache Hits', value: 890, category: 'info' },
      { label: 'DB Queries', value: 340, category: 'success' },
    ];
  }

  /**
   * Render the widget
   */
  private render() {
    this.shadow.innerHTML = `
      ${this.getStyles()}
      ${this.getMarkup()}
    `;
  }

  /**
   * Update theme-dependent styles dynamically
   */
  private updateThemeStyles() {
    const styleEl = this.shadow.querySelector('style');
    if (styleEl) {
      styleEl.textContent = this.getStylesContent();
    }
  }

  /**
   * Get widget styles (demonstrating all theming features)
   */
  private getStyles(): string {
    return `<style>${this.getStylesContent()}</style>`;
  }

  private getStylesContent(): string {
    // Feature 2: Use adaptColor helper to adapt custom brand to theme mode
    const mode = this.theme?.mode === 'dark' ? 'dark' : 'light';
    const adaptedBrand = this.theme?.adaptColor
      ? this.theme.adaptColor(this.customBrandColor, {
          respectMode: true,
          targetContrast: 4.5, // WCAG AA compliance
        })
      : this.customBrandColor;

    // Feature 2: Check contrast ratio for accessibility
    const bgColor = mode === 'dark' ? '#1e1e1e' : '#ffffff';
    let contrastRatio = 1;
    if (this.theme?.getContrastRatio) {
      contrastRatio = this.theme.getContrastRatio(adaptedBrand, bgColor);
    } else {
      contrastRatio = ThemeUtils.getContrastRatio(adaptedBrand, bgColor);
    }

    const contrastWarning = contrastRatio < 4.5 ? '⚠️ Low contrast' : '✓ WCAG AA';

    return `
      /*
       * Feature 3: Scoped Theming
       * Widget chrome uses host theme tokens
       * Chart content preserves custom brand colors
       */

      :host {
        display: block;
        font-family: var(--mcp-font-family, system-ui);
        color: var(--mcp-text-primary, #000);
        background: var(--mcp-background, #fff);
        border-radius: var(--mcp-radius-md, 4px);
      }

      /* Chrome: Uses host theme */
      .widget-header {
        background: var(--mcp-surface, #f8f9fa);
        border-bottom: 1px solid var(--mcp-border, #dee2e6);
        padding: var(--mcp-spacing-md, 8px) var(--mcp-spacing-lg, 16px);
        color: var(--mcp-text-primary, #000);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .widget-title {
        font-size: var(--mcp-font-size-lg, 16px);
        font-weight: 600;
        margin: 0;
      }

      .brand-logo {
        /* Content: Preserves custom brand color (adapted to theme mode) */
        color: ${adaptedBrand};
        font-weight: bold;
        font-size: var(--mcp-font-size-sm, 12px);
      }

      .brand-logo::after {
        content: ' (${contrastWarning})';
        font-size: 10px;
        opacity: 0.7;
      }

      .widget-body {
        padding: var(--mcp-spacing-lg, 16px);
      }

      .chart-container {
        display: flex;
        flex-direction: column;
        gap: var(--mcp-spacing-md, 8px);
      }

      /*
       * Feature 1: Extended Color Tokens
       * Using data visualization colors from theme
       */
      .chart-row {
        display: flex;
        align-items: center;
        gap: var(--mcp-spacing-sm, 4px);
      }

      .chart-label {
        width: 120px;
        font-size: var(--mcp-font-size-sm, 12px);
        color: var(--mcp-text-secondary, #6c757d);
      }

      .chart-bar-container {
        flex: 1;
        height: 24px;
        background: var(--mcp-surface, #f8f9fa);
        border-radius: var(--mcp-radius-sm, 2px);
        overflow: hidden;
        position: relative;
      }

      .chart-bar {
        height: 100%;
        transition: width 0.3s ease;
        display: flex;
        align-items: center;
        padding: 0 var(--mcp-spacing-sm, 4px);
        font-size: var(--mcp-font-size-sm, 12px);
        color: white;
        font-weight: 600;
      }

      /* Using data colors (Feature 1) */
      .chart-bar:nth-child(1) { background: var(--mcp-data-1, #3b82f6); }
      .chart-bar:nth-child(2) { background: var(--mcp-data-2, #ef4444); }
      .chart-bar:nth-child(3) { background: var(--mcp-data-3, #10b981); }
      .chart-bar:nth-child(4) { background: var(--mcp-data-4, #f59e0b); }
      .chart-bar:nth-child(5) { background: var(--mcp-data-5, #8b5cf6); }

      .chart-value {
        width: 60px;
        text-align: right;
        font-size: var(--mcp-font-size-sm, 12px);
        font-weight: 600;
        color: var(--mcp-text-primary, #000);
      }

      /*
       * Feature 1: Semantic Color Gradients
       * Using semantic gradients for status indicators
       */
      .status-indicators {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--mcp-spacing-md, 8px);
        margin-top: var(--mcp-spacing-lg, 16px);
        padding-top: var(--mcp-spacing-lg, 16px);
        border-top: 1px solid var(--mcp-border, #dee2e6);
      }

      .status-card {
        padding: var(--mcp-spacing-sm, 4px) var(--mcp-spacing-md, 8px);
        border-radius: var(--mcp-radius-sm, 2px);
        font-size: var(--mcp-font-size-sm, 12px);
        font-weight: 500;
      }

      .status-success {
        background: var(--mcp-success-light, #d1fae5);
        border-left: 3px solid var(--mcp-success-dark, #065f46);
        color: var(--mcp-success-dark, #065f46);
      }

      .status-warning {
        background: var(--mcp-warning-light, #fef3c7);
        border-left: 3px solid var(--mcp-warning-dark, #92400e);
        color: var(--mcp-warning-dark, #92400e);
      }

      .status-error {
        background: var(--mcp-error-light, #fee2e2);
        border-left: 3px solid var(--mcp-error-dark, #991b1b);
        color: var(--mcp-error-dark, #991b1b);
      }

      .status-info {
        background: var(--mcp-info-light, #dbeafe);
        border-left: 3px solid var(--mcp-info-dark, #1e40af);
        color: var(--mcp-info-dark, #1e40af);
      }

      /*
       * Feature 1: Accent Colors
       * Using accent colors for tags/badges
       */
      .tags {
        display: flex;
        gap: var(--mcp-spacing-sm, 4px);
        flex-wrap: wrap;
        margin-top: var(--mcp-spacing-md, 8px);
      }

      .tag {
        padding: 2px var(--mcp-spacing-sm, 4px);
        border-radius: var(--mcp-radius-sm, 2px);
        font-size: 11px;
        font-weight: 500;
        color: white;
      }

      .tag:nth-child(1) { background: var(--mcp-accent-1, #6366f1); }
      .tag:nth-child(2) { background: var(--mcp-accent-2, #8b5cf6); }
      .tag:nth-child(3) { background: var(--mcp-accent-3, #ec4899); }
      .tag:nth-child(4) { background: var(--mcp-accent-4, #f59e0b); }
      .tag:nth-child(5) { background: var(--mcp-accent-5, #10b981); }

      /* Responsive adjustments */
      @media (max-width: 600px) {
        .chart-label {
          width: 80px;
          font-size: 11px;
        }
      }
    `;
  }

  /**
   * Get widget markup
   */
  private getMarkup(): string {
    const maxValue = Math.max(...this.chartData.map((d) => d.value));

    return `
      <div class="widget-container">
        <!-- Feature 3: Chrome section uses host theme -->
        <div class="widget-header">
          <h2 class="widget-title">Performance Metrics</h2>
          <div class="brand-logo">ACME Charts</div>
        </div>

        <!-- Feature 3: Content section with custom styling -->
        <div class="widget-body">
          <!-- Feature 1: Data visualization using data colors -->
          <div class="chart-container">
            ${this.chartData
              .map(
                (item, index) => `
              <div class="chart-row">
                <div class="chart-label">${item.label}</div>
                <div class="chart-bar-container">
                  <div class="chart-bar" style="width: ${(item.value / maxValue) * 100}%">
                    ${item.value}
                  </div>
                </div>
                <div class="chart-value">${item.value}</div>
              </div>
            `
              )
              .join('')}
          </div>

          <!-- Feature 1: Semantic gradients for status -->
          <div class="status-indicators">
            <div class="status-card status-success">✓ Uptime: 99.9%</div>
            <div class="status-card status-warning">⚠ Memory: 85%</div>
            <div class="status-card status-error">✗ Errors: 45</div>
            <div class="status-card status-info">ℹ Latency: 120ms</div>
          </div>

          <!-- Feature 1: Accent colors for tags -->
          <div class="tags">
            <span class="tag">Production</span>
            <span class="tag">Critical</span>
            <span class="tag">API</span>
            <span class="tag">Monitored</span>
            <span class="tag">Auto-scale</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Widget status for host
   */
  getStatus() {
    return {
      state: 'active' as const,
      primaryMetric: `${this.chartData.length} metrics`,
      secondaryMetric: 'Real-time monitoring',
      lastActivity: Date.now(),
      message: null,
    };
  }
}

// Register custom element
if (!customElements.get('mcp-themed-chart-widget')) {
  customElements.define('mcp-themed-chart-widget', ThemedChartWidget);
}

// Widget metadata
export const metadata: MCPWidgetMetadata = {
  protocolVersion: '1.0.0',
  element: 'mcp-themed-chart-widget',
  displayName: 'Themed Chart Widget',
  icon: '📊',
  category: 'MCP Servers',
  mcpServerName: 'analytics-server',
  transport: 'stdio',
  mcpProtocolVersion: '2025-06-18',
  capabilities: {
    tools: true,
    resources: true,
    prompts: false,
    sampling: false,
  },
  widgetType: 'server-panel',
  metadata: {
    description: 'Demonstrates enhanced theming features: extended colors, theme context API, scoped theming, and color adaptation',
    tags: ['example', 'theming', 'charts', 'visualization'],
    features: [
      'Extended color tokens (accent, data, semantic)',
      'Theme context API (getContrastRatio, adaptColor)',
      'Scoped theming (chrome vs content)',
      'Color adaptation helpers',
      'WCAG AA compliance checking',
    ],
  },
};

// Widget factory
export function createWidget(dependencies: Dependencies): ThemedChartWidget {
  const widget = new ThemedChartWidget();
  widget.initialize(dependencies);
  return widget;
}
