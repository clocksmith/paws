// @blueprint 0x00000C - Explains using a Web Worker for secure, sandboxed tool execution.
let messageCallbacks = {};
let messageIdCounter = 0;

self.onmessage = async (event) => {
  const { type, payload, id, data, error } = event.data;

  if (type === "init") {
    const { toolCode, toolArgs } = payload;
    try {
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;
      const func = new AsyncFunction(
        "params",
        "LS",
        "StateManager",
        toolCode + "\n\nreturn await run(params);"
      );
      const result = await func(toolArgs, self.LS_shim, self.StateManager_shim);
      self.postMessage({ success: true, result: result });
    } catch (e) {
      const errorDetail = {
        message: e.message || "Unknown worker execution error",
        stack: e.stack,
        name: e.name,
      };
      self.postMessage({ success: false, error: errorDetail });
    }
  } else if (type === "response") {
    const callback = messageCallbacks[id];
    if (callback) {
      if (error) {
        callback.reject(
          new Error(error.message || "Worker shim request failed")
        );
      } else {
        callback.resolve(data);
      }
      delete messageCallbacks[id];
    }
  }
};

function makeShimRequest(requestType, payload) {
  return new Promise((resolve, reject) => {
    const id = messageIdCounter++;
    messageCallbacks[id] = { resolve, reject };
    self.postMessage({
      type: "request",
      id: id,
      requestType: requestType,
      payload: payload,
    });
  });
}

self.LS_shim = {
  getArtifactContent: (id, cycle, versionId = null) => {
    if (
      typeof id !== "string" ||
      typeof cycle !== "number" ||
      (versionId !== null && typeof versionId !== "string")
    ) {
      return Promise.reject(
        new Error("Invalid arguments for getArtifactContent")
      );
    }
    return makeShimRequest("getArtifactContent", { id, cycle, versionId });
  },
};

self.StateManager_shim = {
  getArtifactMetadata: (id, versionId = null) => {
    if (
      typeof id !== "string" ||
      (versionId !== null && typeof versionId !== "string")
    ) {
      return Promise.reject(
        new Error("Invalid arguments for getArtifactMetadata")
      );
    }
    return makeShimRequest("getArtifactMetadata", { id, versionId });
  },
  getArtifactMetadataAllVersions: (id) => {
    if (typeof id !== "string") {
      return Promise.reject(
        new Error("Invalid arguments for getArtifactMetadataAllVersions")
      );
    }
    return makeShimRequest("getArtifactMetadataAllVersions", { id });
  },
  getAllArtifactMetadata: () => {
    return makeShimRequest("getAllArtifactMetadata", {});
  },
};

// ============================================
// WEB COMPONENT WIDGET (for main thread visualization)
// ============================================
// This code only runs in the main thread, not in the worker
if (typeof HTMLElement !== 'undefined' && typeof window !== 'undefined') {
  class ToolWorkerWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 2000);
    }

    disconnectedCallback() {
      if (this._interval) {
        clearInterval(this._interval);
        this._interval = null;
      }
    }

    getStatus() {
      // Query the ToolRunner manager for worker status
      const toolRunner = window.app?.modules?.ToolRunner;

      if (!toolRunner) {
        return {
          state: 'disabled',
          primaryMetric: 'Not loaded',
          secondaryMetric: 'Runner missing',
          lastActivity: null,
          message: 'ToolRunner module not available'
        };
      }

      // Get tool execution statistics
      const stats = toolRunner.getExecutionStats?.() || {};
      const activeTools = stats.activeTools || 0;
      const totalExecuted = stats.totalExecuted || 0;
      const failureCount = stats.failures || 0;
      const lastExecutionTime = stats.lastExecutionTime || null;

      const hasFailures = failureCount > 0;
      const isActive = activeTools > 0;

      return {
        state: hasFailures ? 'warning' : (isActive ? 'active' : 'idle'),
        primaryMetric: `${activeTools} active`,
        secondaryMetric: `${totalExecuted} total executed`,
        lastActivity: lastExecutionTime,
        message: hasFailures ? `${failureCount} failures` : null
      };
    }

    render() {
      const status = this.getStatus();

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: monospace;
            font-size: 12px;
            color: #e0e0e0;
          }

          .worker-panel {
            background: rgba(255, 255, 255, 0.05);
            padding: 16px;
            border-radius: 8px;
            border-left: 3px solid #4169e1;
          }

          h3 {
            margin: 0 0 12px 0;
            font-size: 14px;
            color: #4169e1;
          }

          .status-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .label {
            color: #888;
          }

          .value {
            font-weight: bold;
          }

          .value-idle { color: #0f0; }
          .value-active { color: #0ff; }
          .value-warning { color: #ff0; }
          .value-error { color: #f00; }
          .value-disabled { color: #888; }

          .message {
            margin-top: 8px;
            padding: 8px;
            background: rgba(255, 255, 0, 0.1);
            border-radius: 4px;
            font-size: 11px;
            color: #ff0;
          }
        </style>

        <div class="worker-panel">
          <h3>🛠️ Tool Worker</h3>

          <div class="status-row">
            <span class="label">Status:</span>
            <span class="value value-${status.state}">${status.state.toUpperCase()}</span>
          </div>

          <div class="status-row">
            <span class="label">Active:</span>
            <span class="value">${status.primaryMetric}</span>
          </div>

          <div class="status-row">
            <span class="label">Executed:</span>
            <span class="value">${status.secondaryMetric}</span>
          </div>

          ${status.message ? `<div class="message">⚠️ ${status.message}</div>` : ''}
        </div>
      `;
    }
  }

  // Register the custom element
  const elementName = 'tool-worker-widget';
  if (!customElements.get(elementName)) {
    customElements.define(elementName, ToolWorkerWidget);
  }

  // Export widget configuration for module registry
  if (typeof window !== 'undefined') {
    window.ToolWorkerWidget = {
      element: elementName,
      displayName: 'Tool Worker',
      icon: '🛠️',
      category: 'worker'
    };
  }
}

export default ToolWorker;