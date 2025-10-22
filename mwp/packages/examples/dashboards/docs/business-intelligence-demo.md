# Business Intelligence Console

Visualise Supabase analytics data, capture insights, and broadcast KPIs.

## Components

- **Supabase widget** – query builder, schema browser, realtime monitors
- **Memory widget** – notebooks for insights and action items
- **Themed chart widget** – renders KPI rollups with enhanced theming tokens

## Suggested Datasets

- `analytics.orders_summary`
- `analytics.customer_ltv`
- `analytics.subscription_mrr`

## Workflow

1. Run queries in Supabase widget (e.g., weekly revenue, churn rate).
2. Use event bridge to log summaries directly into Memory.
3. Link chart widget dataset to Supabase materialized view for live trend visualisation.

## Exporting Reports

- Use Memory widget CSV/Markdown export for sharing.
- Charts widget supports PNG export via host context menu.
- Combine with Sequential-Thinking (optional) for automated commentary.
