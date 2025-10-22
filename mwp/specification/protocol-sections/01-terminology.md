## 1. Terminology

### 1.1 Definitions

**Model Context Protocol (MCP)**
An open protocol by Anthropic that standardizes how applications provide context to Large Language Models through servers exposing tools, resources, and prompts via JSON-RPC 2.0.

**MCP Server**
A process implementing the MCP specification that exposes tools, resources, and/or prompts. Examples: GitHub MCP server, Slack MCP server, Supabase MCP server.

**MCP Widget**
A Web Component that provides visual representation and interaction controls for a specific MCP server.

**MCP Tool**
A function exposed by an MCP server that can be invoked by AI agents. Defined by name, description, and JSON Schema for parameters.

**MCP Resource**
Read-only data exposed by an MCP server via URIs. Examples: file contents, API responses, database records.

**MCP Prompt**
Pre-defined prompt templates with arguments, exposed by MCP servers for reusable AI interactions.

**Widget Factory**
A JavaScript function that creates an MCP widget instance for a specific MCP server.

**Host Application**
The dashboard or UI application that loads, initializes, and renders MCP widgets.

**Transport**
The communication mechanism for MCP JSON-RPC messages. Either stdio (standard input/output) or http (HTTP POST).

---
