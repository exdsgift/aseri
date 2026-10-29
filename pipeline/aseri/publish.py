"""The public API files, in the Hubverse fields: wide JSON, one array per quantile level."""

import json
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from aseri.forecast import (
    MODEL_ID,
    PACKAGE_COMMIT,
    WEIGHTS,
    WEIGHTS_REVISION,
    Forecast,
)
from aseri.series import Series

SCHEMA_VERSION = "1.0.0"
FORECAST_CREDIT = (
    "Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI)."
)


def publish(
    api_dir: Path,
    series: Series,
    forecast: Forecast,
    *,
    as_of: date,
    code_commit: str,
    generated_at: datetime,
) -> None:
    """Write the catalog and the latest forecast of `series` under `api_dir`."""
    latest_path = f"series/{series.id}/latest.json"
    _write(
        api_dir / latest_path,
        _latest(series, forecast, as_of, code_commit, generated_at),
    )
    _write(
        api_dir / "series.json",
        _catalog(series, forecast, latest_path, generated_at),
    )


def _latest(series, forecast, as_of, code_commit, generated_at) -> dict:
    steps = len(forecast.quantiles)
    target_end_dates = pd.date_range(
        forecast.reference_date + pd.Timedelta(days=1), periods=steps, freq="D"
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "series_id": series.id,
        "model_id": MODEL_ID,
        "forecast_date": generated_at.date().isoformat(),
        "reference_date": forecast.reference_date.date().isoformat(),
        "forecast_mode": "live",
        "unit": series.unit,
        "horizon_unit": "day",
        "horizon": list(range(1, steps + 1)),
        "target_end_date": target_end_dates.strftime("%Y-%m-%d").tolist(),
        "output_type": "quantile",
        # Four decimals drop the float32 noise and keep enough digits for scoring.
        "quantiles": {
            str(level): [round(float(v), 4) for v in forecast.quantiles[:, i]]
            for i, level in enumerate(forecast.levels)
        },
        "attribution": f"{series.license['attribution']} {FORECAST_CREDIT}",
        "provenance": {
            "model": {
                "id": WEIGHTS,
                "revision": WEIGHTS_REVISION,
                "url": f"https://huggingface.co/{WEIGHTS}",
            },
            "inference": {"package": "timestral", "package_commit": PACKAGE_COMMIT},
            "code": {"commit": code_commit},
            "data": {
                "source_url": series.source["data_url"],
                "as_of": as_of.isoformat(),
            },
            "generated_at": _timestamp(generated_at),
            "forecast_mode": "live",
            "leakage_note": "Timestral's training-data cutoff is not published; backtests may be optimistic.",
        },
        "links": {"catalog": "../../series.json"},
        "generated_at": _timestamp(generated_at),
    }


def _catalog(series, forecast, latest_path, generated_at) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": _timestamp(generated_at),
        "model": {
            "model_id": MODEL_ID,
            "hf_id": WEIGHTS,
            "revision": WEIGHTS_REVISION,
        },
        "quantile_levels": list(forecast.levels),
        "license": {
            "name": "CC BY-NC 4.0",
            "url": "https://creativecommons.org/licenses/by-nc/4.0/",
            "attribution": FORECAST_CREDIT,
            "note": "Upstream terms still apply to the underlying data: see each series' license.",
        },
        "series": [
            {
                "series_id": series.id,
                "title": series.title,
                "unit": series.unit,
                "horizon_unit": "day",
                "horizon_max": series.horizon,
                "interval_steps": list(series.interval_steps),
                "last_observation_date": forecast.reference_date.date().isoformat(),
                "latest_reference_date": forecast.reference_date.date().isoformat(),
                "latest_forecast_date": generated_at.date().isoformat(),
                "source": series.source,
                "license": series.license,
                "links": {"latest": latest_path},
            }
        ],
    }


def _timestamp(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _write(path: Path, document: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document), encoding="utf-8")
