import { ditherMasks, useSteps } from "@/lib/motion"

// Dithers in on load, in 8 steps of 30 ms.
export function Wordmark() {
  const step = useSteps(ditherMasks.length, 30)
  return (
    <h1
      className="flex flex-col items-center gap-3.5 text-primary"
      style={step === undefined ? undefined : { maskImage: ditherMasks[step] }}
    >
      <span lang="ja" className="font-wordmark text-[64px]/none sm:text-[96px]">
        焦り
      </span>
      {/* 16 px: the size DotGothic16 is drawn at, and twice Press Start 2P's grid. */}
      <span className="text-[16px]/[24px] text-secondary uppercase">
        <span lang="ja">あせり</span> · aseri
      </span>
    </h1>
  )
}
