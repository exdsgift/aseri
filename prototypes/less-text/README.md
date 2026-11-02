# Prototype: the page with less text (throwaway)

Question (owner, 2026-11-02): the page says too much (about 906 words) and "8 in 10" is not clear enough. Which direction cuts the words and makes the stats clearer?

`index.html` is one self-contained page, top to bottom: hero, forecast panel with chart and replay, 3 signal cards and the record. It applies the uncontested changes of the study ([Comunicare le previsioni con meno testo](../../docs/research/reports/Comunicare%20le%20previsioni%20con%20meno%20testo.md), changes 1, 3, 4, 5, 8, 9, 11 and 12) in the electric-blue palette of `ticket-150-blue-rotation`. Data: one snapshot of the live API (generated 2026-11-01), GPR plus Suez, Hormuz and Bab el-Mandeb, trimmed and inlined.

The bottom bar switches the variants, kept in the URL, and shows the default view's word count:

| Switch | Options | URL |
|---|---|---|
| Stats wording | A: "likely 110-250", with "8 in 10 days land here" and "2 in 10 outside" on the band. B: a 20-block stack of possible values at the target day ("■ = 1 in 20 chance"), in the chart and in the hero. C: "80% range 110-250", "80% of days land here" | `stats=A`, `B`, `C` |
| Path label | none, as today; "1 of 20 possible paths" written on the line | `label=none`, `line` |
| First view | open on path 1, as today; play the 20 paths once (0.4 s each) and stop on path 1. No autoplay under reduced motion | `first=still`, `play` |
| Replay verdict | none; a filled or hollow square under each resolved day, then "3 of 5 days in range" | `verdict=none`, `squares` |

`?at=2026-10-19` opens GPR's forecast of that day in the replay.

Default view, words at 390 px (today's page: about 906):

| Stats | Path label none | Path label on the line |
|---|---|---|
| A | 257 | 262 |
| B | 255 | 260 |
| C | 252 | 257 |

First view and replay verdict add no words to the default view.

Kept from the owner's decisions: only the model's paths, never a median line; it opens on "Path 1 of 20, the most likely" and Play cycles the rest; no dashed or dotted line anywhere (the normal line, the origin, the value ticks and the slider's week ticks are solid); in a replay, what happened is a white line carrying on from the history.

Prototype liberties, not proposals: the chart shows 2 weeks of history on a phone and 4 on a desktop (today 4 and 8), so the labels on the band have room; on a phone the replay's squares sit in a strip in day order, as the days are 6 px apart; there are no keyboard hints, no scan-in, no count-up and no side navigation.
