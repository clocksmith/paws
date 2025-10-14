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
      convertToGeminiFunctionDeclarationPure,
    };
  }
};

// Legacy compatibility wrapper
const ToolRunnerPureHelpersModule = (() => {
  return ToolRunnerPureHelpers.factory({});
})();

// Export both formats
ToolRunnerPureHelpers;
ToolRunnerPureHelpersModule;