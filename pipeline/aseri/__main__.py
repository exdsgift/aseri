"""The daily run: fetch GPR, forecast every new day, archive and publish. Usage: python -m aseri API_DIR ARCHIVE_DIR"""

import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

from aseri import archive
from aseri.forecast import forecast, load_model
from aseri.publish import publish
from aseri.series import GPR_DAILY
from aseri.sources import gpr


def main(api_dir: Path, archive_dir: Path) -> None:
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
    generated_at = datetime.now(UTC)
    observed, as_of = gpr.fetch(GPR_DAILY.source["data_url"])
    archived = archive.read(archive_dir, GPR_DAILY.id)
    ran_today = archive.ran_on(archive_dir, generated_at.date())
    new_dates = (
        []
        if ran_today
        else archive.new_reference_dates(
            observed, [a.forecast.reference_date for a in archived]
        )
    )
    if not ran_today and (
        new_dates or archive.has_new_observations(archive_dir, GPR_DAILY.id, observed)
    ):
        forecasts = []
        if new_dates:
            model = load_model()
            for day in new_dates:
                # Each forecast sees only the data up to its own date.
                forecasts.append(forecast(model, observed.loc[:day], GPR_DAILY.horizon))
                # The launch backfill takes minutes, so the log shows it moving.
                print(
                    f"{GPR_DAILY.id}: forecast {len(forecasts)} of {len(new_dates)}, from {day:%Y-%m-%d}",
                    flush=True,
                )
        archive.write(
            archive_dir,
            GPR_DAILY,
            forecasts,
            observed=observed,
            as_of=as_of,
            code_commit=code_commit,
            run_url=run_url,
            generated_at=generated_at,
        )
        archived = archive.read(archive_dir, GPR_DAILY.id)
    publish(
        api_dir,
        GPR_DAILY,
        archived,
        observed=observed,
        as_of=as_of,
        generated_at=generated_at,
    )
    print(
        f"{GPR_DAILY.id}: {len(new_dates)} new forecasts, the latest from "
        f"{archived[-1].forecast.reference_date:%Y-%m-%d}, data as of {as_of}"
    )


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
