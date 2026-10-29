import numpy as np
import pandas as pd
import pytest
from huggingface_hub import try_to_load_from_cache

from aseri.forecast import WEIGHTS, WEIGHTS_REVISION, forecast, load_model

pytestmark = pytest.mark.slow


def test_the_pinned_model_forecasts_21_ordered_quantiles():
    if not isinstance(
        try_to_load_from_cache(WEIGHTS, "model.safetensors", revision=WEIGHTS_REVISION),
        str,
    ):
        pytest.skip("the Timestral weights are not in the Hugging Face cache")
    days = pd.date_range(end="2026-10-26", periods=400, freq="D")
    observed = pd.Series(100 + 20 * np.sin(np.arange(400) * 2 * np.pi / 7), index=days)

    result = forecast(load_model(), observed, horizon=28)

    assert result.levels == (
        0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
        0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
    )  # fmt: skip
    assert result.quantiles.shape == (28, 21)
    assert (np.diff(result.quantiles, axis=1) >= 0).all()
