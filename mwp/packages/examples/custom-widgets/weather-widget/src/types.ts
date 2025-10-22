export interface WeatherSnapshot {
  temperature: number;
  apparentTemperature: number;
  unit: 'C' | 'F';
  humidity: number;
  condition: string;
  icon: string;
  location: string;
  updatedAt: string;
}

export interface ForecastEntry {
  hour: string;
  temperature: number;
  precipitationChance: number;
  icon: string;
}

export interface WeatherState {
  loading: boolean;
  error: string | null;
  snapshot?: WeatherSnapshot;
  forecast: ForecastEntry[];
  unit: 'C' | 'F';
  lastUpdated?: Date;
}
