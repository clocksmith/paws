import type {
  Dependencies,
  MCPServerInfo,
  WidgetFactory,
  WidgetFactoryFunction,
} from '@mcp-wp/core';
import { WeatherWidget } from './widget.js';

const TAG = 'mcp-weather-widget';

const createWeatherWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  if (!customElements.get(TAG)) {
    customElements.define(TAG, WeatherWidget);
  }

  const element = document.createElement(TAG) as WeatherWidget;
  element.setDependencies(EventBus, MCPBridge, Configuration);
  element.setServerInfo(serverInfo);

  return {
    api: {
      initialize: () => element.initialize(),
      destroy: () => element.destroy(),
      refresh: () => element.refresh(),
    },
    widget: {
      protocolVersion: '1.0.0',
      element: TAG,
      displayName: 'Weather',
      description: 'Up-to-the-minute conditions and 12-hour forecast.',
      category: 'information',
      tags: ['weather', 'climate', 'forecast'],
      version: '0.1.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: ['current_weather', 'forecast_hourly'],
        },
      },
    },
  };
};

export default createWeatherWidget;
export { WeatherWidget };
