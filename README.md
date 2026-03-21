# Shelby Dashboard

An investor-grade operating dashboard for a multi-brand QSF restaurant platform. Built with Next.js 15, Supabase, and Recharts.

## Features

- **Executive Overview**: 14+ KPIs, waterfall charts, and trend analysis.
- **Portfolio Performance**: Sortable, searchable, and exportable store-level performance table.
- **Segment Analysis**: Dimension-based performance breakdown (Concept, Region, Type).
- **Store-Level Detail**: Deep-dive analytics for individual stores including benchmark comparisons.
- **Margin & Cost Diagnostics**: Detailed cost structure analysis and efficiency scatter plots.
- **Data Upload**: Integrated Excel parser for easy monthly data ingestion via Supabase.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Visualization**: Recharts, TanStack Table
- **Backend/DB**: Supabase (PostgreSQL, Realtime)
- **Data**: XLSX (Excel Parser)

## Deployment on Vercel

### Prerequisites

- Supabase Project URL and Anon Key.
- GitHub repository connected to Vercel.

### Vercel Configuration

1. **Environment Variables**: Add the following variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase 프로젝트 URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase API anon key.

2. **Build Selection**: Ensure the build command is `npm run build` and the output directory is `.next`.

## Development

```bash
npm install
npm run dev
```

