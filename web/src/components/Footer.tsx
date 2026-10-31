import { type Choice } from "@/lib/heroes"

const repository = "https://github.com/exdsgift/aseri"
// The heroes' engravings, all in the public domain, cropped and dithered for the page.
const engravings = [
  [
    "Messenger",
    "Hendrick Goltzius after Polidoro da Caravaggio, Mercury, probably 1592, National Gallery of Art",
    "https://commons.wikimedia.org/wiki/File:Hendrik_Goltzius_after_Polidoro_da_Caravaggio,_Mercury,_probably_1592,_NGA_60693.jpg",
  ],
  [
    "Signal",
    "Hendrick Goltzius, The Farnese Hercules, c. 1592, published 1617, The Metropolitan Museum of Art",
    "https://commons.wikimedia.org/wiki/File:Farnese_Hercules_MET_DP102198.jpg",
  ],
  [
    "Vortex",
    "Apollo Belvedere (Apollo Pythius), engraving, Rijksmuseum",
    "https://commons.wikimedia.org/wiki/File:Apollo_Belvedere_Apollo_Pythius_(titel_op_object),_RP-P-OB-102.457.jpg",
  ],
]
const choices: [Choice, string][] = [
  ["messenger", "Messenger"],
  ["signal", "Signal"],
  ["vortex", "Vortex"],
  ["rotate", "Rotate"],
]
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
          {choices.map(([value, name]) => (
            <button
              key={value}
              type="button"
              aria-pressed={choice === value}
              onClick={() => onChoose(value)}
              className={`cursor-pointer px-1.5 py-1 uppercase hover:bg-white hover:text-background aria-pressed:bg-secondary aria-pressed:text-background motion-safe:transition-colors motion-safe:duration-160 ${focusRing}`}
            >
              {name}
            </button>
          ))}
        </div>
        <ul className="flex flex-col gap-1">
          {engravings.map(([hero, work, source]) => (
            <li key={hero}>
              {hero}: {work}, CC0, from{" "}
              <a href={source} className={link}>
                Wikimedia Commons
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
