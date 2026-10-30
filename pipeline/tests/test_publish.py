import json
from datetime import UTC, date, datetime

import numpy as np
import pandas as pd
import pytest

from aseri.forecast import Forecast
from aseri.publish import publish
from aseri.series import GPR_DAILY


def publish_gpr(api_dir, observed):
    forecast = Forecast(
        reference_date=observed.index[-1],
        levels=(0.1, 0.5, 0.9),
        quantiles=np.array(
            [[90.1, 100.2, 110.3], [85.4, 101.5, 120.6]], dtype=np.float32
        ),
    )
    publish(
        api_dir,
        GPR_DAILY,
        forecast,
        observed=observed,
        as_of=date(2026, 10, 29),
        code_commit="0123abc",
        run_url="https://github.com/exdsgift/aseri/actions/runs/1",
        generated_at=datetime(2026, 10, 29, 7, 3, 12, tzinfo=UTC),
    )


def days_to(last_day, values, dtype=float):
    dates = pd.date_range(end=last_day, periods=len(values), freq="D")
    return pd.Series(values, index=dates, dtype=dtype).astype(float)


@pytest.fixture
def api_dir(tmp_path):
    publish_gpr(tmp_path, days_to("2026-10-26", [120.5, 98.23, 101.3], "float32"))
    return tmp_path


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_latest_forecast_counts_its_horizon_from_the_reference_date(api_dir):
    latest = read(api_dir / "series" / "gpr_daily" / "latest.json")

    assert latest["series_id"] == "gpr_daily"
    assert latest["reference_date"] == "2026-10-26"
    assert latest["forecast_date"] == "2026-10-29"
    assert latest["horizon"] == [1, 2]
    assert latest["target_end_date"] == ["2026-10-27", "2026-10-28"]


def test_latest_forecast_keys_each_quantile_level_without_float_noise(api_dir):
    latest = read(api_dir / "series" / "gpr_daily" / "latest.json")

    assert latest["output_type"] == "quantile"
    assert latest["quantiles"] == {
        "0.1": [90.1, 85.4],
        "0.5": [100.2, 101.5],
        "0.9": [110.3, 120.6],
    }


def test_latest_forecast_carries_its_provenance(api_dir):
    latest = read(api_dir / "series" / "gpr_daily" / "latest.json")

    assert latest["model_id"] == "aseri-timestral209m"
    assert latest["forecast_mode"] == "live"
    assert latest["provenance"] == {
        "model": {
            "id": "mistralai/Timestral-209M",
            "revision": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365",
            "url": "https://huggingface.co/mistralai/Timestral-209M",
        },
        "inference": {
            "package": "timestral",
            "package_commit": "a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff",
        },
        "code": {
            "commit": "0123abc",
            "run": "https://github.com/exdsgift/aseri/actions/runs/1",
        },
        "data": {
            "source_url": "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.dta",
            "as_of": "2026-10-29",
        },
        "generated_at": "2026-10-29T07:03:12Z",
        "forecast_mode": "live",
        "leakage_note": "Timestral's training-data cutoff is not published; backtests may be optimistic.",
    }


def test_latest_forecast_credits_the_source_and_the_model(api_dir):
    latest = read(api_dir / "series" / "gpr_daily" / "latest.json")

    assert latest["attribution"] == (
        'Caldara, D. and M. Iacoviello (2022), "Measuring Geopolitical Risk", '
        "American Economic Review 112(4), 1194-1225. "
        "Data: https://www.matteoiacoviello.com/gpr.htm "
        "Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI)."
    )


def test_actuals_list_the_observed_values_by_date_without_float_noise(api_dir):
    actuals = read(api_dir / "series" / "gpr_daily" / "actuals.json")

    assert actuals == {
        "schema_version": "1.0.0",
        "series_id": "gpr_daily",
        "unit": "index (1985-2019 average = 100)",
        "as_of": "2026-10-29",
        "date": ["2026-10-24", "2026-10-25", "2026-10-26"],
        "observation": [120.5, 98.23, 101.3],
        "attribution": GPR_DAILY.license["attribution"],
        "generated_at": "2026-10-29T07:03:12Z",
    }


def test_actuals_keep_the_last_400_days(tmp_path):
    publish_gpr(tmp_path, days_to("2026-10-26", range(500)))

    actuals = read(tmp_path / "series" / "gpr_daily" / "actuals.json")

    assert len(actuals["date"]) == len(actuals["observation"]) == 400
    assert actuals["date"][0] == "2025-09-22"
    assert actuals["observation"][0] == 100


def test_catalog_lists_the_series_with_its_latest_forecast(api_dir):
    catalog = read(api_dir / "series.json")

    assert catalog["schema_version"] == "1.0.0"
    assert catalog["generated_at"] == "2026-10-29T07:03:12Z"
    assert catalog["model"] == {
        "model_id": "aseri-timestral209m",
        "hf_id": "mistralai/Timestral-209M",
        "revision": "9874d252ab0aae16f7f7c999f98f98d6ad7d8365",
    }
    assert catalog["quantile_levels"] == [0.1, 0.5, 0.9]
    assert catalog["series"] == [
        {
            "series_id": "gpr_daily",
            "title": "Geopolitical risk",
            "unit": "index (1985-2019 average = 100)",
            "baseline": 100,
            "baseline_label": "its 1985-2019 average",
            "horizon_unit": "day",
            "horizon_max": 28,
            "interval_steps": [7, 14, 28],
            "last_observation_date": "2026-10-26",
            "latest_reference_date": "2026-10-26",
            "latest_forecast_date": "2026-10-29",
            "source": GPR_DAILY.source,
            "license": GPR_DAILY.license,
            "links": {
                "latest": "series/gpr_daily/latest.json",
                "actuals": "series/gpr_daily/actuals.json",
            },
        }
    ]


def test_catalog_states_the_forecast_licence(api_dir):
    catalog = read(api_dir / "series.json")

    assert catalog["license"] == {
        "name": "CC BY-NC 4.0",
        "url": "https://creativecommons.org/licenses/by-nc/4.0/",
        "attribution": "Forecasts: aseri (model aseri-timestral209m, Timestral-209M by Mistral AI).",
        "note": "Upstream terms still apply to the underlying data: see each series' license.",
    }


def test_latest_forecast_is_self_describing(api_dir):
    latest = read(api_dir / "series" / "gpr_daily" / "latest.json")

    assert latest["schema_version"] == "1.0.0"
    assert latest["unit"] == "index (1985-2019 average = 100)"
    assert latest["horizon_unit"] == "day"
    assert latest["generated_at"] == "2026-10-29T07:03:12Z"
    assert latest["links"] == {"catalog": "../../series.json"}
