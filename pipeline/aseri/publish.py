"""The public API files, in the Hubverse fields: wide JSON, one array per quantile level."""

import json
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from aseri.archive import Archived
from aseri.forecast import MODEL_ID, WEIGHTS, WEIGHTS_REVISION
from aseri.series import Series

SCHEMA_VERSION = "1.0.0"
FORECAST_CREDIT = (
    f"Forecasts: aseri (model {MODEL_ID}, {WEIGHTS.split('/')[1]} by Mistral AI)."
)


def publish(
    api_dir: Path,
    series: Series,
    archived: list[Archived],
    *,
    observed: pd.Series,
    as_of: date,
    generated_at: datetime,
) -> None:
    """Write the catalog, and every archived forecast of `series`, their index, the latest one and the observed values, under `api_dir`."""
    links = {
        "latest": f"series/{series.id}/latest.json",
        "forecasts": f"series/{series.id}/forecasts.json",
        "actuals": f"series/{series.id}/actuals.json",
    }
    for forecast in archived:
        _write(
            api_dir / "series" / series.id / _dated(forecast),
            _forecast(series, forecast),
        )
    newest = archived[-1]
    _write(
        api_dir / links["latest"],
        _forecast(series, newest)
        | {"links": {"catalog": "../../series.json", "canonical": _dated(newest)}},
    )
    _write(api_dir / links["forecasts"], _index(series, archived, generated_at))
    _write(api_dir / links["actuals"], _actuals(series, observed, as_of, generated_at))
    _write(
        api_dir / "series.json",
        _catalog(series, observed, newest, links, generated_at),
    )


def _dated(archived: Archived) -> str:
    """Where a forecast's own, never-changing file lives, relative to its series."""
    return f"forecasts/{archived.forecast.reference_date:%Y-%m-%d}.json"


def _forecast(series, archived) -> dict:
    forecast = archived.forecast
    steps = len(forecast.quantiles)
    target_end_dates = pd.date_range(
        forecast.reference_date + pd.Timedelta(days=1), periods=steps, freq="D"
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "series_id": series.id,
        "model_id": MODEL_ID,
        "forecast_date": archived.forecast_date,
        "reference_date": forecast.reference_date.date().isoformat(),
        "forecast_mode": archived.provenance["forecast_mode"],
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
        "provenance": archived.provenance,
        "links": {"catalog": "../../../series.json"},
        # The run's, not today's: republishing a forecast never changes its file.
        "generated_at": archived.provenance["generated_at"],
    }


def _index(series, archived, generated_at) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "series_id": series.id,
        "forecasts": [
            {
                "reference_date": forecast.forecast.reference_date.date().isoformat(),
                "forecast_date": forecast.forecast_date,
                "forecast_mode": forecast.provenance["forecast_mode"],
                "url": _dated(forecast),
            }
            for forecast in archived
        ],
        "generated_at": _timestamp(generated_at),
    }


def _actuals(series, observed, as_of, generated_at) -> dict:
    # shortcut: the last 400 days, enough for the page; the full history comes with the bulk files (#136).
    observed = observed.iloc[-400:]
    return {
        "schema_version": SCHEMA_VERSION,
        "series_id": series.id,
        "unit": series.unit,
        "as_of": as_of.isoformat(),
        "date": observed.index.strftime("%Y-%m-%d").tolist(),
        # Four decimals drop the float32 noise of the upstream file.
        "observation": [round(float(v), 4) for v in observed],
        "attribution": series.license["attribution"],
        "generated_at": _timestamp(generated_at),
    }


def _catalog(series, observed, newest, links, generated_at) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": _timestamp(generated_at),
        "model": {
            "model_id": MODEL_ID,
            "hf_id": WEIGHTS,
            "revision": WEIGHTS_REVISION,
        },
        "quantile_levels": list(newest.forecast.levels),
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
                "baseline": series.baseline,
                "baseline_label": series.baseline_label,
                "horizon_unit": "day",
                "horizon_max": series.horizon,
                "interval_steps": list(series.interval_steps),
                "last_observation_date": observed.index[-1].date().isoformat(),
                "latest_reference_date": newest.forecast.reference_date.date().isoformat(),
                "latest_forecast_date": newest.forecast_date,
                "source": series.source,
                "license": series.license,
                "links": links,
            }
        ],
    }


def _timestamp(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _write(path: Path, document: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document), encoding="utf-8")
