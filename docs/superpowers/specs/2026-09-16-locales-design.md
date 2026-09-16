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
- **A typed dictionary module**, not Paraglide, not `i18n-js`. Reasoning in
  "Why not Paraglide" below.
- **Per-locale date and number display**, and **localized server-error copy**, both
  pulled into scope.

## Why not Paraglide

Paraglide works under Hermes — the compiler emits plain tree-shakable functions with no
DOM dependency, and `paraglide-js compile --outdir` is a supported bundler-free path, so
Metro would only ever see generated source. It was still the wrong pick here, for three
reasons found in this codebase rather than in the docs:

1. **No plural strings exist.** `timeAgo` uses single-letter suffixes (`5M AGO`);
   durations are `M:SS`. The only placeholder in the app is `{name}` in the rival
   announcements. ICU MessageFormat — the main draw beyond bundle size — buys nothing.
2. **Half the content is not a string table.** `ANNOUNCEMENT_MESSAGES` is pools of 3–4
   variants per id; `constants/news.ts` is structured data with markdown bodies;
   how-to-play is 593 lines of JSX prose. Flattening pools into `record_1`…`record_4`
   would destroy the thing the duplicate-detection and length tests iterate over.
3. **Every built-in locale strategy is web-only** — cookie, url, localStorage,
   sessionStorage, `preferredLanguage`, `documentElement.lang`. React Native would need
   an `overwriteGetLocale`/`overwriteSetLocale` bridge we maintain, plus a forced
   re-render, because `setLocale()` works by reloading the document and `{ reload: false }`
   is documented as a browser-only escape hatch.

A dictionary in TypeScript gives type-checked completeness, keeps pools as pools, needs
no build step, and re-renders for free because the locale is React state.

## Architecture

### Message modules

`lib/i18n/en.ts` is the source of truth and the only file that defines shape:

```ts
export const en = {
  common: { play: 'PLAY GAME', cancel: 'CANCEL' /* … */ },
  announcements: {
    record: ['You beat your best', 'A better you' /* … */],
    todayRaised: ['{name} now leads today' /* … */],
  },
  // …
} as const
```

`type Messages = typeof en`, and `lib/i18n/cs.ts` is declared `satisfies Messages`.
TypeScript then rejects a missing key, a renamed key, and a pool with the wrong number
of variants. `tsc` is the completeness check — there is no registry to keep in sync and
nothing to generate.

### Reading messages

`LocaleProvider` mirrors `AppThemeProvider` in `hooks/use-theme.tsx` and exposes
`useMessages(): Messages` and `useLocale(): { locale, setLocale }`. Components call
`useMessages()`.

**Pure `lib/` functions take `Messages` as a parameter** rather than importing it:
`messagePool(id, messages)`, `gameOverTitle({ …, messages })`. This is the load-bearing
decision. It keeps CLAUDE.md's "`lib/` = pure helpers, no side effects" rule true, keeps
all 41 test files running under `environment: 'node'` with no provider in sight, and
lets one test loop both locales through the same assertions.

### Locale resolution and persistence

`expo-localization` (new dependency, added with `npx expo install`) supplies the system
default: the first tag whose `languageCode` is `cs` selects Czech, anything else English.
A user choice overrides it and persists under `LOCALE_KEY = 'nine.locale.v1'`.

`hooks/use-display-options.ts` carries the same `finally { hydrated.current = true }`
defect that was fixed in `use-persisted-stats.ts` on 2026-09-16 — a read that throws
opens the write gate, and the next change overwrites the stored value with defaults. The
locale hook uses the `hydrateFrom` gate from `lib/stats-hydration.ts` instead, and
`use-display-options.ts` is repaired the same way as part of phase 1.

### The options control

A segmented `EN | CS` control in `advanced-options-overlay.tsx`, beside the existing
`THEME` row and shaped like `ThemeToggle`. Switching re-renders through React state; no
reload, no restart.

### Guide and news archive

Per-locale content modules, not key extraction. `how-to-play-overlay.tsx` keeps its
layout and takes prose from `lib/i18n/guide.{en,cs}.ts` as structured sections. Extracting
two hundred keys out of that JSX would leave worse code than exists today.

`constants/news.ts` items carry `title` and `body` as `{ en, cs }`. **Item ids stay
exactly as they are** — seen-state is keyed on them, so a changed id silently re-shows an
old announcement to every player.

### Dates, numbers, and server errors

Display only:

- `lib/format-date.ts` holds a hardcoded English `MONTHS` array; month names move into
  the message modules. Czech month names decline — the genitive is what a date takes
  (`16. září 2026`), so the Czech module stores the genitive forms and the formatter
  takes a locale-specific pattern rather than assuming `{day} {month} {year}`.
- `lib/time-ago.ts` suffixes (`Y MO W D H M`, `NOW`, `AGO`) move into the modules.
- Server-error copy surfaced in the UI — `already_taken` in `nickname-modal.tsx`,
  `NOT PUBLISHED` / `NOT SYNCED` / `UNAVAILABLE` in `tab-panel.tsx`,
  `lib/feedback-outcome.ts` — maps through the modules by code.

**The Prague clock does not move.** `lib/leaderboard-period.ts` draws every board
boundary on one shared Prague clock so that all players roll over at the same instant.
Localizing that would let two players disagree about which week a score belongs to. Only
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
(`expect([first.length, second.length]).toEqual([4, 4])`),
because the dying sequence flies the letters into a 4×2 grid — a five-letter word falls
off the ramp.

Czech equivalents mean 36 words of exactly four letters that read as triumphant or
gently consoling. Some land (`KRÁL NINE`); a full set of eighteen pairs may not. Three
ways out, in the order they should be tried:

1. **Find Czech four-letter pairs.** Best outcome, uncertain. Attempted first, tier by
   tier, with Dominik reviewing — this is precisely the copy where a flat translation
   would be obvious.
2. **Make the grid locale-aware.** Let the ramp take five or six letters when the locale
   is Czech. Changes an animation that is currently exact, and the spacing was tuned for
   four.
3. **Keep the titles in English.** They already read as arcade-cabinet display text
   rather than prose, so untranslated titles are defensible as styling. Contradicts
   "everything is translated", so it needs Dominik's explicit sign-off.

**This is an open decision.** The phase-2 plan attempts (1) and escalates rather than
picking (2) or (3) unilaterally.

## The forty-character problem

`lib/announcements.test.ts` ("keeps every line short enough for the bar, once a
name is substituted") asserts that every line in every pool, with the longest
nickname substituted, fits `MAX_MESSAGE_LENGTH = 40`. English lines already sit at 28+
characters, and Czech typically runs 10–20% longer.

If Czech does not fit, **the Czech gets shorter — the cap does not get raised.** Forty
characters is the width of the announcement bar, not a preference.

## Testing

- `lib/announcements.test.ts` loops both locales through the existing assertions: no
  duplicate lines in a pool, every rival line has a `{name}`, every line inside the cap.
- `lib/game-over-title.test.ts` loops both locales through the four-letter assertion,
  unless decision (2) or (3) above is taken, in which case it is revised to match.
- A parity test: every guide section and every news item has both locales.
- Locale resolution is pure and tested directly: a system tag list in, a locale out.
- `pnpm check` is the gate, as always.

## Phasing

Three phases, each shippable on its own.

| Phase | Contents                                                                                                                       | Leaves the app                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 1     | `lib/i18n` modules, `expo-localization`, persistence + the `use-display-options` repair, options control, `components/` chrome | Switcher works; chrome Czech, game text English     |
| 2     | `lib/` game text — announcements, coach lines, hit praise, game-over titles, dates, server errors                              | Gameplay fully Czech; four-letter decision resolved |
| 3     | How-to-play guide, news archive                                                                                                | Everything Czech                                    |

All of the architectural risk is in phase 1. Phases 2 and 3 are mostly copy against a
proven pattern, which is why the four-letter decision sits in phase 2 rather than
blocking the start.

## Out of scope

- Nicknames and leaderboard rows — user-generated and server-held; not translatable.
- Board semantics — the boards are shared across locales, as are their Prague-clock
  boundaries.
- DSEG7 digits — the font renders numbers only, so diacritics never reach it.
- A third locale. The shape supports one, but nothing here is built speculatively for it.
