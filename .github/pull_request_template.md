## What and why

<!-- One or two sentences on what changes and why. Link the issue: Closes #123 -->

## Checks run

Pipeline, in `pipeline/`:

- [ ] `uv run ruff check` and `uv run ruff format --check`
- [ ] `uv run pytest`
- [ ] `uv run pytest -m slow`, if the model, its inputs or its offsets changed

Page, in `web/`:

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`, with the contrast, word-budget and copy tests
- [ ] `npm run build`, then `node scripts/budget.js`
- [ ] `node scripts/brand.mjs`, if the heroes' art, the fonts or the tokens changed

## Screenshots

<!-- For any visual change: before and after, at 1440 px and at 390 px. If it moves, also with reduced motion. Delete this section otherwise. -->

## Model ID

- [ ] No published quantile changes: the model ID stays as it is.
- [ ] Published quantiles change: a new `MODEL_ID` in `pipeline/aseri/forecast.py`, goldens regenerated, and the reason below.

<!-- The reason, and the ADR or issue that decided it. -->

## Data and licences

- [ ] No new source; or its licence is checked, its text is in `api/licenses/`, and its attribution is in the registry.
