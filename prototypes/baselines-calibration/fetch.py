"""Download every series but GPR into data/series/, once. Usage: see README.md.

The four PortWatch lanes come from aseri's own archive, its vintage of 2026-10-31: PortWatch keeps no
history and its layer fails in spells, so the archive is the pinned copy. The other four come from
upstream through the production adapters, which check each source's contract. GPR comes from the
authors' vintages that ../gpr-realtime-backtest/fetch.py downloads, so that its backtest is real-time
(#145). Every request sends aseri's User-Agent, never a person's. A file already in data/series/ is
kept, so a rerun scores the same data.
"""

import io
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parents[2] / "pipeline"))
from aseri.__main__ import SOURCES
from aseri.sources import download, portwatch

OUT = Path(__file__).parent / "data" / "series"
ARCHIVE = "https://raw.githubusercontent.com/exdsgift/aseri/archive/target-data/deltas/2026-10-31.csv"

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    archived = None
    for series, source in SOURCES[1:]:
        path = OUT / f"{series.id}.csv"
        if path.exists():
            continue
        if source is portwatch:
            if archived is None:
                archived = pd.read_csv(
                    io.BytesIO(download(ARCHIVE)[0]), parse_dates=["target_end_date"]
                )
            rows = archived[archived["target"] == series.id]
            observed = rows.set_index("target_end_date")["observation"]
            as_of = rows["as_of"].max()
        else:
            observed, as_of, _ = source.fetch(series.source["data_url"])
        observed.rename("value").rename_axis("date").to_frame().assign(
            as_of=as_of
        ).to_csv(path)
        print(
            f"{series.id}: {len(observed)} values, {observed.index[0]:%Y-%m-%d} to {observed.index[-1]:%Y-%m-%d}, as of {as_of}",
            flush=True,
        )
