/**
 * Sequential Thinking Widget Component
 *
 * Web Component for Sequential Thinking MCP server interaction.
 */

import type { types } from '@mcp-wp/core';

type EventBus = types.EventBus;
type MCPBridge = types.MCPBridge;
type Configuration = types.Configuration;
type MCPServerInfo = types.MCPServerInfo;
type WidgetStatus = types.WidgetStatus;
type ResourceUsage = types.ResourceUsage;
type UnsubscribeFunction = types.UnsubscribeFunction;
import { styles } from './styles.js';
import type {
  ThinkingWidgetConfig,
  ThinkingSession,
  ThinkingStep,
  StepAnnotation,
  ExportFormat,
} from './types.js';

/**
 * Widget State
 */
interface WidgetState {
  currentSession: ThinkingSession | null;
  sessions: ThinkingSession[];
  selectedStep: ThinkingStep | null;
  view: 'session' | 'sessions-list';
  loading: boolean;
  error: string | null;
}

/**
 * Sequential Thinking Widget
 */
export class SequentialThinkingWidget extends HTMLElement {
  private eventBus!: EventBus;
  private mcpBridge!: MCPBridge;
  private config!: Configuration;
  private serverInfo!: MCPServerInfo;
  private widgetConfig: ThinkingWidgetConfig;

  private state: WidgetState = {
    currentSession: null,
    sessions: [],
    selectedStep: null,
    view: 'session',
    loading: false,
    error: null,
  };

  private unsubscribers: UnsubscribeFunction[] = [];
  private initTimestamp?: Date;
  private renderStartTime?: number;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.widgetConfig = {
      showTimings: true,
      showStepNumbers: true,
      compactMode: false,
      autoScroll: true,
      maxStepsDisplayed: 50,
      allowAnnotations: true,
      colorCode: {
        inProgress: '#f59e0b',
        completed: '#10b981',
        error: '#ef4444',
      },
      exportFormat: 'json',
    };
  }

  setDependencies(
    eventBus: EventBus,
    mcpBridge: MCPBridge,
    config: Configuration
  ): void {
    this.eventBus = eventBus;
    this.mcpBridge = mcpBridge;
    this.config = config;
  }

  setServerInfo(serverInfo: MCPServerInfo): void {
    this.serverInfo = serverInfo;
  }

  async initialize(): Promise<void> {
    this.initTimestamp = new Date();

    const savedConfig = this.config.get('thinkingWidget');
    if (savedConfig) {
      this.widgetConfig = { ...this.widgetConfig, ...savedConfig };
    }

    this.eventBus.emit('widget:initialized', {
      widgetId: this.id || 'thinking-widget',
      element: 'sequential-thinking-widget',
      serverName: this.serverInfo.serverName,
      timestamp: this.initTimestamp,
    });

    this.setupEventListeners();
    this.render();
  }

  async destroy(): Promise<void> {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.eventBus.emit('widget:destroyed', {
      widgetId: this.id || 'thinking-widget',
      element: 'sequential-thinking-widget',
      serverName: this.serverInfo.serverName,
      timestamp: new Date(),
    });

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  async refresh(): Promise<void> {
    if (this.state.currentSession) {
      await this.loadSession(this.state.currentSession.id);
    }
  }

  getStatus(): WidgetStatus {
    if (this.state.loading) {
      return { status: 'initializing', message: 'Loading...' };
    }

    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
        error: { code: 'WIDGET_ERROR', message: this.state.error },
      };
    }

    const stepCount = this.state.currentSession?.steps.length || 0;
    return {
      status: 'healthy',
      message: this.state.currentSession
        ? `${stepCount} thinking steps`
        : 'Ready',
      lastUpdate: new Date(),
    };
  }

  getResourceUsage(): ResourceUsage {
    const memory = this.estimateMemoryUsage();
    const domNodes = this.shadowRoot?.querySelectorAll('*').length || 0;

    return {
      memory,
      renderTime: this.renderStartTime ? Date.now() - this.renderStartTime : 0,
      domNodes,
    };
  }

  getCurrentSession(): ThinkingSession | null {
    return this.state.currentSession;
  }

  connectedCallback(): void {}
  disconnectedCallback(): void {}

  private setupEventListeners(): void {
    this.unsubscribers.push(
      this.eventBus.on('mcp:tool:invoked', (data: any) => {
        if (data.serverName === this.serverInfo.serverName) {
          this.handleToolResult(data);
        }
      })
    );

    this.unsubscribers.push(
      this.eventBus.on('mcp:tool:error', (data: any) => {
        if (data.serverName === this.serverInfo.serverName) {
          this.handleError(data.error);
        }
      })
    );
  }

  private async startSession(prompt: string, context?: string): Promise<void> {
    this.setState({ loading: true, error: null });

    this.eventBus.emit('thinking:session:started', {
      prompt,
      timestamp: new Date(),
    });

    try {
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'start_thinking',
        { prompt, context }
      );

      // Parse session from result
      const session: ThinkingSession = {
        id: this.generateId(),
        prompt,
        context,
        status: 'active',
        steps: [],
        totalDuration: 0,
        createdAt: new Date(),
      };

      this.setState({
        currentSession: session,
        sessions: [session, ...this.state.sessions],
        loading: false,
        view: 'session',
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  private async addStep(thought: string, conclusion?: string): Promise<void> {
    if (!this.state.currentSession) return;

    this.setState({ loading: true, error: null });

    try {
      const stepNumber = this.state.currentSession.steps.length + 1;
      const startTime = new Date();

      await this.mcpBridge.callTool(this.serverInfo.serverName, 'add_step', {
        sessionId: this.state.currentSession.id,
        thought,
        conclusion,
      });

      const step: ThinkingStep = {
        id: this.generateId(),
        number: stepNumber,
        thought,
        conclusion,
        status: conclusion ? 'completed' : 'in-progress',
        startTime,
        endTime: conclusion ? new Date() : undefined,
        duration: conclusion ? Date.now() - startTime.getTime() : undefined,
        annotations: [],
      };

      const updatedSession = {
        ...this.state.currentSession,
        steps: [...this.state.currentSession.steps, step],
      };

      this.setState({
        currentSession: updatedSession,
        loading: false,
      });

      this.eventBus.emit('thinking:step:added', {
        stepNumber,
        thought,
        timestamp: new Date(),
      });

      if (this.widgetConfig.autoScroll) {
        this.scrollToBottom();
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private async loadSession(sessionId: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'get_session',
        { sessionId }
      );

      // TODO: Parse session from result
      this.setState({ loading: false });
    } catch (error) {
      this.handleError(error);
    }
  }

  private exportSession(format: ExportFormat): void {
    if (!this.state.currentSession) return;

    const session = this.state.currentSession;
    let content = '';
    let filename = `thinking-session-${session.id}`;

    if (format === 'json') {
      content = JSON.stringify(session, null, 2);
      filename += '.json';
    } else if (format === 'markdown') {
      content = this.toMarkdown(session);
      filename += '.md';
    } else if (format === 'text') {
      content = this.toText(session);
      filename += '.txt';
    }

    this.downloadFile(content, filename);

    this.eventBus.emit('thinking:session:exported', {
      sessionId: session.id,
      format,
      timestamp: new Date(),
    });
  }

  private toMarkdown(session: ThinkingSession): string {
    let md = `# Thinking Session: ${session.prompt}\n\n`;
    if (session.context) md += `**Context:** ${session.context}\n\n`;
    md += `**Steps:** ${session.steps.length}\n\n`;
    md += `---\n\n`;

    session.steps.forEach(step => {
      md += `## Step ${step.number}\n\n`;
      md += `**Thought:** ${step.thought}\n\n`;
      if (step.conclusion) md += `**Conclusion:** ${step.conclusion}\n\n`;
      if (step.duration) md += `**Duration:** ${step.duration}ms\n\n`;
      md += `---\n\n`;
    });

    return md;
  }

  private toText(session: ThinkingSession): string {
    let text = `Thinking Session: ${session.prompt}\n`;
    if (session.context) text += `Context: ${session.context}\n`;
    text += `\n`;

    session.steps.forEach(step => {
      text += `Step ${step.number}:\n`;
      text += `  ${step.thought}\n`;
      if (step.conclusion) text += `  → ${step.conclusion}\n`;
      text += `\n`;
    });

    return text;
  }

  private downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.shadowRoot?.querySelector('.steps-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  private render(): void {
    if (!this.shadowRoot) return;

    this.renderStartTime = Date.now();

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="thinking-widget">
        <header class="widget-header">
          <h2>🧠 Sequential Thinking</h2>
          <div class="header-actions">
            <button class="icon-button" id="new-session-btn" title="New Session">+ New</button>
            <button class="icon-button" id="export-btn" title="Export" ${!this.state.currentSession ? 'disabled' : ''}>💾</button>
          </div>
        </header>

        ${this.renderContent()}
      </div>
    `;

    this.attachEventHandlers();
  }

  private renderContent(): string {
    if (this.state.loading) {
      return '<div class="loading">Loading...</div>';
    }

    if (this.state.error) {
      return `<div class="error">Error: ${this.state.error}</div>`;
    }

    if (!this.state.currentSession) {
      return this.renderNewSessionForm();
    }

    return this.renderSession();
  }

  private renderNewSessionForm(): string {
    return `
      <div class="new-session-form">
        <h3>Start New Thinking Session</h3>
        <input
          type="text"
          id="session-prompt"
          class="prompt-input"
          placeholder="What would you like to think about?"
        />
        <textarea
          id="session-context"
          class="context-input"
          placeholder="Additional context (optional)"
        ></textarea>
        <button class="start-button" id="start-session-btn">Start Thinking</button>
      </div>
    `;
  }

  private renderSession(): string {
    if (!this.state.currentSession) return '';

    const session = this.state.currentSession;

    return `
      <div class="session-view">
        <div class="session-header">
          <div class="session-info">
            <div class="session-prompt">${session.prompt}</div>
            ${session.context ? `<div class="session-context">${session.context}</div>` : ''}
          </div>
          <div class="session-meta">
            <span class="step-count">${session.steps.length} steps</span>
            ${session.totalDuration ? `<span class="total-duration">${session.totalDuration}ms</span>` : ''}
          </div>
        </div>

        <div class="steps-container">
          ${session.steps.length === 0 ? '<div class="empty">No thinking steps yet</div>' : ''}
          ${session.steps.map((step, idx) => this.renderStep(step, idx)).join('')}
        </div>

        <div class="add-step-form">
          <textarea
            id="new-step-thought"
            class="step-input"
            placeholder="Add a thinking step..."
          ></textarea>
          <div class="step-actions">
            <input
              type="text"
              id="new-step-conclusion"
              class="conclusion-input"
              placeholder="Conclusion (optional)"
            />
            <button class="add-step-button" id="add-step-btn">Add Step</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderStep(step: ThinkingStep, index: number): string {
    const statusClass = `step-${step.status}`;
    const statusIcon =
      step.status === 'completed' ? '✓' :
      step.status === 'in-progress' ? '⏳' : '✗';

    return `
      <div class="step ${statusClass}" data-step-id="${step.id}">
        ${this.widgetConfig.showStepNumbers ? `<div class="step-number">${step.number}</div>` : ''}
        <div class="step-content">
          <div class="step-thought">
            <span class="step-icon">${statusIcon}</span>
            ${step.thought}
          </div>
          ${step.conclusion ? `<div class="step-conclusion">→ ${step.conclusion}</div>` : ''}
          ${this.widgetConfig.showTimings && step.duration ? `<div class="step-duration">${step.duration}ms</div>` : ''}
        </div>
      </div>
    `;
  }

  private attachEventHandlers(): void {
    if (!this.shadowRoot) return;

    // New session
    const newSessionBtn = this.shadowRoot.getElementById('new-session-btn');
    newSessionBtn?.addEventListener('click', () => {
      this.setState({ currentSession: null, view: 'session' });
    });

    // Export
    const exportBtn = this.shadowRoot.getElementById('export-btn');
    exportBtn?.addEventListener('click', () => {
      this.exportSession(this.widgetConfig.exportFormat || 'json');
    });

    // Start session
    const startBtn = this.shadowRoot.getElementById('start-session-btn');
    const promptInput = this.shadowRoot.getElementById(
      'session-prompt'
    ) as HTMLInputElement;
    const contextInput = this.shadowRoot.getElementById(
      'session-context'
    ) as HTMLTextAreaElement;

    startBtn?.addEventListener('click', () => {
      if (promptInput?.value) {
        this.startSession(promptInput.value, contextInput?.value);
      }
    });

    // Add step
    const addStepBtn = this.shadowRoot.getElementById('add-step-btn');
    const thoughtInput = this.shadowRoot.getElementById(
      'new-step-thought'
    ) as HTMLTextAreaElement;
    const conclusionInput = this.shadowRoot.getElementById(
      'new-step-conclusion'
    ) as HTMLInputElement;

    addStepBtn?.addEventListener('click', () => {
      if (thoughtInput?.value) {
        this.addStep(thoughtInput.value, conclusionInput?.value || undefined);
        thoughtInput.value = '';
        if (conclusionInput) conclusionInput.value = '';
      }
    });
  }

  private setState(updates: Partial<WidgetState>): void {
    this.state = { ...this.state, ...updates };
    this.render();
  }

  private handleToolResult(data: any): void {
    console.log('Tool result:', data);
  }

  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.setState({ error: message, loading: false });

    this.eventBus.emit('widget:error', {
      widgetId: this.id || 'thinking-widget',
      element: 'sequential-thinking-widget',
      serverName: this.serverInfo.serverName,
      error: { code: 'WIDGET_ERROR', message },
      timestamp: new Date(),
    });
  }

  private estimateMemoryUsage(): number {
    const stateSize = JSON.stringify(this.state).length * 2;
    const domSize = (this.shadowRoot?.innerHTML.length || 0) * 2;
    return stateSize + domSize;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
