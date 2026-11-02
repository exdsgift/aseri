import { arts } from "@/components/Hero"
import { Mark } from "@/components/Pictogram"
import { heroes, type Choice } from "@/lib/heroes"

const repository = "https://github.com/exdsgift/aseri"
const choices: Choice[] = [...heroes, "rotate"]
const named = (choice: Choice) => choice[0].toUpperCase() + choice.slice(1)
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
// A link in the text: 24 px tall to tap (WCAG 2.5.8), its 8 px of type and 8 px of padding
// above and below that move no line, the lines spaced so no two such targets overlap.
const link = `py-2 underline hover:text-primary ${focusRing}`
// The author elsewhere: the owner's profiles, not the repository, which "Source" links.
const elsewhere = [
  ["GitHub", "github", "https://github.com/exdsgift"],
  ["LinkedIn", "linkedin", "https://www.linkedin.com/in/gabrieledurante/"],
  ["Buy me a coffee", "coffee", "https://buymeacoffee.com/exdsgift"],
] as const

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
    // The bottom inset (a home indicator) under the last line.
    <footer className="px-4 pb-[calc(56px+env(safe-area-inset-bottom))] text-center text-[8px]/[14px] text-muted-foreground uppercase">
      <div className="mx-auto flex max-w-[72ch] flex-col items-center gap-3 border-t-2 border-border pt-6">
        <p className="text-secondary">aseri</p>
        <p>© 2026 Gabriele Durante</p>
        {/* White marks, gold under the pointer or the focus: the one accent, as a mark. Each a
            44 px target, its 32 px mark and 6 px round it. */}
        <div className="flex justify-center gap-2">
          {elsewhere.map(([name, mark, href]) => (
            <a
              key={mark}
              href={href}
              target="_blank"
              rel="noopener"
              aria-label={name}
              className={`p-1.5 text-primary hover:text-forecast focus-visible:text-forecast motion-safe:transition-colors motion-safe:duration-160 ${focusRing}`}
            >
              <Mark name={mark} />
            </a>
          ))}
        </div>
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
        {/* The page shows the heroes in turn, unless the reader picks one. Each choice a 44 px
            target round its 22 px block: rows and neighbours set apart so none overlap. */}
        <div
          role="group"
          aria-labelledby="hero-choice"
          className="my-1 flex flex-wrap items-center justify-center gap-x-1 gap-y-[22px]"
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
              className={`hit cursor-pointer px-1.5 py-1 uppercase hover:bg-white hover:text-background aria-pressed:bg-secondary aria-pressed:text-background motion-safe:transition-colors motion-safe:duration-160 ${focusRing}`}
            >
              {named(value)}
            </button>
          ))}
        </div>
        {/* The engravings, all in the public domain, cropped and dithered for the page. */}
        <ul className="flex flex-col gap-2.5">
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
