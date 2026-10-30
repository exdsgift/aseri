"""Daily views of one English Wikipedia article by people (agent type `user`), from the Wikimedia pageviews API."""

import hashlib
import json
from datetime import UTC, date, datetime

import pandas as pd

from aseri.sources import download


def fetch(url: str) -> tuple[pd.Series, date, dict]:
    """Today's vintage of the views, its as_of (the UTC fetch date), and the response's hash.

    `url` asks the per-article endpoint for every day since 2015-07-01, the API's first, up to
    2099: it answers with the days it has. Fails closed: anything that breaks the contract raises.
    """
    as_of = datetime.now(UTC).date()
    raw, _ = download(url)
    observed = parse(raw, url)
    last_day = observed.index[-1].date()
    if last_day > as_of:
        raise ValueError(
            f"Wikimedia has a day, {last_day}, after the fetch day {as_of}"
        )
    upstream = {"source_url": url, "sha256": hashlib.sha256(raw).hexdigest()}
    return observed, as_of, upstream


def parse(raw: bytes, url: str) -> pd.Series:
    """The views by day, checked to be the article, access and agent `url` asks for, on every day, in whole numbers."""
    items = json.loads(raw)["items"]
    # The URL's own path: project, access, agent and article, then the granularity.
    project, access, agent, article = url.split("/per-article/")[1].split("/")[:4]
    asked = {"project": project, "access": access, "agent": agent, "article": article}
    if any({key: item.get(key) for key in asked} != asked for item in items):
        raise ValueError(
            f"Wikimedia answered for another article or agent than {asked}"
        )
    views = pd.Series(
        [item["views"] for item in items],
        index=pd.to_datetime([item["timestamp"] for item in items], format="%Y%m%d00"),
    )
    # The API leaves out a day with no views, which an article this read never has: it is a gap upstream.
    if not views.index.equals(pd.date_range(views.index[0], views.index[-1], freq="D")):
        raise ValueError(
            "Wikimedia has missing or repeated days: expected one row for every day"
        )
    if not pd.api.types.is_integer_dtype(views) or (views < 0).any():
        raise ValueError("Wikimedia has views that are not integers of at least 0")
    return views.astype(float)
