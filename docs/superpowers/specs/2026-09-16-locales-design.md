# Multiple locales: English and Czech

Nine speaks English to everyone. This adds Czech, picks a language from the system on
first launch, and lets the player change it in options.

The plumbing is the easy half. This app's text is unusually shaped — randomized pools
of variants, a 40-character announcement bar, game-over titles that are pairs of
exactly-four-letter words — and those shapes, not the string count, are what the design
has to hold.

## Decisions taken before this document

- **Everything is translated**, including the how-to-play guide and the historical
  what's-new archive.
- **Claude drafts the Czech, Dominik reviews and corrects it** before it ships.
- **Lingui** (`@lingui/core` + `@lingui/react`), chosen over a hand-rolled typed
  dictionary and over Paraglide.
- **Per-locale date and number display**, and **localized server-error copy**, both
  pulled into scope.

## Why Lingui

It is the only i18n library with genuinely first-party React Native support: an official
Expo Metro transformer, a dedicated React Native guide, and an `I18nProvider` that
re-renders the tree on `i18n.activate()`.

That last point is what rules out **Paraglide**, which is otherwise the better compiler:
its `setLocale()` works by reloading the document, `{ reload: false }` is documented as a
browser-only escape hatch, and every built-in locale strategy — cookie, url,
localStorage, sessionStorage, `preferredLanguage`, `documentElement.lang` — is web-only.
Adopting it here would mean maintaining an `overwriteGetLocale`/`overwriteSetLocale`
bridge and a forced re-render.

Lingui also brings what a dictionary cannot: `.po` catalogs a non-developer can
translate, ICU plurals if Czech ever needs 1 / 2–4 / 5+ forms, and message ids generated
from source text, so there are no keys to invent or keep in sync.

**The honest trade** is that a typed dictionary (`type Messages = typeof en`) would have
made `tsc` the completeness check for free and added no build step at all, and this app
has no plurals and exactly one placeholder. Lingui is the better technology; the
dictionary was the smaller fit. The deciding argument is longevity — a third locale or an
outside translator makes the dictionary a liability, and migrating later costs more than
starting here.

## Architecture

### Messages are descriptors, not strings

The load-bearing decision. `lib/` holds `msg` descriptors at module level and returns
them; only components resolve them to text.

```ts
import { msg } from '@lingui/core/macro'

const ANNOUNCEMENT_MESSAGES = {
  record: [msg`You beat your best`, msg`A better you` /* … */],
  todayRaised: [msg`{name} now leads today` /* … */],
}
```

Lingui's own rule forbids module-level `t` — it resolves once and never reacts to a
locale change — and prescribes `msg`/`defineMessage` for exactly this case. It happens to
solve the pools problem outright: a pool stays an array that tests can iterate, and
`messagePool(id)` keeps returning one.

It also preserves CLAUDE.md's "`lib/` = pure helpers, no side effects" rule. A `lib/`
function returning descriptors touches no singleton and needs no active locale; the
component calls `i18n._(descriptor)` at the edge. Without this, every `lib/` function
would reach for the `i18n` global — and `i18n._()` **throws** when no locale is active,
not just in development.

### Catalogs and the build step

`lingui.config.ts` declares locales `en` and `cs`, with `en` as the source. The workflow
is `lingui extract` (updates `.po`) then `lingui compile` (emits runtime catalogs).

**The Metro transformer is deliberately not used.** `@lingui/metro-transformer` sets
`babelTransformerPath`, and `metro.config.js` already hands that to `withNativewind`.
Rather than have the two fight over it, compiled JS catalogs are imported like any other
module.

Compiled catalogs are generated output: gitignored, and produced by a `lingui compile`
step that runs ahead of `start`, `build:web`, `check` and every CI job. A fresh clone
must compile before it can typecheck or test.

### Babel

No `babel.config.js` exists today; Expo SDK 55 applies `babel-preset-expo` implicitly.
One is added that keeps the preset and adds `@lingui/babel-plugin-lingui-macro`. The
preset must be preserved — `app.json` sets `experiments.reactCompiler`, and
`babel-preset-expo` is what wires the React Compiler in.

### Vitest

This repo's tests are `environment: 'node'` with `include: ['**/*.test.ts']`, and
`vitest.config.ts` has no React or Babel plugin — so macros would reach the tests
unexpanded. It gains `@lingui/vite-plugin` and the macro Babel plugin.

Tests then follow Lingui's documented pattern: `i18n.load({ en, cs })`, then
`i18n.activate(locale)` per case. Because `lib/` returns descriptors, this stays pure
function testing — no renderer, no provider, no jsdom.

### Locale resolution and persistence

`expo-localization` supplies the system default: the first tag whose `languageCode` is
`cs` selects Czech, anything else English. A user choice overrides it and persists under
`LOCALE_KEY = 'nine.locale.v1'`. Resolution is a pure function — tag list in, locale out
— tested directly.

`I18nProvider` wraps the tree in `app/_layout.tsx`, alongside `AppThemeProvider`.
Components use `useLingui()` so a switch re-renders them.

`hooks/use-display-options.ts` carries the same `finally { hydrated.current = true }`
defect fixed in `use-persisted-stats.ts` on 2026-09-16 — a read that throws opens the
write gate, and the next change overwrites the stored value with defaults. The locale
hook uses the `hydrateFrom` gate from `lib/stats-hydration.ts`, and
`use-display-options.ts` is repaired the same way in phase 1.

### The options control

A segmented `EN | CS` control in `advanced-options-overlay.tsx`, beside the existing
`THEME` row and shaped like `ThemeToggle`.

### Guide and news archive

Here Lingui is clearly better than the dictionary alternative: `how-to-play-overlay.tsx`
wraps its prose in `<Trans>` in place, keeping 593 lines of JSX as JSX instead of
extracting two hundred keys into a content module.

`constants/news.ts` bodies become `msg` descriptors resolved at render. **Item ids stay
exactly as they are** — seen-state is keyed on them, so a changed id silently re-shows an
old announcement to every player.

### Dates, numbers, and server errors

Display only:

- `lib/format-date.ts` holds a hardcoded English `MONTHS` array. Czech dates take the
  genitive (`16. září 2026`), so the month list and the assembly pattern both become
  translatable rather than assuming `{day} {month} {year}`.
- `lib/time-ago.ts` suffixes (`Y MO W D H M`, `NOW`, `AGO`) become descriptors.
- Server-error copy surfaced in the UI — `already_taken` in `nickname-modal.tsx`,
  `NOT PUBLISHED` / `NOT SYNCED` / `UNAVAILABLE` in `tab-panel.tsx`,
  `lib/feedback-outcome.ts` — maps by code to descriptors.

**The Prague clock does not move.** `lib/leaderboard-period.ts` draws every board
boundary on one shared Prague clock so all players roll over at the same instant.
Localizing it would let two players disagree about which week a score belongs to. Only
the rendering of a date changes; never which day or week it falls in.

## The four-letter problem

`lib/game-over-title.ts` holds six tiers of three variants, each a pair of words:

```ts
crown: [
  ['BEST', 'EVER'],
  ['KING', 'NINE'],
  ['PEAK', 'FORM'],
]
```

Every word is exactly four letters, and `lib/game-over-title.test.ts` asserts it
(`expect([first.length, second.length]).toEqual([4, 4])`), because the dying sequence
flies the letters into a 4×2 grid — a five-letter word falls off the ramp.

Czech equivalents mean 36 words of exactly four letters that read as triumphant or
gently consoling. Some land (`KRÁL NINE`); a full set of eighteen pairs may not. Three
ways out, in the order they should be tried:

1. **Find Czech four-letter pairs.** Best outcome, uncertain. Attempted first, tier by
   tier, with Dominik reviewing — this is precisely the copy where a flat translation
   would be obvious.
2. **Make the grid locale-aware.** Let the ramp take five or six letters in Czech.
   Changes an animation that is currently exact and tuned for four.
3. **Keep the titles in English**, as arcade-cabinet display styling rather than prose.
   Contradicts "everything is translated", so it needs Dominik's explicit sign-off.

Note that `BEST EVER` appears in both the `crown` and `allTime` tiers. Lingui generates
ids from source text, so both resolve through one catalog entry and cannot drift apart —
a small improvement on the duplicated literals there today.

**This is an open decision.** The phase-2 plan attempts (1) and escalates rather than
picking (2) or (3) unilaterally.

## The forty-character problem

`lib/announcements.test.ts` ("keeps every line short enough for the bar, once a name is
substituted") asserts that every line in every pool, with the longest nickname
substituted, fits `MAX_MESSAGE_LENGTH = 40`. English lines already sit at 28+ characters,
and Czech typically runs 10–20% longer.

Under Lingui this test gets stronger: it activates each locale and measures the **actual
resolved output** from the compiled catalog, rather than a literal in a source file.

If Czech does not fit, **the Czech gets shorter — the cap does not get raised.** Forty
characters is the width of the announcement bar, not a preference.

## Testing

- `lib/announcements.test.ts` loops both locales through the existing assertions: no
  duplicate lines in a pool, every rival line has a `{name}` placeholder, every resolved
  line inside the cap.
- `lib/game-over-title.test.ts` loops both locales through the four-letter assertion,
  unless decision (2) or (3) above is taken, in which case it is revised to match.
- A catalog-completeness test: no `cs` entry left untranslated. `lingui extract` reports
  this, but a test is what fails CI.
- Locale resolution tested directly as a pure function.
- `pnpm check` remains the gate, with `lingui compile` ahead of it.

## What this costs

Stated plainly, because it is the price of the choice and the plan should not discover it
later:

- Three new build-time dependencies plus `expo-localization`, a new `babel.config.js`, a
  `lingui.config.ts`, and a compile step in front of four existing scripts.
- `.eas/workflows/deploy.yml` and `preview.yml` each gain a compile step; without it,
  typecheck and knip fail on missing catalogs.
- `knip` must be taught to ignore generated catalogs.
- A fresh clone cannot typecheck or test until `lingui compile` has run once.
- Contributors edit `.po` files for copy, not TypeScript.

## Phasing

Three phases, each shippable on its own.

| Phase | Contents                                                                                                                                                                         | Leaves the app                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1     | Lingui + Babel + Vitest wiring, `lingui.config.ts`, CI compile steps, `expo-localization`, persistence + the `use-display-options` repair, options control, `components/` chrome | Switcher works; chrome Czech, game text English     |
| 2     | `lib/` game text — announcements, coach lines, hit praise, game-over titles, dates, server errors                                                                                | Gameplay fully Czech; four-letter decision resolved |
| 3     | How-to-play guide via `<Trans>`, news archive                                                                                                                                    | Everything Czech                                    |

All the toolchain risk is in phase 1, and it is larger than it was under the dictionary
design — the NativeWind/Metro overlap and the Vitest macro wiring are the two places
phase 1 can go wrong. Phases 2 and 3 are mostly copy against a proven pattern, which is
why the four-letter decision sits in phase 2 rather than blocking the start.

## Out of scope

- Nicknames and leaderboard rows — user-generated and server-held; not translatable.
- Board semantics — boards are shared across locales, as are their Prague-clock
  boundaries.
- DSEG7 digits — the font renders numbers only, so diacritics never reach it.
- A third locale. Lingui makes one cheap, but nothing here is built speculatively for it.
