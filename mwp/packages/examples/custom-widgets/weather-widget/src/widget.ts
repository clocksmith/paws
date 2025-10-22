import type {
  Configuration,
  EventBus,
  MCPBridge,
  MCPServerInfo,
  ResourceUsage,
  UnsubscribeFunction,
  WidgetStatus,
} from '@mwp/core';
import { styles } from './styles.js';
import type { ForecastEntry, WeatherSnapshot, WeatherState } from './types.js';

const WEATHER_ICON_MAP: Record<string, string> = {
  clear: '☀️',
  partly_cloudy: '⛅️',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
  fog: '🌫️',
};

export class WeatherWidget extends HTMLElement {
  private eventBus!: EventBus;
  private bridge!: MCPBridge;
  private config!: Configuration;
  private serverInfo!: MCPServerInfo;
  private unsubscribers: UnsubscribeFunction[] = [];

  private state: WeatherState = {
    loading: true,
    error: null,
    forecast: [],
    unit: 'C',
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setDependencies(eventBus: EventBus, bridge: MCPBridge, configuration: Configuration): void {
    this.eventBus = eventBus;
    this.bridge = bridge;
    this.config = configuration;
  }

  setServerInfo(info: MCPServerInfo): void {
    this.serverInfo = info;
  }

  async initialize(): Promise<void> {
    this.render();
    await this.fetchWeather();
    this.registerRefreshListener();
  }

  async destroy(): Promise<void> {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  async refresh(): Promise<void> {
    await this.fetchWeather();
  }

  getStatus(): WidgetStatus {
    if (this.state.loading) {
      return { status: 'initializing', message: 'Fetching current conditions…' };
    }
    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
      };
    }
    return {
      status: 'healthy',
      message: `${this.state.snapshot?.location ?? 'Weather'} ready`,
      lastUpdate: this.state.lastUpdated,
    };
  }

  getResourceUsage(): ResourceUsage {
    return {
      domNodes: this.shadowRoot?.querySelectorAll('*').length ?? 0,
      memory: 0,
      renderTime: 0,
    };
  }

  private registerRefreshListener(): void {
    this.unsubscribers.push(
      this.eventBus.on('widget:refresh-requested', payload => {
        if (payload?.widgetId === this.id) {
          void this.fetchWeather();
        }
      })
    );
  }

  private async fetchWeather(): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const [current, forecast] = await Promise.all([
        this.bridge.callTool(this.serverInfo.serverName, 'current_weather', {
          unit: this.state.unit.toLowerCase(),
        }),
        this.bridge.callTool(this.serverInfo.serverName, 'forecast_hourly', {
          hours: 12,
          unit: this.state.unit.toLowerCase(),
        }),
      ]);

      const snapshot = this.toSnapshot(this.extractJSON(current));
      const forecastEntries = this.toForecast(this.extractJSON(forecast));

      this.setState({
        loading: false,
        snapshot,
        forecast: forecastEntries,
        lastUpdated: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch weather data';
      this.setState({ loading: false, error: message });
    }
  }

  private toSnapshot(payload: any): WeatherSnapshot {
    return {
      temperature: Number(payload?.temperature ?? 0),
      apparentTemperature: Number(payload?.apparentTemperature ?? payload?.feelsLike ?? 0),
      unit: (payload?.unit ?? this.state.unit) === 'f' ? 'F' : 'C',
      humidity: Number(payload?.humidity ?? 0),
      condition: payload?.condition ?? 'Unknown',
      icon: WEATHER_ICON_MAP[payload?.icon ?? 'clear'] ?? '🌤️',
      location: payload?.location ?? 'Unknown location',
      updatedAt: payload?.updatedAt ?? new Date().toISOString(),
    };
  }

  private toForecast(payload: any): ForecastEntry[] {
    const entries = Array.isArray(payload) ? payload : payload?.forecast ?? [];
    return entries.map((entry: any) => ({
      hour: entry.hour ?? entry.time ?? '00:00',
      temperature: Number(entry.temperature ?? 0),
      precipitationChance: Number(entry.precipitationChance ?? entry.precipChance ?? 0),
      icon: WEATHER_ICON_MAP[entry.icon ?? 'clear'] ?? '🌤️',
    }));
  }

  private extractJSON(result: any): any {
    if (!result) {
      return null;
    }
    if (Array.isArray(result.content)) {
      const json = result.content.find((item: any) => item.mimeType === 'application/json');
      if (json?.text) {
        try {
          return JSON.parse(json.text);
        } catch (error) {
          return null;
        }
      }
      const text = result.content.find((item: any) => item.text)?.text;
      if (text) {
        try {
          return JSON.parse(text);
        } catch (error) {
          return null;
        }
      }
    }
    return result;
  }

  private setState(partial: Partial<WeatherState>): void {
    this.state = { ...this.state, ...partial };
    this.render();
  }

  private toggleUnit(unit: 'C' | 'F'): void {
    if (this.state.unit === unit) {
      return;
    }
    this.setState({ unit });
    void this.fetchWeather();
  }

  private render(): void {
    if (!this.shadowRoot) {
      return;
    }

    const root = this.shadowRoot;
    root.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = styles;
    root.appendChild(style);

    const container = document.createElement('div');
    container.className = 'widget';
    root.appendChild(container);

    if (this.state.error) {
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = this.state.error;
      container.appendChild(error);
      return;
    }

    if (this.state.loading || !this.state.snapshot) {
      const loading = document.createElement('div');
      loading.className = 'meta';
      loading.textContent = 'Loading weather…';
      container.appendChild(loading);
      return;
    }

    container.appendChild(this.renderSnapshot());
    container.appendChild(this.renderForecast());
    container.appendChild(this.renderFooter());
  }

  private renderSnapshot(): HTMLElement {
    const snapshot = this.state.snapshot!;
    const card = document.createElement('div');
    card.className = 'snapshot';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = snapshot.icon;
    card.appendChild(icon);

    const text = document.createElement('div');

    const temp = document.createElement('div');
    temp.className = 'temperature';
    temp.textContent = `${Math.round(snapshot.temperature)}°${snapshot.unit}`;
    text.appendChild(temp);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${snapshot.condition} • Feels like ${Math.round(snapshot.apparentTemperature)}°${snapshot.unit} • Humidity ${snapshot.humidity}%`;
    text.appendChild(meta);

    card.appendChild(text);
    return card;
  }

  private renderForecast(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'forecast';

    if (!this.state.forecast.length) {
      const placeholder = document.createElement('div');
      placeholder.className = 'forecast-item';
      placeholder.textContent = 'No forecast available';
      list.appendChild(placeholder);
      return list;
    }

    this.state.forecast.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'forecast-item';
      item.innerHTML = `
        <strong>${entry.hour}</strong>
        <div>${entry.icon}</div>
        <div>${Math.round(entry.temperature)}°${this.state.unit}</div>
        <div>${Math.round(entry.precipitationChance)}% rain</div>
      `;
      list.appendChild(item);
    });

    return list;
  }

  private renderFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'footer';

    const updated = document.createElement('span');
    updated.textContent = `Updated ${this.state.lastUpdated?.toLocaleTimeString() ?? '—'}`;
    footer.appendChild(updated);

    const toggleContainer = document.createElement('div');

    const cButton = document.createElement('button');
    cButton.className = `unit-toggle${this.state.unit === 'C' ? ' active' : ''}`;
    cButton.textContent = '°C';
    cButton.addEventListener('click', () => this.toggleUnit('C'));
    toggleContainer.appendChild(cButton);

    const fButton = document.createElement('button');
    fButton.className = `unit-toggle${this.state.unit === 'F' ? ' active' : ''}`;
    fButton.textContent = '°F';
    fButton.addEventListener('click', () => this.toggleUnit('F'));
    toggleContainer.appendChild(fButton);

    footer.appendChild(toggleContainer);
    return footer;
  }
}
