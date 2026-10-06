# Last week in Nine — Plan

Spec: docs/work/2026-10-06-weekly-recap/spec.md

## Tasks

- [x] 1. `lib/rng.ts` — move `Rng`, `seeded`, `idSeed` verbatim out of `machines/arcade.ts`, add `pickFrom`; repoint `machines/arcade.ts` and `lib/place-names.ts`; `lib/rng.test.ts` pins the outputs — `machines/arcade.ts` re-exports the three so `arcade.test.ts`, `arcade-game.tsx` and `arcade-layout.ts` stay untouched, which is what keeps criterion 11 literally true
- [x] 2. `supabase/migrations/20261006020000_weekly_recap.sql` — `weekly_recap(p_from, p_to)`: cell rows by one `distinct on`, takeover rows off `scores` — applied and exercised against the local database, no new index needed
- [x] 3. `lib/leaderboard.ts` — `fetchWeeklyRecap(range)`, the row type, the request and nothing else — built after tasks 4–6, since `RecapRow` belongs beside the code that reads it
- [x] 4. `lib/recap-lines.ts` — the 47 phrasings as `msg`, `[A]` tokens, weekday and month names, `fill`; `record` → `takeover` throughout — months written in capitals, since nothing upper-cases the window label and Czech must stay lowercase
- [x] 5. `lib/recap.ts` — the composer out of `dev/`, plus `factsFromRows`, `periodLabel`, and `boardWeight` calling `lib/medals.ts`; `lib/recap.test.ts` moved and extended — `weekForShape` went to `dev/` with the simulation it depends on; `lib/medals.ts` gained `boardClaim`
- [x] 6. `dev/weekly-recap/facts.ts`, `dev/gallery.tsx` — keep `simulateWeek` and the pools, repoint everything else at `lib/` — the prototype's own string RNG dropped for `seeded(idSeed(…))`
- [x] 7. `components/overlays/recap-sentence.tsx`, `recap-card.tsx` — moved; the card resolves descriptors and composes, so a locale switch re-renders it — the dev overlay's REPHRASE now walks the window back a week rather than poking the seed, since the seed _is_ the Monday
- [x] 8. `constants/storage.ts`, `constants/features.ts` — `SEEN_RECAP_KEY` and the `recap` key
- [x] 9. `hooks/use-weekly-recap.ts` — marker, flag gate, fetch, first-launch rule, empty-week rule
- [x] 10. `types/popup.ts`, `components/overlays/popup-card-view.tsx`, `hooks/use-popup-deck.ts` — the third arm, between winnings and news — `popupAccent` inverted to ask for news rather than list the two violet kinds
- [x] 11. `pnpm i18n:extract`, then Czech for all of it under the two rules in the spec — 69 strings; Czech weekdays carry their own `v`/`ve` preposition so no template has to decline one
- [x] 12. `CLAUDE.md` — the **recap** and **takeover** rows

## Verification log

_(verify fills this in)_

## Build notes

**Order.** Tasks 4–6 were done before task 3. `RecapRow` belongs in `lib/recap.ts`, beside
the code that reads it, so `lib/leaderboard.ts` imports it the way it already imports
`Winner` from `lib/recent-winners.ts` — and that type has to exist before the fetch can be
written against it.

**The RNG is re-exported, not just moved.** The spec wanted `machines/arcade.test.ts`
untouched, and `arcade-game.tsx` and `arcade-layout.ts` also import `idSeed` from the
machine. `machines/arcade.ts` therefore imports the three from `lib/rng.ts` and re-exports
them, so no consumer changed and criterion 11 is literally true. `lib/rng.test.ts` pins
`seeded` and `idSeed` against recorded outputs; the numbers in it were produced by running
the old implementation, not chosen.

**`weekForShape` went to `dev/`, not `lib/`.** It is a search over `simulateWeek`, which the
spec kept in `dev/`. Putting it in `lib/` would have made production code depend on the
simulation.

**Month names are written in capitals.** Nothing upper-cases the window label, because
criterion 4 pins the Czech as `22. – 28. září` and shouting a Czech month after a day number
is wrong before the case is. English carries its own register in the catalog instead.

**Czech weekdays carry their preposition** — `ve čtvrtek`, not `čtvrtek`. English needs
`[D]` in one form; Czech needs the genitive after "kromě" and the accusative after "v", and
one string cannot be both. Baking `v`/`ve` into the day makes every template treat `[D]` as
"on <day>" and decline nothing. One consequence, found by reading the output: `[D]` can
never open a sentence, which cost one Czech variant a full stop.

**Five Czech defects were found by reading generated output, not by the tests** — a
sentence-initial lowercase `[D]`, a bare `1×` with no verb, `s 4` wanting an instrumental,
`3 stačilo` wanting verb agreement, and `[MODE] patřil` where both scored modes are feminine
in Czech. The token-equality test cannot see any of these. Criterion 10 is the one a human
still has to walk.

**Criterion 10's ranges were amended** to the ones the code actually produces — player
counts are 3–7 in `scattered` and 4–7 in `contested`, not the 2–5 the spec estimated.

**The working tree is shared.** Unrelated in-progress work is present in `modes/`,
`lib/player-profile.ts`, `lib/achievements.ts`, two profile overlays, and a migration
`20261006030000_profile_held_boards.sql`. None of it was touched by this build and none of
it belongs in this item's commit.

**Left undone.** The migration is applied to the local database only — pushing it to
production is `deploy`'s, and the spec says it goes before the build that calls it. The
`recap` feature has no row in the `features` table yet, so its floor is `nobody` by
absence rather than by configuration.
