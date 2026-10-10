# AgriVision — Smart Agribusiness Analytics Dashboard

AgriVision is an internship portfolio project that converts crop-production data into transparent visualizations, forecasts, KPI evaluations, and evidence-based recommendations.

## Features

- Live default data from Our World in Data Grapher, with FAOSTAT documented as the underlying source.
- CSV upload with schema validation and cleaning for missing, duplicate, malformed, and negative-production records.
- Overview and visualization workspaces with trend, bar, and histogram charts.
- Filters for geography, crop, and year.
- Chronological moving-average forecasting with limitations clearly explained.
- KPI evaluation for production, growth, concentration, yield, revenue, costs, profit, farmer income, water productivity, sustainability, and weather-risk availability.
- Rule-based recommendations linked to the active dataset.
- Methodology and data-source documentation inside the dashboard.

## Technology

- Frontend: Next.js 14, React, TypeScript, Recharts, Papa Parse, and CSS.
- Backend: FastAPI, Pandas, NumPy, and scikit-learn.
- Current persistence: one cleaned active dataset in backend memory.
- Planned persistence: PostgreSQL.

## Requirements

- Node.js 18 or newer
- npm
- Python 3.10 or newer
- Internet access for the default live OWID data

## Run locally

Install frontend dependencies:

```powershell
cd "D:\Agri Vision"
npm install
```

Install backend dependencies:

```powershell
cd "D:\Agri Vision\backend"
& "C:\Users\Dushy\AppData\Local\Programs\Python\Python310\python.exe" -m pip install -r requirements.txt
```

Start the backend in the first PowerShell window:

```powershell
cd "D:\Agri Vision\backend"
.\run.ps1
```

Start the frontend in a second PowerShell window:

```powershell
cd "D:\Agri Vision"
npm run dev
```

Open the dashboard at http://localhost:3000.

Open the interactive API documentation at http://127.0.0.1:8000/docs.

The frontend uses `http://127.0.0.1:8000` by default. To use another API URL, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL`. If the backend is unavailable, the frontend uses its local CSV validation fallback.

## Production run

```powershell
cd "D:\Agri Vision"
npm run build
npm start
```

## Backend API

- `GET /health` — service health check.
- `POST /api/data/upload` — clean and activate an uploaded CSV.
- `GET /api/data/summary` — active dataset summary.
- `GET /api/data/trends` — yearly production trends.
- `GET /api/forecast` — chronological forecast and error metrics.
- `GET /api/kpis` — calculated KPI values and availability statuses.
- `GET /api/recommendations` — rule-based recommendations.
- `GET /api/methodology` — active dataset methodology details.

Uploading a new CSV replaces the active in-memory dataset. All subsequent analytics use the cleaned uploaded data.

## CSV format

Required columns:

```text
Year
Production
```

Recognized descriptive columns:

```text
Country or State
Crop
Season
Area
```

Optional columns for extended KPI analysis:

```text
Quantity_Sold
Selling_Price
Revenue
Total_Cost
Farmer_Income
Water_Used
Fertilizer_Used
Pesticide_Used
Carbon_Emissions
Rainfall
Temperature
Drought_Index
Flood_Events
Heatwave_Days
```

Column names are matched flexibly by the backend. Missing optional fields are shown as unavailable; the application does not invent financial, sustainability, or weather values.

## Data cleaning

The upload pipeline:

1. Checks that `Year` and `Production` are present.
2. Converts numeric fields to numeric values.
3. Removes rows with missing required values.
4. Removes negative production and invalid years.
5. Removes duplicate records.
6. Preserves valid optional KPI fields.
7. Reports records before and after cleaning.

## Data source and methodology

The default dashboard loads rice, maize, wheat, and soybean production from the **Our World in Data Grapher**. OWID identifies FAOSTAT as the underlying source. OWID is a third-party presentation/mirror layer, not the official FAO application.

Source documentation: https://ourworldindata.org/agricultural-production

Forecasting uses a transparent five-year moving-average baseline. It is not a causal model and does not account for weather, prices, policy, land-area changes, or unexpected shocks. Production growth and crop concentration are descriptive indicators, not guarantees of future performance.

Profit requires revenue and total cost. Yield requires production and positive cultivated area. Sustainability and weather-risk statuses depend on the corresponding uploaded fields. These metrics are intentionally not estimated when their required inputs are missing.

## Project structure

```text
Agri Vision/
├── app/
│   ├── page.tsx
│   ├── globals.css
│   └── layout.tsx
├── backend/
│   ├── app/
│   │   ├── analytics.py
│   │   └── main.py
│   ├── requirements.txt
│   └── run.ps1
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
└── README.md
```

## Security and repository hygiene

- Never commit `.env`, `.env.local`, API keys, passwords, certificates, private keys, or production configuration.
- Do not commit uploaded farmer or operational datasets unless they are sanitized and explicitly intended for publication.
- Keep dependencies installed locally and do not commit `node_modules`, Python virtual environments, caches, or build output.
- Use environment variables for configurable API URLs and future database credentials.

## Current limitations and next steps

- The backend stores one active cleaned dataset in memory and loses it when restarted.
- PostgreSQL persistence and user authentication are not implemented yet.
- Forecasts are baseline estimates and should not be treated as guaranteed outcomes.
- Profitability and sustainability depend on the quality, units, and provenance of uploaded columns.
- Add automated backend tests for cleaning, KPI availability, forecasting, and recommendation rules before deployment.
# Agri-Vision
