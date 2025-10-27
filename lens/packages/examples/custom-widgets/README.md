# Custom Widget Tutorial – Weather Dashboard

This tutorial walks through building a custom MWP widget that fetches weather data from an external API and renders it with Shadow DOM styling.

## 1. Scaffold

```bash
cd packages/examples/custom-widgets
pnpm create-mwp-widget weather-widget
```

The `weather-widget` example included here mirrors the output of the CLI scaffold with additional wiring and comments.

## 2. Dependency Injection

Every widget factory receives host-provided dependencies:

```ts
export default function createWeatherWidget({ EventBus, MCPBridge, Configuration }, serverInfo) {
  // ...
}
```

- `EventBus` for emitting host events (refresh, logging, confirmation)
- `MCPBridge` for calling the weather MCP server tools (`current_weather`, `forecast_daily`, etc.)
- `Configuration` for reading host preferences (units, theme, localisation)

## 3. Widget Factory

See [`weather-widget/src/index.ts`](./weather-widget/src/index.ts) for the complete factory. Highlights:

- Registers the custom element if it does not exist
- Injects dependencies and server info onto the element
- Exposes lifecycle methods `initialize`, `destroy`, `refresh`
- Declares widget metadata (protocol version, permissions, tags)

## 4. Web Component Implementation

The component (`weather-widget/src/widget.ts`) demonstrates:

- **Shadow DOM styling** via `adoptedStyleSheets`
- **Safe rendering** (`textContent`, templating helpers)
- **Tool invocation** using `bridge.callTool` with JSON schema validation
- **Event-driven updates** (listening to `mcp:server:update` and `widget:refresh-requested`)

## 5. External API Integration

The weather MCP server is a thin wrapper around a REST API. The widget leverages tools:

- `current_weather` – retrieves temperature, humidity, conditions
- `forecast_hourly` – returns the next 12 hours with icons

The tutorial shows how to:

1. Call a tool and parse JSON payloads
2. Handle errors gracefully (retry, error badges)
3. Convert units (°C/°F) via host configuration

## 6. Styling

- Uses CSS custom properties (`--mcp-*`) for theming
- Demonstrates scoped component styling and iconography
- Includes responsive layout for narrow vs wide tiles

## 7. Testing & Debugging

- **Unit tests:** recommended to mount the custom element with `@testing-library/dom`
- **Network debugging:** use the MCP server’s debug mode to inspect outgoing requests
- **Event logging:** listen to `widget:status` events in the host for troubleshooting

## Files

```
weather-widget/
  README.md               # Quick start for the widget itself
  src/
    index.ts              # Widget factory
    widget.ts             # Web Component implementation
    styles.ts             # CSS module
    types.ts              # TypeScript interfaces
```

Feel free to copy the example into your own package or use it as reference while the CLI scaffold evolves.
