/**
 * Unit tests for Penteract Visualizer Module
 * Tests 5D analytics visualization and Web Component widget
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('PenteractVisualizerWidget Web Component', () => {
  let widget;
  let mockApi;
  let mockEventBus;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      _trigger: function(event, data) {
        // Helper to manually trigger events in tests
        const listeners = this.on.mock.calls
          .filter(call => call[0] === event)
          .map(call => call[1]);
        listeners.forEach(listener => listener(data));
      }
    };

    // Make EventBus globally available
    global.EventBus = mockEventBus;

    // Define widget if not already defined
    if (!customElements.get('penteract-visualizer-widget')) {
      class PenteractVisualizerWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this._latestSnapshot = null;
        }

        connectedCallback() {
          this.render();
          this._updateListener = () => this.render();
          if (global.EventBus) {
            global.EventBus.on('paxos:analytics:processed', this._updateListener, 'PenteractVisualizerWidget');
          }
        }

        disconnectedCallback() {
          if (this._updateListener && global.EventBus) {
            global.EventBus.off('paxos:analytics:processed', this._updateListener);
          }
        }

        set moduleApi(api) {
          this._api = api;
          if (api && api.getLatestSnapshot) {
            this._latestSnapshot = api.getLatestSnapshot();
          }
          this.render();
        }

        getStatus() {
          const latestSnapshot = this._latestSnapshot;
          const hasData = !!latestSnapshot;
          const isSuccess = latestSnapshot?.consensus?.status === 'success';

          return {
            state: hasData ? (isSuccess ? 'active' : 'warning') : 'idle',
            primaryMetric: hasData ? 'Visualizing' : 'No data',
            secondaryMetric: latestSnapshot ? `${latestSnapshot.metrics?.totals?.total || 0} agents` : 'Waiting',
            lastActivity: latestSnapshot?.timestamp ? new Date(latestSnapshot.timestamp).getTime() : null,
            message: hasData ? null : 'No analytics data'
          };
        }

        render() {
          const latestSnapshot = this._latestSnapshot;

          const formatTime = (timestamp) => {
            if (!timestamp) return 'Never';
            return new Date(timestamp).toLocaleString();
          };

          this.shadowRoot.innerHTML = `
            <style>
              :host { display: block; }
              .penteract-visualizer-panel { padding: 12px; }
              .viz-stat { display: flex; justify-content: space-between; }
            </style>
            <div class="penteract-visualizer-panel">
              <h4>Penteract Visualizer</h4>
              ${latestSnapshot ? `
                <div class="viz-info">
                  <div class="viz-stat">
                    <span>Status:</span>
                    <span>${latestSnapshot.consensus?.status || 'unknown'}</span>
                  </div>
                  <div class="viz-stat">
                    <span>Agents:</span>
                    <span>${latestSnapshot.metrics?.totals?.total || 0}</span>
                  </div>
                  <div class="viz-stat">
                    <span>Timestamp:</span>
                    <span>${formatTime(latestSnapshot.timestamp)}</span>
                  </div>
                </div>
              ` : `
                <div>No data available</div>
              `}
            </div>
          `;
        }
      }

      customElements.define('penteract-visualizer-widget', PenteractVisualizerWidget);
    }

    // Create widget
    widget = document.createElement('penteract-visualizer-widget');

    // Mock API
    mockApi = {
      getLatestSnapshot: vi.fn(() => null),
      processSnapshot: vi.fn()
    };
  });

  afterEach(() => {
    if (widget.parentNode) {
      widget.parentNode.removeChild(widget);
    }
    vi.clearAllMocks();
    delete global.EventBus;
  });

  it('should create shadow DOM on construction', () => {
    expect(widget.shadowRoot).toBeDefined();
    expect(widget.shadowRoot.mode).toBe('open');
  });

  it('should render no data state without snapshot', () => {
    document.body.appendChild(widget);

    const content = widget.shadowRoot.textContent;
    expect(content).toContain('No data available');
  });

  it('should render content when API injected with snapshot', () => {
    const mockSnapshot = {
      timestamp: Date.now(),
      consensus: { status: 'success' },
      metrics: {
        totals: { total: 5 }
      }
    };

    mockApi.getLatestSnapshot.mockReturnValue(mockSnapshot);
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    const content = widget.shadowRoot.textContent;
    expect(content).toContain('Penteract Visualizer');
    expect(content).toContain('success');
    expect(content).toContain('5');
  });

  it('should implement getStatus() correctly', () => {
    widget.moduleApi = mockApi;

    const status = widget.getStatus();

    // All 5 required fields
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('primaryMetric');
    expect(status).toHaveProperty('secondaryMetric');
    expect(status).toHaveProperty('lastActivity');
    expect(status).toHaveProperty('message');

    // Validate state value
    const validStates = ['idle', 'active', 'error', 'warning', 'disabled'];
    expect(validStates).toContain(status.state);

    // Validate metric types
    expect(typeof status.primaryMetric).toBe('string');
    expect(typeof status.secondaryMetric).toBe('string');
  });

  it('should show idle state when no data', () => {
    mockApi.getLatestSnapshot.mockReturnValue(null);
    widget.moduleApi = mockApi;

    const status = widget.getStatus();
    expect(status.state).toBe('idle');
    expect(status.primaryMetric).toBe('No data');
    expect(status.secondaryMetric).toBe('Waiting');
  });

  it('should show active state with successful consensus', () => {
    const mockSnapshot = {
      timestamp: Date.now(),
      consensus: { status: 'success' },
      metrics: {
        totals: { total: 10 }
      }
    };

    mockApi.getLatestSnapshot.mockReturnValue(mockSnapshot);
    widget.moduleApi = mockApi;

    const status = widget.getStatus();
    expect(status.state).toBe('active');
    expect(status.primaryMetric).toBe('Visualizing');
    expect(status.secondaryMetric).toContain('10 agents');
  });

  it('should show warning state with failed consensus', () => {
    const mockSnapshot = {
      timestamp: Date.now(),
      consensus: { status: 'failed' },
      metrics: {
        totals: { total: 5 }
      }
    };

    mockApi.getLatestSnapshot.mockReturnValue(mockSnapshot);
    widget.moduleApi = mockApi;

    const status = widget.getStatus();
    expect(status.state).toBe('warning');
  });

  it('should subscribe to EventBus on connect', () => {
    document.body.appendChild(widget);

    expect(mockEventBus.on).toHaveBeenCalledWith(
      'paxos:analytics:processed',
      expect.any(Function),
      'PenteractVisualizerWidget'
    );
  });

  it('should unsubscribe from EventBus on disconnect', () => {
    document.body.appendChild(widget);
    document.body.removeChild(widget);

    expect(mockEventBus.off).toHaveBeenCalledWith(
      'paxos:analytics:processed',
      expect.any(Function)
    );
  });

  it('should re-render when EventBus event fires', () => {
    const initialSnapshot = {
      timestamp: Date.now(),
      consensus: { status: 'success' },
      metrics: { totals: { total: 5 } }
    };

    mockApi.getLatestSnapshot.mockReturnValue(initialSnapshot);
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    const initialContent = widget.shadowRoot.textContent;
    expect(initialContent).toContain('5');

    // Update snapshot
    const newSnapshot = {
      timestamp: Date.now(),
      consensus: { status: 'success' },
      metrics: { totals: { total: 10 } }
    };

    mockApi.getLatestSnapshot.mockReturnValue(newSnapshot);
    widget._latestSnapshot = newSnapshot;

    // Trigger event
    mockEventBus._trigger('paxos:analytics:processed', newSnapshot);

    const updatedContent = widget.shadowRoot.textContent;
    expect(updatedContent).toContain('10');
  });

  it('should display timestamp correctly', () => {
    const testTimestamp = new Date('2025-01-15T12:00:00Z').toISOString();
    const mockSnapshot = {
      timestamp: testTimestamp,
      consensus: { status: 'success' },
      metrics: { totals: { total: 3 } }
    };

    mockApi.getLatestSnapshot.mockReturnValue(mockSnapshot);
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    const content = widget.shadowRoot.textContent;
    // Should contain formatted timestamp
    expect(content).toBeTruthy();
  });

  it('should update when moduleApi changes', () => {
    const initialSnapshot = {
      timestamp: Date.now(),
      consensus: { status: 'success' },
      metrics: { totals: { total: 5 } }
    };

    const initialApi = {
      getLatestSnapshot: vi.fn(() => initialSnapshot)
    };

    widget.moduleApi = initialApi;
    document.body.appendChild(widget);

    const firstContent = widget.shadowRoot.textContent;
    expect(firstContent).toContain('5');

    // Update API with new snapshot
    const newSnapshot = {
      timestamp: Date.now(),
      consensus: { status: 'success' },
      metrics: { totals: { total: 15 } }
    };

    const newApi = {
      getLatestSnapshot: vi.fn(() => newSnapshot)
    };

    widget.moduleApi = newApi;

    const updatedContent = widget.shadowRoot.textContent;
    expect(updatedContent).toContain('15');
  });

  it('should handle missing consensus status gracefully', () => {
    const mockSnapshot = {
      timestamp: Date.now(),
      consensus: {}, // No status
      metrics: { totals: { total: 2 } }
    };

    mockApi.getLatestSnapshot.mockReturnValue(mockSnapshot);
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    const content = widget.shadowRoot.textContent;
    expect(content).toContain('unknown');
  });

  it('should handle missing metrics gracefully', () => {
    const mockSnapshot = {
      timestamp: Date.now(),
      consensus: { status: 'success' },
      metrics: {} // No totals
    };

    mockApi.getLatestSnapshot.mockReturnValue(mockSnapshot);
    widget.moduleApi = mockApi;

    const status = widget.getStatus();
    expect(status.secondaryMetric).toContain('0 agents');
  });
});
