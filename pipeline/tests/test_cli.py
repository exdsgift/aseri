"""The daily run end to end: fetch, forecast and publish, with a recorded GPR file and a stub model."""

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import torch

import aseri.__main__ as cli
from aseri.sources import gpr

# The last 60 days of the upstream file as downloaded on 2026-10-29.
RECORDED_GPR = Path(__file__).parent / "fixtures" / "gpr_daily_recent.dta"
LEVELS = (
    0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
    0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
)  # fmt: skip


class StubModel:
    """Stands in for Timestral: the last value, in a band that widens with each step."""

    def forecast(self, context, prediction_length):
        steps = np.arange(1, prediction_length + 1)[:, None]
        band = context[-1] + steps * (np.array(LEVELS) - 0.5)
        return SimpleNamespace(
            quantiles=torch.tensor(band)[None, None], quantile_levels=LEVELS
        )


def test_a_daily_run_publishes_the_catalog_the_latest_gpr_forecast_and_its_actuals(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(gpr, "download", lambda url: RECORDED_GPR.read_bytes())
    monkeypatch.setattr(cli, "load_model", StubModel)

    cli.main(tmp_path)

    catalog = json.loads((tmp_path / "series.json").read_text(encoding="utf-8"))
    latest = json.loads(
        (tmp_path / "series" / "gpr_daily" / "latest.json").read_text(encoding="utf-8")
    )
    actuals = json.loads(
        (tmp_path / "series" / "gpr_daily" / "actuals.json").read_text(encoding="utf-8")
    )
    assert catalog["series"][0]["links"]["actuals"] == "series/gpr_daily/actuals.json"
    assert len(actuals["date"]) == len(actuals["observation"]) == 60
    assert actuals["date"][-1] == latest["reference_date"]
    assert actuals["observation"][-3:] == [164.2596, 81.5903, 165.2528]
    assert actuals["as_of"] == datetime.now(UTC).date().isoformat()
    assert catalog["series"][0]["latest_reference_date"] == "2026-10-26"
    assert len(catalog["quantile_levels"]) == 21
    assert latest["reference_date"] == "2026-10-26"
    assert latest["horizon"] == list(range(1, 29))
    assert latest["target_end_date"][0] == "2026-10-27"
    assert latest["target_end_date"][-1] == "2026-11-23"
    assert len(latest["quantiles"]) == 21
    by_step = np.array(list(latest["quantiles"].values())).T
    assert by_step.shape == (28, 21)
    assert (np.diff(by_step, axis=1) >= 0).all()
    provenance = latest["provenance"]
    assert re.fullmatch(r"[0-9a-f]{40}", provenance["code"]["commit"])
    assert provenance["data"]["as_of"] == datetime.now(UTC).date().isoformat()
    assert provenance["inference"]["package_commit"]
    assert provenance["model"]["revision"]
    assert provenance["generated_at"].startswith(latest["forecast_date"])


def test_a_run_in_github_actions_records_its_commit_and_run(tmp_path, monkeypatch):
    monkeypatch.setattr(gpr, "download", lambda url: RECORDED_GPR.read_bytes())
    monkeypatch.setattr(cli, "load_model", StubModel)
    monkeypatch.setenv("GITHUB_SHA", "f" * 40)
    monkeypatch.setenv("GITHUB_SERVER_URL", "https://github.com")
    monkeypatch.setenv("GITHUB_REPOSITORY", "exdsgift/aseri")
    monkeypatch.setenv("GITHUB_RUN_ID", "42")

    cli.main(tmp_path)

    latest = json.loads(
        (tmp_path / "series" / "gpr_daily" / "latest.json").read_text(encoding="utf-8")
    )
    assert latest["provenance"]["code"] == {
        "commit": "f" * 40,
        "run": "https://github.com/exdsgift/aseri/actions/runs/42",
    }
