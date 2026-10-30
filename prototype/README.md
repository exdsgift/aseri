# Prototype: the forecast drawn as a possible path (throwaway)

Question (owner, 2026-10-30): the sea-lane forecasts looked flat. The owner wanted the forecast side to read like the past, as a line, "like the Timestral page".

Findings:
- The flat medians are Timestral's real output. `flat_check.py` calls the model directly and gets the published median within 0.0001.
- They are flat because Suez, Taiwan and Bab el-Mandeb have no weekly cycle (lag-7 autocorrelation 0.01 to 0.21).
- `replay_check.py` scores the 120-day replay: 80% bands cover 78 to 90%, and the median ties the 28-day mean on three lanes.

Verdict:
- One possible path, rotating every 1.2 s, over the 5 in 10 and 8 in 10 bands.
- What happened after a past forecast is shown.
- The replay slider looks like Timestral's: a dotted track, a square handle and a label beside it.
- No overlapping paths ("non si capisce nulla").
- The owner then chose to keep the deployed site's visual style (dithered bands, colours, marks) and change only the forecast side and the slider's look.

`index.html` is the last version shown (data inline, from the run of 2026-10-30), https://claude.ai/artifact/ByspZyJsh29m4FEEMBxCVm. The day-to-day tie (rho) per series is the lag-1 correlation of the normal scores of where real days fell in the backtest: GPR 0.45, Suez -0.26, Taiwan 0.15, Hormuz 0.07.
