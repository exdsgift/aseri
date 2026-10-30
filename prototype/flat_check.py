"""Independent check of the published PortWatch forecasts: Timestral called directly on the raw history."""

import glob
import json
import sys

import numpy as np
import pandas as pd
from timestral import TimestralForecaster

archive, fixtures = sys.argv[1], sys.argv[2]
deltas = pd.concat(
    pd.read_csv(f, parse_dates=["target_end_date"])
    for f in glob.glob(f"{archive}/target-data/deltas/*.csv")
)
model = TimestralForecaster.from_pretrained(
    "mistralai/Timestral-209M", revision="9874d252ab0aae16f7f7c999f98f98d6ad7d8365"
)
for sid, h in [
    ("gpr_daily", 28),
    ("suez_transits", 28),
    ("taiwan_strait_transits", 28),
    ("hormuz_transits", 14),
    ("bab_el_mandeb_transits", 14),
]:
    s = (
        deltas[deltas.target == sid]
        .set_index("target_end_date")["observation"]
        .sort_index()
    )
    res = model.forecast(s.to_numpy(), prediction_length=h)
    q = res.quantiles[0, 0].numpy()
    levels = list(res.quantile_levels)
    med = q[:, levels.index(0.5)]
    pub = json.load(open(f"{fixtures}/series/{sid}/latest.json"))
    pmed = np.array(pub["quantiles"]["0.5"])
    last56 = s.iloc[-56:]
    dow = last56.groupby(last56.index.dayofweek).mean()
    # Same model on only the last 365 days: does the long context flatten it?
    short = (
        model.forecast(s.iloc[-365:].to_numpy(), prediction_length=h)
        .quantiles[0, 0]
        .numpy()[:, levels.index(0.5)]
    )
    acf7 = s.iloc[-365:].autocorr(7)
    print(
        f"== {sid}: n={len(s)} last={s.index[-1].date()} shape={tuple(res.quantiles.shape)}"
    )
    print(f"   max |direct - published| median = {np.abs(med - pmed).max():.4f}")
    print(f"   median path      : {np.round(med[:14], 1).tolist()}")
    print(
        f"   median range     : {med.min():.1f}..{med.max():.1f}  (amplitude {med.max() - med.min():.1f})"
    )
    print(f"   last 14 days     : {s.iloc[-14:].round(1).tolist()}")
    print(
        f"   last-56d weekday means: {dow.round(1).tolist()} (amplitude {dow.max() - dow.min():.1f}), std {last56.std():.1f}, acf lag7 (365d) {acf7:.2f}"
    )
    print(f"   365-day context median range: {short.min():.1f}..{short.max():.1f}")
