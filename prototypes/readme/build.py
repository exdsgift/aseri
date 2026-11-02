"""Refills index.html's embedded drafts from the .md files beside it, after a copy check. Run: python build.py"""

import re
from pathlib import Path

here = Path(__file__).parent
page = here / "index.html"


def fill(match: re.Match) -> str:
    name = match[2]
    text = (here / name).read_text(encoding="utf-8")
    assert "</script" not in text.lower(), f"{name} would close its script tag"
    assert "—" not in text, f"{name} has an em dash"
    assert not re.search(r"\bwill\b", text, re.I), f'{name} says "will"'
    return f"{match[1]}\n{text}</script>"


html = re.sub(
    r'(<script type="text/markdown" data-file="([^"]+)">).*?</script>',
    fill,
    page.read_text(encoding="utf-8"),
    flags=re.S,
)
page.write_text(html, encoding="utf-8", newline="\n")
print("index.html refilled from", ", ".join(sorted(p.name for p in here.glob("*.md"))))
