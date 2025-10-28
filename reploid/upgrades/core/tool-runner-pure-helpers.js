// @blueprint 0x00000B - Outlines converting internal tool definitions to external LLM API formats.
// Standardized Tool Runner Pure Helpers Module for REPLOID
// Pure functions for tool definition conversion

const ToolRunnerPureHelpers = {
  metadata: {
    id: 'ToolRunnerPureHelpers',
    version: '1.0.0',
    dependencies: [],  // No dependencies - pure module
    async: false,
    type: 'pure'
  },
  
  factory: (deps = {}) => {
    function mapMcpTypeToGeminiPure(mcpType) {
      switch (mcpType?.toLowerCase()) {
        case "string": return "STRING";
        case "integer": return "INTEGER";
        case "number": return "NUMBER";
        case "boolean": return "BOOLEAN";
        case "array": return "ARRAY";
        case "object": return "OBJECT";
        default: return "TYPE_UNSPECIFIED";
      }
    }

    function convertMcpPropertiesToGeminiPure(mcpProps) {
      if (!mcpProps) return {};
      const geminiProps = {};
      for (const key in mcpProps) {
        const mcpProp = mcpProps[key];
        geminiProps[key] = {
          type: mapMcpTypeToGeminiPure(mcpProp.type),
          description: mcpProp.description || "",
        };
        if (mcpProp.enum) geminiProps[key].enum = mcpProp.enum;
        if (mcpProp.type === "array" && mcpProp.items) {
          geminiProps[key].items = { type: mapMcpTypeToGeminiPure(mcpProp.items.type) };
        }
        if (mcpProp.type === "object" && mcpProp.properties) {
          geminiProps[key].properties = convertMcpPropertiesToGeminiPure(mcpProp.properties);
          if (mcpProp.required) geminiProps[key].required = mcpProp.required;
        }
      }
      return geminiProps;
    }

    function convertToGeminiFunctionDeclarationPure(mcpToolDefinition) {
      if (!mcpToolDefinition || !mcpToolDefinition.name || !mcpToolDefinition.description) {
        return null;
      }
      return {
        name: mcpToolDefinition.name,
        description: mcpToolDefinition.description,
        parameters: {
          type: "OBJECT",
          properties: convertMcpPropertiesToGeminiPure(mcpToolDefinition.inputSchema?.properties),
          required: mcpToolDefinition.inputSchema?.required || [],
        },
      };
    }

    // Public API
    return {
      api: {
        convertToGeminiFunctionDeclarationPure,
        // Expose internal functions for testing
        _test: {
          mapMcpTypeToGeminiPure,
          convertMcpPropertiesToGeminiPure,
        }
      },

      widget: {
        element: 'tool-runner-pure-helpers-widget',
        displayName: 'Tool Runner Helpers (Pure)',
        icon: '⚒',
        category: 'core',
        updateInterval: null // No updates needed for pure module
      }
    };
  }
};

// Web Component for Tool Runner Pure Helpers Widget
class ToolRunnerPureHelpersWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    return {
      state: 'idle',
      primaryMetric: 'Pure helpers',
      secondaryMetric: 'Stateless',
      lastActivity: null,
      message: 'Pure conversion functions for tool definitions'
    };
  }

  render() {
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

        h3 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #4fc3f7;
        }

        .function-item {
          padding: 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .function-item strong {
          color: #4fc3f7;
        }

        .function-desc {
          color: #888;
          font-size: 0.9em;
          margin-top: 4px;
        }

        .info-panel {
          margin-top: 16px;
          padding: 12px;
          border-radius: 4px;
        }

        .info-panel.primary {
          background: rgba(100,150,255,0.1);
          border-left: 3px solid #6496ff;
        }

        .info-panel.secondary {
          background: rgba(255,165,0,0.1);
          border-left: 3px solid #ffa500;
        }

        .info-panel strong {
          display: block;
          margin-bottom: 6px;
          color: #fff;
        }

        .info-panel div {
          color: #aaa;
          font-size: 0.9em;
        }
      </style>

      <div class="widget-panel">
        <h3>◊ Available Helper Functions</h3>

        <div class="function-item">
          <strong>convertToGeminiFunctionDeclarationPure()</strong>
          <div class="function-desc">
            Convert MCP tool definition to Gemini function declaration format
          </div>
        </div>

        <div class="function-item">
          <strong>mapMcpTypeToGeminiPure()</strong>
          <div class="function-desc">
            Map MCP type to Gemini type (STRING, INTEGER, NUMBER, etc.)
          </div>
        </div>

        <div class="function-item">
          <strong>convertMcpPropertiesToGeminiPure()</strong>
          <div class="function-desc">
            Convert MCP properties object to Gemini properties format
          </div>
        </div>

        <div class="info-panel primary">
          <strong>ⓘ Pure Module</strong>
          <div>
            This module contains only pure functions for converting tool definitions
            from MCP format to provider-specific formats (currently Gemini).
          </div>
        </div>

        <div class="info-panel secondary">
          <strong>↻ Supported Conversions</strong>
          <div>
            MCP → Gemini function declarations<br>
            Handles nested objects, arrays, enums, and required fields
          </div>
        </div>
      </div>
    `;
  }
}

// Define the custom element
if (!customElements.get('tool-runner-pure-helpers-widget')) {
  customElements.define('tool-runner-pure-helpers-widget', ToolRunnerPureHelpersWidget);
}

export default ToolRunnerPureHelpers;
export const ToolRunnerPureHelpersModule = ToolRunnerPureHelpers;
