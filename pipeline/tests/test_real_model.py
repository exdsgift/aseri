"""The real Timestral model: golden quantiles, and an archived live forecast made again. Opt in with `pytest -m slow`.

Regenerate the goldens, only together with a new MODEL_ID: `uv run python -m tests.test_real_model` in pipeline/.
"""

import hashlib
import json
import os
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from huggingface_hub import try_to_load_from_cache

from aseri import archive
from aseri.forecast import (
    MODEL_ID,
    WEIGHTS,
    WEIGHTS_REVISION,
    forecast,
    load_model,
    make_context,
)
from aseri.series import GPR_DAILY, HORMUZ_TRANSITS
from aseri.sources import gpr, portwatch

FIXTURES = Path(__file__).parent / "fixtures"
# The frozen input: 60 real GPR days, also the daily run's recorded download in test_cli.
RECORDED_GPR = FIXTURES / "gpr_daily_recent.dta"
GOLDEN = FIXTURES / "golden_quantiles.json"
# Where model-check.yml checks out the archive branch: next to pipeline/, as daily.yml does.
ARCHIVE = Path(__file__).parents[2] / "archive"


# GitHub Actions sets CI: there a missing model or archive fails the check, so a green run has checked something.
IN_CI = bool(os.environ.get("CI"))
# Every level the archive and the API carry, the replay's five among them.
LEVELS = (
    0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
    0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
)  # fmt: skip


@pytest.fixture(scope="module")
def model():
    # In CI it downloads the weights if they are missing; elsewhere it skips.
    if not IN_CI and not isinstance(
        try_to_load_from_cache(WEIGHTS, "model.safetensors", revision=WEIGHTS_REVISION),
        str,
    ):
        pytest.skip("the Timestral weights are not in the Hugging Face cache")
    return load_model()


def assert_well_formed(result, series):
    """The real outputs keep the stubs' shape: ordered, finite, and never below 0 for a count."""
    assert np.isfinite(result.quantiles).all()
    assert (np.diff(result.quantiles, axis=1) >= 0).all()
    # GPR is an index; the PortWatch series are counts.
    if series.kind == "count":
        assert (result.quantiles >= 0).all()


def test_the_goldens_are_of_the_model_and_the_input_in_the_code():
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))

    assert (golden["model_id"], golden["weights_revision"]) == (
        MODEL_ID,
        WEIGHTS_REVISION,
    ), "a new model needs a new MODEL_ID and new goldens: see this module's docstring"
    # test_cli shares the input: re-recording it must not pass for model drift.
    assert (
        golden["input_sha256"] == hashlib.sha256(RECORDED_GPR.read_bytes()).hexdigest()
    ), f"{RECORDED_GPR.name} changed: the goldens were made from another input"


@pytest.mark.slow
def test_the_model_forecasts_the_golden_quantiles(model):
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))

    result = forecast(
        model, gpr.parse(RECORDED_GPR.read_bytes()), len(golden["quantiles"])
    )

    assert result.levels == tuple(golden["levels"]) == LEVELS
    np.testing.assert_allclose(result.quantiles, golden["quantiles"], rtol=1e-4)
    assert_well_formed(result, GPR_DAILY)


@pytest.fixture
def live():
    """The newest live forecast of the model in the code: the one the site shows."""
    if not (ARCHIVE / "runs").is_dir():
        (pytest.fail if IN_CI else pytest.skip)(
            f"no archive at {ARCHIVE}; from the repo root: git worktree add archive origin/archive"
        )
    issued = [
        a
        for a in archive.read(ARCHIVE, GPR_DAILY.id)
        if a.model_id == MODEL_ID and a.provenance["forecast_mode"] == "live"
    ]
    if not issued:
        pytest.skip(f"the archive holds no live forecast of {MODEL_ID} yet")
    return issued[-1]


@pytest.mark.slow
def test_a_live_forecast_is_made_again_from_its_archived_vintage(live, model):
    data = live.provenance["data"]
    vintage = archive.as_of_view(
        ARCHIVE, GPR_DAILY.id, date.fromisoformat(data["as_of"])
    )
    context = make_context(GPR_DAILY, vintage, live.forecast.reference_date)
    assert archive.input_sha256(context) == data["input_sha256"], (
        "the archive no longer rebuilds the context this forecast was made from"
    )

    result = forecast(model, context, len(live.forecast.quantiles))

    assert result.levels == live.forecast.levels
    # Measured float32 drift, Windows vs the Ubuntu runner that archived it: 2.4e-6 relative, 40x under rtol; atol covers the 4-decimal rounding.
    np.testing.assert_allclose(
        result.quantiles, live.forecast.quantiles, rtol=1e-4, atol=1e-4
    )
    assert_well_formed(result, GPR_DAILY)


@pytest.mark.slow
def test_the_model_keeps_a_count_series_at_0_and_up(model):
    # Hormuz as recorded for test_portwatch: 55 days of 0 to 8 ships, a band that would reach below 0.
    pages = [
        json.loads((FIXTURES / "portwatch" / f"page-{offset}.json").read_bytes())
        for offset in (0, 25, 50)
    ]
    context = portwatch.parse(
        [feature["attributes"] for page in pages for feature in page["features"]],
        pd.Timestamp("2026-10-28T07:51:08"),
    )

    result = forecast(model, context, HORMUZ_TRANSITS.horizon, HORMUZ_TRANSITS.kind)

    assert result.quantiles.shape == (HORMUZ_TRANSITS.horizon, len(LEVELS))
    assert_well_formed(result, HORMUZ_TRANSITS)


@pytest.mark.slow
def test_the_model_forecasts_from_a_context_with_registered_errors_blanked(model):
    # make_context sends a registered measurement error as NaN: the model must still give a whole forecast.
    context = gpr.parse(RECORDED_GPR.read_bytes())
    context.iloc[[20, 21, 22, -1]] = np.nan

    assert_well_formed(forecast(model, context, GPR_DAILY.horizon), GPR_DAILY)


if __name__ == "__main__":
    # Never over the goldens of the same MODEL_ID: other numbers mean another model, so a new MODEL_ID.
    if (
        GOLDEN.exists()
        and json.loads(GOLDEN.read_text(encoding="utf-8"))["model_id"] == MODEL_ID
    ):
        raise SystemExit(
            f"{GOLDEN.name} holds {MODEL_ID} already: change MODEL_ID first"
        )
    result = forecast(
        load_model(), gpr.parse(RECORDED_GPR.read_bytes()), GPR_DAILY.horizon
    )
    with GOLDEN.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(
            {
                "model_id": MODEL_ID,
                "weights_revision": WEIGHTS_REVISION,
                "input": RECORDED_GPR.name,
                "input_sha256": hashlib.sha256(RECORDED_GPR.read_bytes()).hexdigest(),
                "levels": result.levels,
                "quantiles": result.quantiles.tolist(),
            },
            file,
            indent=2,
        )
        file.write("\n")
