"""Download the GPR authors' archived daily vintages into data/, once, politely. Usage: see README.md."""

import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2] / "pipeline"))
from aseri.sources import (
    gpr,
)  # its download sends aseri's User-Agent, never a person's, and retries

DATA = Path(__file__).parent / "data"
# shortcut: the contents API lists at most 1,000 files (709 on 2026-10-31); page the git trees API past that.
LISTING = "https://api.github.com/repos/iacoviel/iacoviel.github.io/contents/gpr_archive_files"
# iacoviel.github.io/gpr_archive_files/ redirects here, the same files.
ARCHIVE = "https://www.matteoiacoviello.com/gpr_archive_files/"
NAME = re.compile(r"data_gpr_daily_recent_(\d{8})\.dta")

if __name__ == "__main__":
    DATA.mkdir(exist_ok=True)
    names = sorted(
        e["name"]
        for e in json.loads(gpr.download(LISTING)[0])
        if NAME.fullmatch(e["name"])
    )
    missing = [name for name in names if not (DATA / name).exists()]
    print(f"{len(names)} vintages listed, {len(missing)} to download")
    for i, name in enumerate(missing, 1):
        part = DATA / f"{name}.part"
        part.write_bytes(gpr.download(ARCHIVE + name)[0])
        part.rename(DATA / name)  # a cut download never passes for a cached vintage
        print(f"{i}/{len(missing)} {name}", flush=True)
        time.sleep(1)  # one file a second at most
