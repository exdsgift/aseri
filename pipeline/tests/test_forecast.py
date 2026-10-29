from types import SimpleNamespace

import pandas as pd
import torch

from aseri.forecast import forecast


class StubModel:
    """Stands in for Timestral: every quantile it forecasts is the length of the context it was given."""

    def forecast(self, context, prediction_length):
        levels = (0.1, 0.5, 0.9)
        shape = (1, 1, prediction_length, len(levels))
        return SimpleNamespace(
            quantiles=torch.full(shape, float(len(context))), quantile_levels=levels
        )


def observed(last_day, days):
    dates = pd.date_range(end=last_day, periods=days, freq="D")
    return pd.Series(range(days), index=dates, dtype=float)


def test_forecasts_from_the_last_observed_date():
    result = forecast(StubModel(), observed("2026-10-26", days=10), horizon=3)

    assert result.reference_date == pd.Timestamp("2026-10-26")


def test_forecasts_every_step_at_every_level_of_the_model():
    result = forecast(StubModel(), observed("2026-10-26", days=10), horizon=3)

    assert result.levels == (0.1, 0.5, 0.9)
    assert result.quantiles.shape == (3, 3)


def test_reads_the_whole_history():
    result = forecast(StubModel(), observed("2026-10-26", days=400), horizon=3)

    assert (result.quantiles == 400).all()


class CrossingModel:
    """Returns a band whose 0.5 quantile sits above its 0.9 quantile."""

    def forecast(self, context, prediction_length):
        crossed = torch.tensor([[[[1.0, 5.0, 3.0]] * prediction_length]])
        return SimpleNamespace(quantiles=crossed, quantile_levels=(0.1, 0.5, 0.9))


def test_quantiles_never_decrease_across_levels():
    result = forecast(CrossingModel(), observed("2026-10-26", days=10), horizon=2)

    assert result.quantiles.tolist() == [[1.0, 3.0, 5.0], [1.0, 3.0, 5.0]]
