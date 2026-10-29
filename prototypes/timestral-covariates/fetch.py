"""Download the raw files the covariate spike needs into data/ (files already there are kept).

GPR and the Suez, Taiwan Strait and Hormuz PortWatch files are read from ../timestral-backtest/data/
so this spike scores the exact data vintage of the baseline spike.
"""

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).parent / "data"
UA = {"User-Agent": "aseri-spike/0.1 (research prototype; add contact info before scheduled use)"}
PW_URL = (
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/"
    "Daily_Chokepoints_Data/FeatureServer/0/query"
)
FILES = {
    "brent.csv": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU",
    "alerts.csv": "https://raw.githubusercontent.com/Vadimkin/ukrainian-air-raid-sirens-dataset/main/datasets/volunteer_data_en.csv",
    "losses.json": "https://raw.githubusercontent.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/main/data/russia_losses_equipment.json",
    "wiki_World_War_III.json": "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/"
    "all-access/user/World_War_III/daily/20150701/20261028",
}


def get(url, tries=6):
    for i in range(tries):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers=UA), timeout=60
            ) as r:
                body = r.read()
            # ArcGIS reports errors as HTTP 200 + {"error": ...}; treat that as a retryable failure
            if body[:20].lstrip().startswith(b'{"error"'):
                raise RuntimeError(body[:200])
            return body
        except Exception as e:
            print(f"  attempt {i + 1} failed: {e}")
            time.sleep(min(5 * 2**i, 120))
    raise SystemExit(f"giving up on {url}")


DATA.mkdir(exist_ok=True)
for name, url in FILES.items():
    if not (DATA / name).exists():
        (DATA / name).write_bytes(get(url))
    print(name, (DATA / name).stat().st_size, "bytes")

port, out = "Bab el-Mandeb Strait", DATA / "portwatch_Bab_el-Mandeb_Strait.json"
if not out.exists():
    rows, offset = [], 0
    while True:
        q = urllib.parse.urlencode(
            {
                "where": f"portname='{port}'",
                "outFields": "date,portname,n_total",
                "orderByFields": "date",
                "resultOffset": offset,
                "resultRecordCount": 1000,
                "returnGeometry": "false",
                "f": "json",
            }
        )
        page = json.loads(get(f"{PW_URL}?{q}"))
        rows += [f["attributes"] for f in page["features"]]
        if not page.get("exceededTransferLimit"):
            break
        offset += len(page["features"])
    out.write_text(json.dumps(rows))
print(port, len(json.loads(out.read_text())), "rows")
