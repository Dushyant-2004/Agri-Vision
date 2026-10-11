from __future__ import annotations

from io import BytesIO
from typing import Annotated

import httpx
import pandas as pd
import os
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analytics import clean_csv, filter_frame, forecast, kpis, recommendations, summary, trends

app = FastAPI(title="AgriVision Analytics API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_frame: pd.DataFrame | None = None
active_source = "OWID / FAOSTAT"
active_quality: dict = {}

OWID_SOURCES = {
    "Rice": "https://ourworldindata.org/grapher/rice-production.csv",
    "Maize": "https://ourworldindata.org/grapher/maize-production.csv",
    "Wheat": "https://ourworldindata.org/grapher/wheat-production.csv",
    "Soybeans": "https://ourworldindata.org/grapher/soybean-production.csv",
}


async def load_default_data() -> pd.DataFrame:
    frames = []
    async with httpx.AsyncClient(timeout=30) as client:
        for crop, url in OWID_SOURCES.items():
            response = await client.get(url)
            response.raise_for_status()
            raw = pd.read_csv(BytesIO(response.content))
            production_column = next(column for column in raw.columns if "production" in column.lower())
            frames.append(
                pd.DataFrame(
                    {
                        "country": raw["Entity"].astype(str),
                        "year": pd.to_numeric(raw["Year"], errors="coerce"),
                        "crop": crop,
                        "production": pd.to_numeric(raw[production_column], errors="coerce"),
                    }
                )
            )
    return pd.concat(frames, ignore_index=True).dropna()


async def get_frame() -> pd.DataFrame:
    global active_frame, active_quality
    if active_frame is None:
        active_frame = await load_default_data()
        active_quality = {"source": active_source, "records_after": len(active_frame)}
    return active_frame


def selected_frame(frame: pd.DataFrame, country: str | None, crop: str | None, year: int | None) -> pd.DataFrame:
    result = filter_frame(frame, country, crop, year)
    if result.empty:
        raise HTTPException(status_code=404, detail="No records match the selected filters.")
    return result


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "agrivision-analytics"}


@app.post("/api/data/upload")
async def upload_data(file: Annotated[UploadFile, File(...)]) -> dict:
    global active_frame, active_source, active_quality
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    try:
        active_frame, active_quality = clean_csv(await file.read())
    except (ValueError, pd.errors.ParserError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    active_source = f"Uploaded CSV · {file.filename}"
    active_quality["source"] = active_source
    return {
        "source": active_source,
        "quality": active_quality,
        "summary": summary(active_frame),
        "records": active_frame.to_dict(orient="records"),
    }


@app.get("/api/data/summary")
async def data_summary() -> dict:
    frame = await get_frame()
    return {"source": active_source, "quality": active_quality, "summary": summary(frame)}


@app.get("/api/data/trends")
async def data_trends(
    country: str | None = None,
    crop: str | None = None,
    year: int | None = None,
) -> dict:
    frame = selected_frame(await get_frame(), country, crop, year)
    return {"source": active_source, "data": trends(frame)}


@app.get("/api/forecast")
async def data_forecast(
    country: str | None = None,
    crop: str | None = None,
    year: int | None = None,
    horizon: int = Query(default=3, ge=1, le=10),
) -> dict:
    frame = selected_frame(await get_frame(), country, crop, year)
    try:
        return {"source": active_source, **forecast(frame, horizon)}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/kpis")
async def data_kpis(
    country: str | None = None,
    crop: str | None = None,
    year: int | None = None,
    target_growth: float = 5.0,
) -> dict:
    return kpis(selected_frame(await get_frame(), country, crop, year), target_growth)


@app.get("/api/recommendations")
async def data_recommendations(
    country: str | None = None,
    crop: str | None = None,
    year: int | None = None,
    target_growth: float = 5.0,
) -> dict:
    frame = selected_frame(await get_frame(), country, crop, year)
    return {"source": active_source, "recommendations": recommendations(frame, target_growth)}


@app.get("/api/methodology")
async def methodology() -> dict:
    frame = await get_frame()
    return {
        "source": active_source,
        "quality": active_quality,
        "summary": summary(frame),
        "methods": [
            "Production is aggregated by year for the active filters.",
            "Growth compares the first and latest available annual totals.",
            "Concentration is the leading crop's share of total production.",
            "Forecasts use a transparent moving-average baseline with chronological holdout metrics.",
        ],
        "limitations": "Production data alone cannot estimate profitability, sustainability, or causality.",
    }


@app.get("/api/weather")
async def weather(city: str = Query(default="New Delhi", min_length=1)) -> dict:
    api_key = os.getenv("WEATHER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="WEATHER_API_KEY is not configured.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://api.weatherapi.com/v1/forecast.json",
                params={"key": api_key, "q": city, "days": 5, "aqi": "no", "alerts": "yes"},
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail="WeatherAPI could not return weather for this location.") from error
    location = payload["location"]
    current = payload["current"]
    return {
        "location": f"{location['name']}, {location['country']}",
        "updated": current["last_updated"],
        "current": {
            "temperature": current["temp_c"],
            "condition": current["condition"]["text"],
            "humidity": current["humidity"],
            "rainfall": current["precip_mm"],
            "wind": current["wind_kph"],
        },
        "forecast": [
            {
                "date": day["date"],
                "temperature": day["day"]["avgtemp_c"],
                "rainfall": day["day"]["totalprecip_mm"],
                "condition": day["day"]["condition"]["text"],
            }
            for day in payload["forecast"]["forecastday"]
        ],
    }


@app.get("/api/market-prices")
async def market_prices() -> dict:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://fenixservices.fao.org/api/faostat/data/v1/en/PP",
                params={"page_size": 20, "page_number": 1, "area_code": 100},
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail="FAOSTAT market data is temporarily unavailable.") from error
    records = payload.get("data", [])
    return {
        "source": "FAOSTAT · Producer Prices",
        "records": [
            {
                "commodity": row.get("Item"),
                "year": row.get("Year"),
                "price": row.get("Value"),
                "unit": row.get("Unit"),
            }
            for row in records[:20]
            if row.get("Item") and row.get("Value") is not None
        ],
    }
