![Banner: Vortex, art only, wide, 1584x396](branding/linkedin-banner/linkedin-banner-vortex-art.png)

<h1 align="center">焦り aseri</h1>

<p align="center">How unstable is the world right now, and where is it heading?<br>Nine public signals, forecast every day.</p>

<p align="center"><a href="https://exdsgift.github.io/aseri/"><b>Open the page</b></a> · <a href="https://exdsgift.github.io/aseri/api/">Use the API</a></p>

| Messenger | Signal | Vortex |
|:---:|:---:|:---:|
| ![Hero: Messenger, portrait, 1080x1350](branding/linkedin-post/linkedin-post-portrait-messenger.png) | ![Hero: Signal, portrait, 1080x1350](branding/linkedin-post/linkedin-post-portrait-signal.png) | ![Hero: Vortex, portrait, 1080x1350](branding/linkedin-post/linkedin-post-portrait-vortex.png) |
| Goltzius's *Mercury*. His fans of rays open wider as the risk index climbs. | The *Farnese Hercules* on a failing screen. The large frame is the 7-day average, the small one normal. | The *Apollo Belvedere* in an op-art vortex. The arm turns one degree per point of risk. |

Each hero draws today's geopolitical risk. The page shows them in turn, and you can keep one from its foot.

## What it is

A GitHub Action runs at 07:00 UTC. It fetches nine public series, forecasts each with Mistral's Timestral-209M on CPU, and publishes the page and a JSON API. Every forecast is archived, never edited, and scored against what happened.

**The nine signals:** geopolitical risk · "World War III" on Wikipedia · Brent oil · Suez · Hormuz · Bab el-Mandeb · Taiwan Strait · air-raid alerts in Ukraine · drones downed, as claimed by Ukraine's General Staff.

**The data:** dated forecasts in the Hubverse format, with their track record, at [exdsgift.github.io/aseri/api](https://exdsgift.github.io/aseri/api/).

**Run it:** `uv run pytest` in `pipeline/`, `npm run dev` in `web/`. More in [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

Engravings, CC0 from Wikimedia Commons: Hendrick Goltzius after Polidoro da Caravaggio, *Mercury*, probably 1592, National Gallery of Art · Hendrick Goltzius, *The Farnese Hercules*, c. 1592, published 1617, The Metropolitan Museum of Art · *Apollo Belvedere (Apollo Pythius)*, engraving, Rijksmuseum. Model: Timestral-209M by Mistral AI.

Code: [MIT](LICENSE) · Forecasts and data: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), each source on its own terms · © 2026 Gabriele Durante

<p align="center"><a href="https://buymeacoffee.com/exdsgift">Buy me a coffee</a> · <a href="https://github.com/exdsgift">GitHub</a> · <a href="https://www.linkedin.com/in/gabrieledurante/">LinkedIn</a></p>
