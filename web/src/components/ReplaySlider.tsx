import {
  useEffect,
  useId,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react"

import { type Forecast } from "@/lib/api"
import { monthDay } from "@/lib/format"
import { isShortcut } from "@/lib/keys"

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

// Picks which forecast the panel shows: one of the last 120 days, or today's, the last one.
export function ReplaySlider({
  forecasts,
  shown,
  setShown,
}: {
  forecasts: Forecast[]
  shown: number
  setShown: Dispatch<SetStateAction<number>>
}) {
  const id = useId()
  const slider = useRef<HTMLInputElement>(null)
  const last = forecasts.length - 1
  const live = shown === last
  const made = (index: number) => monthDay(forecasts[index].dates.at(-1)!)

  // ←/→ move one day and T comes back to today, unless a field has the focus:
  // a focused slider already moves itself on the arrows.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return
      const move = {
        ArrowLeft: (day: number) => Math.max(0, day - 1),
        ArrowRight: (day: number) => Math.min(last, day + 1),
        t: () => last,
        T: () => last,
      }[event.key]
      if (move) setShown(move)
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [last, setShown])

  // Where a day sits on the track: the handle's centre runs 10 px in from each end.
  const at = (index: number) => `calc(10px + (100% - 20px) * ${index / last})`

  return (
    <div className="flex flex-col gap-1.5 border-t-2 border-border pt-2.5">
      <p className="text-muted-foreground">
        <label htmlFor={id}>Replay a past forecast</label>
      </p>
      <div className="relative">
        {/* A dotted track, one dot a week counted back from today, and the handle's day beside it,
            on the side with room. For the eye: the slider says the day itself. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: Math.floor(last / 7) + 1 }, (_, week) => (
            <i
              key={week}
              className={`absolute top-1/2 -mt-0.5 -ml-0.5 size-1 ${last - 7 * week <= shown ? "bg-muted-foreground" : "bg-border"}`}
              style={{ left: at(last - 7 * week) }}
            />
          ))}
          {/* 12 px off the handle's centre, past its 10 px half, on the page colour over the dots. */}
          <span
            data-testid="handle-label"
            className="absolute top-1/2 -mt-1.5 bg-background px-1 whitespace-nowrap text-primary"
            style={{
              left: at(shown),
              translate: shown > last / 2 ? "calc(-100% - 12px)" : "12px",
            }}
          >
            {live ? "Forecast" : made(shown)}
          </span>
        </div>
        <input
          ref={slider}
          id={id}
          type="range"
          min={0}
          max={last}
          step={1}
          value={shown}
          aria-valuetext={
            live
              ? "Today"
              : `${made(shown)}${forecasts[shown].backtest ? ", backtest" : ""}`
          }
          onChange={(event) => setShown(event.target.valueAsNumber)}
          className={`relative pixel-range block h-7 w-full ${focusRing}`}
        />
      </div>
      <p className="flex justify-between gap-2 text-muted-foreground">
        <span>{made(0)}</span>{" "}
        <span>
          <span className="text-key">[‹][›]</span> 1 day ·{" "}
          <span className="text-key">[T]</span> today
        </span>{" "}
        <span>Today</span>
      </p>
      {/* Hidden today but holding its place, so nothing below moves as the replay starts. */}
      <button
        type="button"
        aria-keyshortcuts="T"
        onClick={() => {
          setShown(last)
          // The button hides with the replay: the focus stays on the slider.
          slider.current!.focus()
        }}
        style={live ? { visibility: "hidden" } : undefined}
        className={`flex cursor-pointer flex-col items-start gap-0.5 self-start bg-secondary px-2 py-1.5 text-[12px]/[18px] text-background uppercase hover:bg-white motion-safe:transition-colors motion-safe:duration-160 ${focusRing}`}
      >
        <span aria-hidden>[T]</span>
        <span>Back to today</span>
      </button>
    </div>
  )
}
