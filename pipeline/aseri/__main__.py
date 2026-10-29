"""The daily run: fetch GPR, forecast it and write the API files. Usage: python -m aseri API_DIR"""

import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

from aseri.forecast import forecast, load_model
from aseri.publish import publish
from aseri.series import GPR_DAILY
from aseri.sources import gpr


def main(api_dir: Path) -> None:
    # Resolved first, so a checkout without git fails before the costly model load.
    code_commit = (
        os.environ.get("GITHUB_SHA")
        or subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        ).stdout.strip()
    )
    run_url = (
        f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
        if "GITHUB_RUN_ID" in os.environ
        else None
    )
    observed, as_of = gpr.fetch(GPR_DAILY.source["data_url"])
    result = forecast(load_model(), observed, GPR_DAILY.horizon)
    publish(
        api_dir,
        GPR_DAILY,
        result,
        as_of=as_of,
        code_commit=code_commit,
        run_url=run_url,
        generated_at=datetime.now(UTC),
    )
    print(
        f"{GPR_DAILY.id}: reference date {result.reference_date:%Y-%m-%d}, "
        f"{GPR_DAILY.horizon} days ahead, data as of {as_of}"
    )


if __name__ == "__main__":
    main(Path(sys.argv[1]))
