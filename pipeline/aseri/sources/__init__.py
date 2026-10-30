"""One adapter per upstream source: each downloads its data and checks its contract."""

import time
import urllib.request
from http.client import HTTPException, HTTPMessage
from urllib.error import HTTPError

# Every request names the project, never a person, so a provider can see who calls.
USER_AGENT = "aseri (+https://github.com/exdsgift/aseri)"


def download(url: str) -> tuple[bytes, HTTPMessage]:
    """The file at `url` and its response headers, retried with exponential backoff (10 s to 80 s) before giving up."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read(), response.headers
        except (OSError, HTTPException) as error:
            # A 4xx will not fix itself; a 5xx, a timeout or a cut connection may.
            if attempt == 4 or (isinstance(error, HTTPError) and error.code < 500):
                raise
            time.sleep(10 * 2**attempt)
