# Weather Widget Example

A fully annotated example MCP-WP widget that renders current weather conditions and a 12-hour forecast.

## Features

- Current temperature card with units toggle
- Forecast list with weather icons
- Auto-refresh every 10 minutes or on user request
- Error badges when the weather API fails or rate-limits
- Shadow DOM styling with host theme integration

## MCP Tools Used

- `current_weather` – returns `{ temperature, humidity, condition, icon }`
- `forecast_hourly` – returns `[ { hour, temperature, icon, precipitationChance } ]`

## Try It

```bash
pnpm install
pnpm --filter examples:custom-widgets dev
```

Then launch your dashboard pointing at `packages/examples/custom-widgets/weather-widget/demo.config.json`.

You will need a weather MCP server or compatible REST bridge. Set `WEATHER_API_KEY` in your environment before starting the server.
