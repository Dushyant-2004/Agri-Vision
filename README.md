# AgriVision

AgriVision is a smart agribusiness analytics dashboard for exploring crop-production data, evaluating operational KPIs, and producing decision-ready reports. It combines a Next.js frontend with a FastAPI analytics service and uses live Our World in Data (OWID) Grapher data by default.

## What it includes

- Production overview with KPI cards, trends, ranked comparisons, crop concentration, and geography.
- Visualization workspace with line, bar, histogram, distribution, and growth-rate views.
- Filters for geography, crop, and year.
- CSV and selectable-text PDF import with validation, cleaning, duplicate removal, and data-quality reporting.
- Five-year moving-average forecasts with chronological holdout error metrics.
- KPI evaluation for production, growth, concentration, yield, revenue, costs, profit, farmer income, water productivity, sustainability, and weather-risk availability.
- Rule-based recommendations based on the active dataset.
- Weather workspace with location search, current conditions, five-day forecast, and an OpenStreetMap map.
- Crop-health image screening through a configurable Groq vision model.
- Financial and FAOSTAT market-price workspaces.
- Filtered CSV downloads and printable production reports.
- In-app methodology, source, formula, and limitation documentation.

## Technology

- **Frontend:** Next.js 16, React 18, TypeScript, Recharts, React Leaflet, Papa Parse, and CSS.
- **Backend:** FastAPI, Uvicorn, Pandas, NumPy, scikit-learn, HTTPX, and pypdf.
- **Default production data:** OWID Grapher crop-production CSVs for rice, maize, wheat, and soybeans; OWID identifies FAOSTAT as the underlying source.
- **Persistence:** one cleaned active dataset held in backend memory. It is reset when the backend restarts.

## Requirements

- Node.js 20.9 or newer (required by Next.js 16)
- npm
- Python 3.10 or newer
- Internet access for OWID, weather, market-price, map-tile, and optional crop-health services

## Run locally

### 1. Install frontend dependencies

```powershell
cd "D:\Agri Vision"
npm ci
```

Use `npm install` instead when setting up from a changed dependency manifest.

### 2. Install backend dependencies

```powershell
cd "D:\Agri Vision\backend"
& "..\.venv\Scripts\python.exe" -m pip install -r requirements.txt
```

Any Python 3.10+ interpreter may be used if the repository virtual environment is not available.

### 3. Start the backend

In the first PowerShell window:

```powershell
cd "D:\Agri Vision\backend"
.\run.ps1
```

The API starts at http://127.0.0.1:8000. Interactive documentation is available at http://127.0.0.1:8000/docs.

### 4. Start the frontend

In a second PowerShell window:

```powershell
cd "D:\Agri Vision"
npm run dev
```

Open http://localhost:3000. The frontend uses `http://127.0.0.1:8000` as its default backend URL. To change it, copy [.env.example](.env.example) to `.env.local` and set `NEXT_PUBLIC_API_URL`.

If the backend is unavailable, CSV uploads can use the browser-side validation fallback. PDF uploads and backend-powered weather, crop-health, and market-price features require the API.

## Optional services

Keep secrets in the ignored `backend/.env` file. Never expose them through a `NEXT_PUBLIC_` variable or commit them.

```powershell
Set-Content -Path "backend\.env" -Value @"
OPENWEATHER_API_KEY=your-openweather-api-key
GROQ_API_KEY=your-groq-api-key
# Optional: use another vision model available to your Groq account.
GROQ_VISION_MODEL=qwen/qwen3.8-27b
"@
```

- `OPENWEATHER_API_KEY` enables the Weather workspace.
- `GROQ_API_KEY` enables crop-health image screening. The default model is configurable with `GROQ_VISION_MODEL`.
- The market-price workspace uses public FAOSTAT producer-price data and a DBnomics catalog fallback when FAOSTAT is rate-limited.

Crop-health results are AI-assisted visual screening guidance, not a laboratory diagnosis. The service rejects non-image uploads and images larger than 10 MB.

## Backend API

All analytics endpoints use the active dataset. The optional `country`, `crop`, and `year` query parameters filter results where supported.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check service health |
| `POST` | `/api/data/upload` | Clean and activate a CSV or selectable-text PDF |
| `GET` | `/api/data/summary` | Return active source, quality, and summary |
| `GET` | `/api/data/trends` | Return annual production trends |
| `GET` | `/api/forecast` | Return moving-average forecast and error metrics; `horizon` is 1–10 |
| `GET` | `/api/kpis` | Return KPI values and availability statuses |
| `GET` | `/api/recommendations` | Return rule-based recommendations |
| `GET` | `/api/methodology` | Return active methodology and limitations |
| `POST` | `/api/crop-health/analyze` | Analyze an uploaded crop image through Groq |
| `GET` | `/api/weather` | Return geocoded current weather and a five-day forecast |
| `GET` | `/api/market-prices` | Return FAOSTAT producer-price data or catalog fallback |

Uploading a new CSV or PDF replaces the active in-memory dataset. All subsequent analytics use the cleaned upload.

## Upload format

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

Optional KPI columns:

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

Column names are matched flexibly by the backend. Missing optional fields are reported as unavailable; the application does not invent financial, sustainability, or weather values.

The upload pipeline:

1. Requires `Year` and `Production`.
2. Converts numeric fields and removes rows with missing required values.
3. Removes negative production, invalid years, and duplicate records.
4. Preserves valid optional KPI fields.
5. Reports records received, retained, and removed by category.

## Data and methodology

The default dashboard downloads rice, maize, wheat, and soybean production from the [OWID agricultural production dataset](https://ourworldindata.org/agricultural-production). The default analysis window is 2000–2026; the latest historical year depends on what the source publishes. Forecast estimates are labeled separately from historical observations.

Key calculations:

- Annual trend: production summed by year.
- Growth: `((latest annual total - first annual total) / first annual total) * 100`.
- Crop concentration: leading crop production divided by total production.
- Yield: production divided by positive cultivated area.
- Revenue: provided revenue, or `quantity_sold * selling_price`.
- Forecast: average production across the latest five available years, repeated for the requested horizon.

Forecasting is a transparent baseline, not a causal model or confidence interval. It does not model weather, prices, policy, land-area changes, or unexpected shocks. Profitability, sustainability, and weather-risk metrics depend on the quality, units, and provenance of uploaded fields.

## Test and production commands

Run backend tests:

```powershell
cd "D:\Agri Vision\backend"
& "..\.venv\Scripts\python.exe" -m pytest
```

The tests cover CSV cleaning, required-field validation, filtering, forecast minimum-data handling, optional KPI availability, upload validation, and the health endpoint.

Build and run the frontend in production mode:

```powershell
cd "D:\Agri Vision"
npm run build
npm start
```

Run the production dependency audit:

```powershell
npm audit --omit=dev
```

Development output is written to `.next-dev`; production output is written to `.next`. Run only one Next.js server for a given build to avoid stale chunk errors.

## Project structure

```text
Agri Vision/
├── app/
│   ├── page.tsx              # Dashboard UI and client-side fallback
│   ├── location-map.tsx      # Leaflet map workspace
│   ├── globals.css           # Dashboard styling
│   └── layout.tsx            # Metadata and root layout
├── backend/
│   ├── app/
│   │   ├── analytics.py      # Cleaning and analytics functions
│   │   └── main.py           # FastAPI routes and external integrations
│   ├── tests/                # Backend automated tests
│   ├── requirements.txt
│   └── run.ps1
├── public/                   # Dashboard screenshots
├── .env.example
├── next.config.mjs
├── package.json
└── README.md
```

## Limitations and next steps

- The backend has no persistent database; the active dataset is lost on restart.
- Authentication is a local browser demo flow, not production user management.
- Forecasts are baseline estimates and should not be treated as guaranteed outcomes.
- Optional financial, sustainability, and weather metrics require trustworthy input columns and units.
- External services can be unavailable or rate-limited.
- Add persistent storage, production authentication, and broader integration coverage before deployment.

## Screenshots

![AgriVision login page](public/login.png)

![AgriVision production dashboard](public/dashboard.png)

![AgriVision visualizations](public/visualizations.png)
