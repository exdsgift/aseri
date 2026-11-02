# Contributing to aseri

aseri does one thing: a few clean public series, forecast daily, shown clearly. Before a large change, open an issue so the scope is agreed first. The owner decides what goes in.

## Setup

```sh
git clone https://github.com/exdsgift/aseri && cd aseri
cd pipeline && uv sync   # Python 3.12, uv
cd ../web && npm ci      # Node 22, npm
```

`npm run dev` in `web/` serves the page and reads the published API through a proxy, so it needs no pipeline run.

## Checks

CI runs the same commands on every push ([`ci.yml`](.github/workflows/ci.yml)). Run them before you open a pull request.

| Where | Command | What it checks |
|---|---|---|
| `pipeline/` | `uv run ruff check` and `uv run ruff format --check` | Lint and format |
| `pipeline/` | `uv run pytest` | Transforms, scoring, the Hubverse writers, the archive rule, the gate |
| `pipeline/` | `uv run pytest -m slow` | The real model against its golden quantiles (downloads 837 MB once) |
| `web/` | `npm run lint` | ESLint and Prettier |
| `web/` | `npm run typecheck` | `tsc` |
| `web/` | `npm test` | Vitest, with the contrast, word-budget and copy tests |
| `web/` | `npm run build`, then `node scripts/budget.js` | The build, and the page's size budget |

## Add a new series

1. **Propose it in an issue,** with the "New series" template: the source, its licence and terms, its cadence, how far back it goes, and why it matters.
2. **Check the licence first.** Its terms must allow forecasts derived from it to be published under CC BY-NC 4.0, with attribution. A source whose terms forbid this use is never added. Put its licence text in `api/licenses/`.
3. **Write the source adapter** in `pipeline/aseri/sources/`, one module per source: fetch with retries, validate the body (a 200 can carry an error), and return a daily series. Test it on a small recorded file in `pipeline/tests/fixtures/`.
4. **Add the registry entry** in `pipeline/aseri/series.py`, and the series with its adapter to `SOURCES` in `pipeline/aseri/__main__.py`. The `id` is public and permanent: it is the API path and the Hubverse target. Give the unit, the horizon in whole weeks, the interval steps, the revision window and deep-revision rule, the expected lag, the score lag, the edge check, the record weekday, any standing note, and the source and licence with its attribution. Comment the evidence behind each number, as the other entries do.
5. **Pick the primary baseline on a backtest,** by [ADR 0001](docs/adr/0001-baselines-and-calibration-before-the-live-record.md)'s rule 1: of naive, `snaive7` and `mean28`, the one with the lowest mean absolute error. Write the numbers in the comment.
6. **Register known measurement errors** in `pipeline/aseri/anomalies.csv`, one row per series and day, with the evidence. The model's context leaves those days blank; the actuals and the scores keep them.
7. **Give it a card:** its group and pictogram in `web/src/components/Signals.tsx`. Each series may add at most 30 words to the default view.
8. **Regenerate the fixtures through the pipeline's writers,** never by hand: run the pipeline and copy the series' files into `web/src/fixtures/`. The gate's tests check them against the API contract.
9. **Mind the model ID.** Anything that changes published quantiles needs a new `MODEL_ID` in `pipeline/aseri/forecast.py` (ADR 0001, rule 4): a calibration offset in `offsets.csv`, the context, the inputs, an ensemble, or the weights or package pin. Regenerate the goldens with it, and only with it: `uv run python -m tests.test_real_model` in `pipeline/`. A primary baseline, the anomalies register and the page never change the model ID.

## Add a chart or a visual

- **Pixel art.** Charts are custom canvas components, drawn at 2 CSS px per art pixel with `image-rendering: pixelated` and Bresenham lines. Bands are a 4x4 Bayer dither. No dashed or dotted lines in charts.
- **One accent.** Gold, `--forecast`, is the model's path: a mark colour, never text. Everything else is white on electric blue, every tint on the line from the ground to white. Every word casts the 1 px `--drop` shadow, set once in `web/src/index.css`.
- **Tokens and contrast.** Colours come only from the tokens in `web/src/index.css`. `web/src/contrast.test.ts` checks text at 4.5:1, marks at 3:1, APCA, and the path against the real values under colour-blindness; a new token gets its checks there.
- **Words.** The default view stays under its word budget (`web/src/words.test.tsx`). Copy passes the lint in `web/src/App.test.tsx`: a range reads "likely 33-51" or "8 in 10 days land here", never as a promise or a "% confidence", and never with an em dash.
- **Fonts.** Press Start 2P at 8, 12, 16 or 24 px for UI text; Jacquard 24 for big numbers and titles; DotGothic16 for the wordmark.
- **Size.** Under 150 KB gzipped of JS and CSS, and under 100 KB gzipped of first-load data (`node scripts/budget.js`).
- **Motion.** The first frame reads at rest. `prefers-reduced-motion` turns every animation off, and nothing flashes more than 3 times a second.
- **Prototype first.** Explore on a throwaway `prototype-<name>` branch, publish the options as an artifact, and let the owner choose. The chosen one is rewritten properly, never ported.

## Brand images

The images in `branding/`, the favicons and the README's screenshots are drawn by the site's own code, never by hand. After a change to the heroes' art, the fonts or the tokens, draw them again from `web/`:

```sh
npx playwright install chromium webkit   # once
node scripts/brand.mjs                   # every image, the favicons and the screenshots
```

[`branding/README.md`](branding/README.md) lists every format and how to redraw only some.

## Commits and pull requests

- **One issue, one branch, one pull request:** `ticket-<number>-<name>` for work, `prototype-<name>` for throwaway prototypes.
- **Commit subjects** name the area, then what changed, in plain words, with the issue: `pipeline: a forecast out of bounds is held alone (#151)`. The areas are `pipeline`, `web`, `api`, `docs`, `ci` and `branding`, joined with commas when a commit spans several.
- **Pull requests** fill in the template, pass CI, and answer review findings in their own commits: `web: address the #152 review`.
- **Deploys.** A push to master that touches only `web/` deploys the page in about 2 minutes, on the API files of the last deploy. Anything else waits for the next daily run at 07:00 UTC, or for a manual run of the `daily` workflow with `page_only` ticked, which deploys the page alone.

## Decisions

- A decision that is hard to reverse, or that changes what the record means, gets an ADR in `docs/adr/`, as `NNNN-short-title.md` with a `status` line.
- Fix the rules before running the experiment, and commit them first: ADR 0001 committed its rules before any backtest forecast was made.
- Give the owner the options and the evidence. The ADR records the choice under **Decision**, and the options not taken stay in it.
- The design lives in [the spec](docs/superpowers/specs/2026-10-29-aseri-design.md), the evidence in `docs/research/`.
