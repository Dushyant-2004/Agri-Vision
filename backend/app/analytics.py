from __future__ import annotations

from io import BytesIO
import re
from typing import Any

import numpy as np
import pandas as pd
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sklearn.linear_model import LinearRegression

REQUIRED_COLUMNS = {"year", "production"}
OPTIONAL_NUMERIC_COLUMNS = {
    "area": ("area", "hectare"),
    "quantity_sold": ("quantity_sold", "sold"),
    "selling_price": ("selling_price", "price_per_tonne", "market_price"),
    "revenue": ("revenue", "sales"),
    "total_cost": ("total_cost", "cost"),
    "farmer_income": ("farmer_income", "household_income"),
    "water_used": ("water_used", "water_use"),
    "fertilizer_used": ("fertilizer_used", "fertilizer_use"),
    "pesticide_used": ("pesticide_used", "pesticide_use"),
    "carbon_emissions": ("carbon_emissions", "co2"),
    "rainfall": ("rainfall",),
    "temperature": ("temperature",),
    "drought_index": ("drought_index", "drought"),
    "flood_events": ("flood_events", "flood"),
    "heatwave_days": ("heatwave_days", "heatwave"),
}


def _find_column(columns: list[str], *terms: str) -> str | None:
    for column in columns:
        lowered = column.lower().strip()
        if any(term in lowered for term in terms):
            return column
        return None


def _clean_frame(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    original_count = len(frame)
    columns = list(frame.columns)
    year_column = _find_column(columns, "year")
    production_column = _find_column(columns, "production", "yield")
    if not year_column or not production_column:
        raise ValueError("CSV must contain Year and Production columns.")

    crop_column = _find_column(columns, "crop")
    geography_column = _find_column(columns, "state", "country", "entity", "geography")
    normalized = pd.DataFrame(
        {
            "country": frame[geography_column].fillna("Uploaded dataset").astype(str)
            if geography_column
            else "Uploaded dataset",
            "year": pd.to_numeric(frame[year_column], errors="coerce"),
            "crop": frame[crop_column].fillna("Uploaded crop").astype(str)
            if crop_column
            else "Uploaded crop",
            "production": pd.to_numeric(
                frame[production_column].astype(str).str.replace(",", "", regex=False),
                errors="coerce",
            ),
        }
    )
    for target, terms in OPTIONAL_NUMERIC_COLUMNS.items():
        source = _find_column(columns, *terms)
        if source:
            normalized[target] = pd.to_numeric(
                frame[source].astype(str).str.replace(",", "", regex=False),
                errors="coerce",
            )
    missing_count = int(normalized.isna().any(axis=1).sum())
    invalid_count = int((normalized["production"] < 0).fillna(False).sum())
    normalized = normalized.dropna(subset=["year", "production"])
    normalized = normalized[normalized["production"] >= 0]
    duplicate_count = int(normalized.duplicated().sum())
    normalized = normalized.drop_duplicates()
    normalized["year"] = normalized["year"].astype(int)
    normalized["production"] = normalized["production"].astype(float)
    if normalized.empty:
        raise ValueError("CSV contains no valid rows after cleaning.")
    return normalized, {
        "records_before": original_count,
        "records_after": len(normalized),
        "missing_rows_removed": missing_count,
        "invalid_numeric_or_negative_removed": invalid_count,
        "duplicate_rows_removed": duplicate_count,
        "operations": [
            "Normalized geography, year, crop, and production columns.",
            "Converted year and production to numeric values.",
            "Removed missing, malformed, and negative production records.",
            "Removed duplicate records.",
        ],
    }


def clean_csv(raw: bytes) -> tuple[pd.DataFrame, dict[str, Any]]:
    return _clean_frame(pd.read_csv(BytesIO(raw)))


def _split_pdf_row(line: str) -> list[str]:
    if "," in line:
        return [part.strip() for part in line.split(",")]
    if "\t" in line:
        return [part.strip() for part in line.split("\t") if part.strip()]
    parts = [part.strip() for part in re.split(r"\s{2,}", line) if part.strip()]
    return parts if len(parts) > 1 else line.split()


def clean_pdf(raw: bytes) -> tuple[pd.DataFrame, dict[str, Any]]:
    reader = PdfReader(BytesIO(raw))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    header_index = next(
        (
            index
            for index, line in enumerate(lines)
            if "year" in line.lower()
            and ("production" in line.lower() or "yield" in line.lower())
        ),
        None,
    )
    if header_index is None:
        raise ValueError(
            "PDF must contain a selectable-text table with Year and Production columns. "
            "Scanned image PDFs are not supported."
        )

    headers = _split_pdf_row(lines[header_index])
    records = [_split_pdf_row(line) for line in lines[header_index + 1 :]]
    rows = [dict(zip(headers, values)) for values in records if len(values) >= len(headers)]
    if not rows:
        raise ValueError("PDF contains no table rows after the header.")
    return _clean_frame(pd.DataFrame(rows))


def summary(frame: pd.DataFrame) -> dict[str, Any]:
    return {
        "records": len(frame),
        "total_production": float(frame["production"].sum()),
        "crops": sorted(frame["crop"].dropna().unique().tolist()),
        "geographies": sorted(frame["country"].dropna().unique().tolist()),
        "years": sorted(frame["year"].unique().tolist()),
    }


def filter_frame(
    frame: pd.DataFrame,
    country: str | None = None,
    crop: str | None = None,
    year: int | None = None,
) -> pd.DataFrame:
    result = frame
    if country and country != "All geographies":
        result = result[result["country"] == country]
    if crop and crop != "All crops":
        result = result[result["crop"] == crop]
    if year:
        result = result[result["year"] == year]
    return result


def trends(frame: pd.DataFrame) -> list[dict[str, Any]]:
    grouped = frame.groupby("year", as_index=False)["production"].sum()
    return [
        {"year": int(row.year), "production": float(row.production)}
        for row in grouped.sort_values("year").itertuples()
    ]


def forecast(frame: pd.DataFrame, horizon: int = 3) -> dict[str, Any]:
    series = frame.groupby("year", as_index=False)["production"].sum().sort_values("year")
    if len(series) < 3:
        raise ValueError("At least three chronological years are required for forecasting.")
    values = series["production"].to_numpy(dtype=float)
    years = series["year"].to_numpy(dtype=int)
    holdout_size = max(1, min(3, len(values) // 4))
    train_values, test_values = values[:-holdout_size], values[-holdout_size:]
    train_years = years[:-holdout_size]
    model = LinearRegression().fit(train_years.reshape(-1, 1), train_values)
    predictions = model.predict(years[-holdout_size:].reshape(-1, 1))
    mae = float(np.mean(np.abs(test_values - predictions)))
    rmse = float(np.sqrt(np.mean((test_values - predictions) ** 2)))
    mape = float(np.mean(np.abs((test_values - predictions) / np.where(test_values == 0, 1, test_values))) * 100)
    recent = values[-min(5, len(values)) :]
    baseline = float(np.mean(recent))
    future_years = [int(years[-1] + index) for index in range(1, horizon + 1)]
    return {
        "method": "Five-year moving-average baseline",
        "historical": [{"year": int(y), "production": float(v)} for y, v in zip(years, values)],
        "future": [{"year": year, "production": baseline} for year in future_years],
        "metrics": {"mae": mae, "rmse": rmse, "mape": mape},
        "limitations": "This baseline does not model weather, prices, policy, area, or shocks.",
    }


def kpis(frame: pd.DataFrame, target_growth: float = 5.0) -> dict[str, Any]:
    annual = frame.groupby("year")["production"].sum().sort_index()
    growth = 0.0
    if len(annual) > 1 and annual.iloc[0] != 0:
        growth = float((annual.iloc[-1] - annual.iloc[0]) / annual.iloc[0] * 100)
    crop_totals = frame.groupby("crop")["production"].sum().sort_values(ascending=False)
    total = float(frame["production"].sum())
    concentration = float(crop_totals.iloc[0] / total * 100) if total else 0.0
    metrics: dict[str, Any] = {}
    availability: dict[str, str] = {}
    if "area" in frame and (frame["area"] > 0).any():
        metrics["yield_per_hectare"] = float((frame["production"] / frame["area"].where(frame["area"] > 0)).mean())
        availability["yield_per_hectare"] = "available"
    else:
        availability["yield_per_hectare"] = "not_available"
    if "revenue" in frame and frame["revenue"].notna().any():
        revenue = float(frame["revenue"].sum())
    elif {"quantity_sold", "selling_price"}.issubset(frame.columns):
        revenue = float((frame["quantity_sold"] * frame["selling_price"]).sum())
    else:
        revenue = None
    if revenue is not None:
        metrics["revenue"] = revenue
        availability["revenue"] = "available"
    else:
        availability["revenue"] = "not_available"
    if "total_cost" in frame and frame["total_cost"].notna().any():
        total_cost = float(frame["total_cost"].sum())
        metrics["total_cost"] = total_cost
        availability["total_cost"] = "available"
        if revenue is not None:
            metrics["profit"] = revenue - total_cost
            metrics["profit_margin"] = (revenue - total_cost) / revenue * 100 if revenue else 0
            availability["profit"] = "available"
        else:
            availability["profit"] = "needs_revenue"
    else:
        availability["total_cost"] = "not_available"
        availability["profit"] = "not_available"
    for key in ("selling_price", "farmer_income"):
        availability[key] = "available" if key in frame and frame[key].notna().any() else "not_available"
        if availability[key] == "available":
            metrics[key] = float(frame[key].mean() if key == "selling_price" else frame[key].sum())
    sustainability_fields = ["water_used", "fertilizer_used", "pesticide_used", "carbon_emissions"]
    available_sustainability = [field for field in sustainability_fields if field in frame and frame[field].notna().any()]
    availability["sustainability"] = "available" if len(available_sustainability) == len(sustainability_fields) else "partial" if available_sustainability else "not_available"
    if "water_used" in frame and frame["water_used"].notna().any():
        metrics["water_productivity"] = total / float(frame["water_used"].sum()) if frame["water_used"].sum() else 0
    weather_fields = ["rainfall", "temperature", "drought_index", "flood_events", "heatwave_days"]
    available_weather = [field for field in weather_fields if field in frame and frame[field].notna().any()]
    availability["weather_risk"] = "available" if len(available_weather) == len(weather_fields) else "partial" if available_weather else "not_available"
    return {
        "total_production": total,
        "growth_percent": growth,
        "crop_diversity": int(frame["crop"].nunique()),
        "concentration_percent": concentration,
        "target_growth_percent": target_growth,
        "benchmark_status": "on_track" if growth >= target_growth else "below_target",
        "metrics": metrics,
        "availability": availability,
    }


def recommendations(frame: pd.DataFrame, target_growth: float = 5.0) -> list[dict[str, str]]:
    metrics = kpis(frame, target_growth)
    leading_crop = frame.groupby("crop")["production"].sum().idxmax()
    results = []
    if metrics["growth_percent"] < target_growth:
        results.append(
            {
                "title": "Investigate the growth gap",
                "reason": f"Observed growth is {metrics['growth_percent']:.1f}% against your {target_growth:.1f}% target.",
                "limitation": "This descriptive signal does not identify causality.",
            }
        )
    else:
        results.append(
            {
                "title": "Protect the positive growth trend",
                "reason": f"Observed growth is {metrics['growth_percent']:.1f}%, above your {target_growth:.1f}% target.",
                "limitation": "Past growth does not guarantee future performance.",
            }
        )
    results.append(
        {
            "title": "Review crop concentration risk" if metrics["concentration_percent"] > 60 else "Maintain a diversified crop mix",
            "reason": f"{metrics['concentration_percent']:.1f}% of production is concentrated in {leading_crop}.",
            "limitation": "Production concentration is not the same as financial risk.",
        }
    )
    if metrics["availability"].get("profit") == "available":
        results.append(
            {
                "title": "Monitor observed profit margin",
                "reason": f"Calculated profit margin is {metrics['metrics'].get('profit_margin', 0):.1f}% from uploaded revenue and cost fields.",
                "limitation": "This is descriptive and excludes any costs not represented in the CSV.",
            }
        )
    else:
        results.append(
            {
                "title": "Add context before financial decisions",
                "reason": "Upload revenue and total cost fields to calculate profit from the active dataset.",
                "limitation": "Profitability is intentionally not estimated when required inputs are missing.",
            }
        )
    return results
