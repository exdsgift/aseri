"""Download raw data into data/: GPR daily .dta and IMF PortWatch daily chokepoint transits."""

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).parent / "data"
GPR_URL = "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.dta"
PW_URL = (
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/"
    "Daily_Chokepoints_Data/FeatureServer/0/query"
)
PORTS = ["Suez Canal", "Taiwan Strait", "Strait of Hormuz"]


def get(url, tries=6):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
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
(DATA / "gpr_daily_recent.dta").write_bytes(get(GPR_URL))
print("GPR ok")

for port in PORTS:
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
    (DATA / f"portwatch_{port.replace(' ', '_')}.json").write_text(json.dumps(rows))
    print(port, len(rows), "rows")
