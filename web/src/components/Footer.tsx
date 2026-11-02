import { arts } from "@/components/Hero"
import { heroes, type Choice } from "@/lib/heroes"

const repository = "https://github.com/exdsgift/aseri"
const choices: Choice[] = [...heroes, "rotate"]
const named = (choice: Choice) => choice[0].toUpperCase() + choice.slice(1)
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
const link = `underline hover:text-primary ${focusRing}`

// The foot of the page: who made it, under which licences, the reader's choice of hero,
// and the engravings behind them.
export function Footer({
  choice,
  onChoose,
}: {
  choice: Choice
  onChoose: (choice: Choice) => void
}) {
  return (
    <footer className="px-4 pb-14 text-center text-[8px]/[14px] text-muted-foreground uppercase">
      <div className="mx-auto flex max-w-[72ch] flex-col items-center gap-3 border-t-2 border-border pt-6">
        <p className="text-secondary">aseri</p>
        <p>© 2026 Gabriele Durante</p>
        <p>
          Code:{" "}
          <a href={`${repository}/blob/master/LICENSE`} className={link}>
            MIT
          </a>{" "}
          · Forecasts and data:{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc/4.0/"
            className={link}
          >
            CC BY-NC 4.0
          </a>
        </p>
        <p>
          <a href="api/" className={link}>
            The data, as an API, and its licences
          </a>
        </p>
        <p>
          Source:{" "}
          <a href={repository} className={link}>
            {repository.slice(8)}
          </a>
        </p>
        {/* The page shows the heroes in turn, unless the reader picks one. */}
        <div
          role="group"
          aria-labelledby="hero-choice"
          className="flex flex-wrap items-center justify-center gap-1"
        >
          <span id="hero-choice" className="mr-1">
            Hero
          </span>
          {choices.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={choice === value}
              onClick={() => onChoose(value)}
              className={`cursor-pointer px-1.5 py-1 uppercase hover:bg-white hover:text-background aria-pressed:bg-secondary aria-pressed:text-background motion-safe:transition-colors motion-safe:duration-160 ${focusRing}`}
            >
              {named(value)}
            </button>
          ))}
        </div>
        {/* The engravings, all in the public domain, cropped and dithered for the page. */}
        <ul className="flex flex-col gap-1">
          {heroes.map((hero) => (
            <li key={hero}>
              {named(hero)}: {arts[hero].credit.work}, CC0, from{" "}
              <a href={arts[hero].credit.source} className={link}>
                Wikimedia Commons
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
