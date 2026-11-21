# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private reporting: [report a vulnerability](https://github.com/exdsgift/aseri/security/advisories/new). Say what you found, how to reproduce it and what it could do. A report is answered as soon as the owner can, usually within a week, and a fix is released before the details are public.

## What is in scope

- The code in this repository: the pipeline (`pipeline/`), the page (`web/`) and the workflows (`.github/workflows/`).
- The published site and API at <https://exdsgift.github.io/aseri/>: it is static files, with no server, no database and no login.
- The build: a way to change an archived forecast, to publish a file the gate would refuse, or to leak a secret from a workflow.

## What is not

- A forecast being wrong. Forecasts are statistical and scored in the open; report a wrong *value* or a broken file as a [bug](https://github.com/exdsgift/aseri/issues/new?template=bug.md).
- The upstream data sources and Mistral's model. Report those to their own projects.

## Supported versions

Only the current `master` and the files published from it are supported.
