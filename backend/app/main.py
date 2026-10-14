from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Annotated

import httpx
import pandas as pd
import os
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analytics import clean_csv, filter_frame, forecast, kpis, recommendations, summary, trends

COUNTRY_NAMES = {
    "afghanistan": "AF", "australia": "AU", "bangladesh": "BD", "brazil": "BR",
    "canada": "CA", "china": "CN", "egypt": "EG", "france": "FR", "germany": "DE",
    "india": "IN", "indonesia": "ID", "italy": "IT", "japan": "JP", "mexico": "MX",
    "nepal": "NP", "pakistan": "PK", "russia": "RU", "singapore": "SG",
    "south africa": "ZA", "spain": "ES", "sri lanka": "LK", "uae": "AE",
    "united arab emirates": "AE", "united kingdom": "GB", "united states": "US",
    "usa": "US", "vietnam": "VN", "philippines": "PH",
}
COUNTRY_CENTROIDS = {
    "AU": (-25.2744, 133.7751), "BD": (23.6850, 90.3563), "BR": (-14.2350, -51.9253),
    "CA": (56.1304, -106.3468), "CN": (35.8617, 104.1954), "DE": (51.1657, 10.4515),
    "EG": (26.8206, 30.8025), "FR": (46.2276, 2.2137), "GB": (55.3781, -3.4360),
    "IN": (20.5937, 78.9629), "ID": (-0.7893, 113.9213), "IT": (41.8719, 12.5674),
    "JP": (36.2048, 138.2529), "MX": (23.6345, -102.5528), "NP": (28.3949, 84.1240),
    "PK": (30.3753, 69.3451), "RU": (61.5240, 105.3188), "SG": (1.3521, 103.8198),
    "ZA": (-30.5595, 22.9375), "ES": (40.4637, -3.7492), "LK": (7.8731, 80.7718),
    "AE": (23.4241, 53.8478), "US": (37.0902, -95.7129), "VN": (14.0583, 108.2772),
    "PH": (12.8797, 121.7740),
}


def load_local_environment() -> None:
    """Load simple KEY=value settings from the ignored local backend .env file."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip().strip("\"'")
        if name:
            os.environ.setdefault(name, value)


load_local_environment()

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
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENWEATHER_API_KEY is not configured.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            search = city.strip()
            parts = [part.strip() for part in search.split(",") if part.strip()]
            requested_country = parts[-1] if len(parts) > 1 else search
            country_code = COUNTRY_NAMES.get(requested_country.casefold())
            city_query = ", ".join(parts[:-1]) if len(parts) > 1 else search
            country_only = country_code is not None and len(parts) == 1
            geocode_query = (
                search if country_only else f"{city_query},{country_code}" if country_code else search
            )
            geocode_response = await client.get(
                "https://api.openweathermap.org/geo/1.0/direct",
                params={
                    "q": geocode_query,
                    "limit": 5,
                    "appid": api_key,
                },
            )
            geocode_response.raise_for_status()
            locations = geocode_response.json()
            if not locations:
                raise HTTPException(status_code=404, detail=f"Could not locate {search}.")
            if country_code and not country_only:
                location = next(
                    (
                        item
                        for item in locations
                        if item.get("country") == country_code
                        and item.get("name", "").casefold() == city_query.casefold()
                    ),
                    None,
                )
                if location is None:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Could not locate {city_query} in {requested_country}.",
                    )
            else:
                location = locations[0]
            latitude, longitude = COUNTRY_CENTROIDS.get(
                country_code if country_only else None,
                (float(location["lat"]), float(location["lon"])),
            )
            current_response = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": latitude, "lon": longitude, "appid": api_key, "units": "metric"},
            )
            current_response.raise_for_status()
            current_payload = current_response.json()
            forecast_response = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"lat": latitude, "lon": longitude, "appid": api_key, "units": "metric", "cnt": 40},
            )
            forecast_response.raise_for_status()
            forecast_payload = forecast_response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail="OpenWeather could not return weather for this location.") from error

    daily: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"temperatures": [], "rainfall": 0.0, "conditions": []}
    )
    for item in forecast_payload.get("list", []):
        date = item["dt_txt"].split(" ")[0]
        day = daily[date]
        day["temperatures"].append(float(item["main"]["temp"]))
        day["rainfall"] += float(item.get("rain", {}).get("3h", 0.0))
        day["conditions"].append(item["weather"][0]["description"].capitalize())

    forecast = [
        {
            "date": date,
            "temperature": round(sum(day["temperatures"]) / len(day["temperatures"]), 1),
            "rainfall": round(day["rainfall"], 1),
            "condition": max(set(day["conditions"]), key=day["conditions"].count),
        }
        for date, day in sorted(daily.items())[:5]
    ]
    current = current_payload["main"]
    display_location = f"{current_payload['name']}, {current_payload['sys']['country']}"
    return {
        "location": display_location,
        "coordinates": {
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
        },
        "updated": datetime.fromtimestamp(
            current_payload["dt"], tz=timezone.utc
        ).isoformat(),
        "current": {
            "temperature": round(float(current["temp"]), 1),
            "feels_like": round(float(current["feels_like"]), 1),
            "condition": current_payload["weather"][0]["description"].capitalize(),
            "humidity": current["humidity"],
            "pressure": current["pressure"],
            "visibility": round(float(current_payload.get("visibility", 0)) / 1000, 1),
            "clouds": current_payload.get("clouds", {}).get("all", 0),
            "rainfall": round(
                float(current_payload.get("rain", {}).get("1h", 0.0)), 1
            ),
            "wind": round(float(current_payload.get("wind", {}).get("speed", 0.0)) * 3.6, 1),
        },
        "sunrise": current_payload["sys"]["sunrise"],
        "sunset": current_payload["sys"]["sunset"],
        "forecast": forecast,
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
    except (httpx.HTTPError, ValueError):
        # FAOSTAT's public API is intermittently unavailable. DBnomics keeps
        # an indexed FAOSTAT catalog that lets the market workspace remain
        # informative without presenting made-up prices.
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                fallback_response = await client.get(
                    "https://api.db.nomics.world/v22/series/FAO/PP",
                    params={"q": "India", "limit": 20},
                )
                fallback_response.raise_for_status()
                fallback_payload = fallback_response.json()
            fallback_records = []
            for series in fallback_payload.get("series", {}).get("docs", []):
                name = str(series.get("series_name", ""))
                parts = [part.strip() for part in name.split("–")]
                commodity = parts[-1] if parts else name
                unit = parts[0].replace("Producer Price", "").strip(" ()") if parts else ""
                if commodity:
                    fallback_records.append(
                        {
                            "commodity": commodity,
                            "year": "Catalog",
                            "price": "Unavailable",
                            "unit": unit or "FAOSTAT series",
                        }
                    )
            return {
                "source": "FAOSTAT catalog · DBnomics fallback",
                "notice": "Live FAOSTAT price values are temporarily unavailable. Showing the indexed commodity catalog.",
                "records": fallback_records,
            }
        except (httpx.HTTPError, ValueError, TypeError):
            raise HTTPException(
                status_code=503,
                detail="Market-price providers are temporarily unavailable. Please try again shortly.",
            ) from None
