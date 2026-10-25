import pandas as pd
import pytest

from app.analytics import clean_csv, filter_frame, forecast, kpis


def test_clean_csv_removes_invalid_rows():
    raw = b"""Country,Crop,Year,Production
India,Rice,2020,100
India,Rice,2020,100
India,Rice,2021,-5
India,Rice,not-a-year,200
India,Rice,2022,300
"""



    cleaned, quality = clean_csv(raw)

    assert cleaned[["year", "production"]].to_dict("records") == [
        {"year": 2020, "production": 100.0},
        {"year": 2022, "production": 300.0},
    ]
    assert quality["records_before"] == 5
    assert quality["records_after"] == 2
    assert quality["duplicate_rows_removed"] == 1
    assert quality["invalid_numeric_or_negative_removed"] == 1


def test_clean_csv_requires_year_and_production():
    with pytest.raises(ValueError, match="Year and Production"):
        clean_csv(b"Country,Crop\nIndia,Rice\n")


def test_filter_frame_filters_country_crop_year():
    frame = pd.DataFrame(
        [
            {"country": "India", "crop": "Rice", "year": 2020, "production": 10},
            {"country": "India", "crop": "Wheat", "year": 2020, "production": 20},
            {"country": "Brazil", "crop": "Rice", "year": 2021, "production": 30},
        ]
    )

    result = filter_frame(frame, country="India", crop="Rice", year=2020)

    assert len(result) == 1
    assert result.iloc[0]["production"] == 10


def test_forecast_requires_three_years():
    frame = pd.DataFrame(
        [
            {"country": "India", "crop": "Rice", "year": 2020, "production": 10},
            {"country": "India", "crop": "Rice", "year": 2021, "production": 20},
        ]
    )

    with pytest.raises(ValueError, match="three chronological years"):
        forecast(frame)


def test_kpis_reports_unavailable_optional_metrics():
    frame = pd.DataFrame(
        [
            {"country": "India", "crop": "Rice", "year": 2020, "production": 10},
            {"country": "India", "crop": "Rice", "year": 2021, "production": 12},
        ]
    )

    result = kpis(frame)

    assert result["total_production"] == 22
    assert result["availability"]["revenue"] == "not_available"
    assert result["availability"]["profit"] == "not_available"
    assert result["availability"]["yield_per_hectare"] == "not_available"
    assert result["availability"]["weather_risk"] == "not_available"

