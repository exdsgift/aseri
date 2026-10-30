"""The public API files, in the Hubverse fields: wide JSON, one array per quantile level."""

import json
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from aseri.archive import REPLAY_DAYS, Archived, timestamp
from aseri.forecast import MODEL_ID, WEIGHTS, WEIGHTS_REVISION
from aseri.series import Series

SCHEMA_VERSION = "1.0.0"


def credit(model_id: str, weights: str) -> str:
    return (
        f"Forecasts: aseri (model {model_id}, {weights.split('/')[1]} by Mistral AI)."
    )


FORECAST_CREDIT = credit(MODEL_ID, WEIGHTS)
FORECAST_LICENSE = {
    "name": "CC BY-NC 4.0",
    "url": "https://creativecommons.org/licenses/by-nc/4.0/",
    "attribution": FORECAST_CREDIT,
    "note": "Upstream terms still apply to the underlying data: see each series' license.",
}
# The page's 8-in-10 and 5-in-10 ranges and its most likely value.
REPLAY_LEVELS = (0.1, 0.25, 0.5, 0.75, 0.9)
# A retrospective forecast read revised data, and the model may have trained on the days it forecasts.
PSEUDO_REAL_TIME = {
    "testdata_leakage": "unknown",
    "pseudo_real_time_note": "Made after the fact, from the data as published on its forecast_date, which may differ from what was known on its reference_date.",
}


def publish(
    api_dir: Path,
    series: Series,
    archived: list[Archived],
    *,
    observed: pd.Series,
    as_of: date,
    generated_at: datetime,
) -> None:
    """Write the catalog, and every archived forecast of `series`, their index, the latest one, the replay and the observed values, under `api_dir`.

    `archived` is oldest reference date first, as `archive.read` returns it.
    """
    links = {
        "latest": f"series/{series.id}/latest.json",
        "forecasts": f"series/{series.id}/forecasts.json",
        "replay": f"series/{series.id}/replay.json",
        "actuals": f"series/{series.id}/actuals.json",
    }
    for forecast in archived:
        _write(
            api_dir / "series" / series.id / _dated(forecast),
            _forecast(series, forecast),
        )
    newest = archived[-1]
    latest = _forecast(series, newest)
    _write(
        api_dir / links["latest"],
        latest
        | {
            "links": {
                "catalog": "../../series.json",
                "canonical": _dated(newest),
                "replay": "replay.json",
            }
        },
    )
    _write(api_dir / links["forecasts"], _index(series, archived, generated_at))
    _write(api_dir / links["replay"], _replay(series, archived, latest["attribution"]))
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
        "model_id": archived.model_id,
        "forecast_date": archived.forecast_date,
        "reference_date": forecast.reference_date.date().isoformat(),
        "forecast_mode": archived.provenance["forecast_mode"],
        "unit": series.unit,
        "horizon_unit": "day",
        "horizon": list(range(1, steps + 1)),
        "target_end_date": target_end_dates.strftime("%Y-%m-%d").tolist(),
        "output_type": "quantile",
        # Already rounded to four decimals by the archive.
        "quantiles": {
            str(level): [float(v) for v in forecast.quantiles[:, i]]
            for i, level in enumerate(forecast.levels)
        },
        # The model that made this forecast: a later model change must not rewrite its credit.
        "attribution": f"{series.license['attribution']} {credit(archived.model_id, archived.provenance['model']['id'])}",
        "provenance": archived.provenance | _labels(archived),
        "links": {"catalog": "../../../series.json"},
        # The run's, not today's: republishing a forecast never changes its file.
        "generated_at": archived.provenance["generated_at"],
    }


def _labels(archived) -> dict:
    # Computed here, not archived: the manifests of the launch backfill predate the label.
    return (
        PSEUDO_REAL_TIME
        if archived.provenance["forecast_mode"] == "retrospective"
        else {}
    )


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
        "generated_at": timestamp(generated_at),
    }


def _replay(series, archived, attribution) -> dict:
    """The forecasts of the replay window, at the page's levels only, in one file for the slider."""
    newest = archived[-1].forecast
    start = newest.reference_date - pd.Timedelta(days=REPLAY_DAYS)
    return {
        "series_id": series.id,
        "model_id": archived[-1].model_id,
        "horizon": list(range(1, len(newest.quantiles) + 1)),
        "quantile_levels": [str(level) for level in REPLAY_LEVELS],
        "forecasts": [
            {
                "reference_date": f"{a.forecast.reference_date:%Y-%m-%d}",
                "forecast_mode": a.provenance["forecast_mode"],
                # One decimal keeps 121 GPR days at 37 KB gzipped, not 68 KB; the dated files keep four.
                "quantiles": {
                    str(level): [
                        round(float(v), 1)
                        for v in a.forecast.quantiles[:, a.forecast.levels.index(level)]
                    ]
                    for level in REPLAY_LEVELS
                },
            }
            | _labels(a)
            for a in archived
            if a.forecast.reference_date >= start
        ],
        "license": FORECAST_LICENSE,
        "attribution": attribution,
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
        "generated_at": timestamp(generated_at),
    }


def _catalog(series, observed, newest, links, generated_at) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": timestamp(generated_at),
        "model": {
            "model_id": MODEL_ID,
            "hf_id": WEIGHTS,
            "revision": WEIGHTS_REVISION,
        },
        "quantile_levels": list(newest.forecast.levels),
        "license": FORECAST_LICENSE,
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


def _write(path: Path, document: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document), encoding="utf-8")
