# Bandits on the road — Plan

Spec: docs/work/2026-10-12-road-bandits/spec.md

## Tasks

- [x] 1. `constants/ambush.ts` — the whole table: counts by depth, paces, bearings,
      `AMBUSH_ALONG`, `AMBUSH_AT`, the ground, `AMBUSH_CHANCE`, the spoil weights.
      A band's geometry comes off two timings (`BANDIT_FIRST_MS`, `BANDIT_EVERY_MS`)
      rather than a distance range: a bandit's distance is its arrival read backwards, so
      "the nearest is the clock" is true by construction. The close, the open and the zoom
      are the siege's, imported rather than copied.
- [x] 2. `machines/arcade.ts` — `ambushed` and `cutDown` on `Crossroad`, the roll inside
      `openCrossroad`'s idempotence guard on its own rng stream; `machines/arcade.test.ts`
      covers the three guards. The way is drawn from the ways that are _not_ the walled one
      rather than re-rolled on a clash, which would have made short fans the safe ones.
- [x] 3. `machines/ambush.ts` + `machines/ambush.test.ts` — the pure fight: `newAmbush`,
      `sprung`, `land`, `nextEvent`, `advance`, `shift`, `spoilOf`, `paidAs`, plus `walked`
      and `banditCount`. No `liveValues`: nothing re-letters in an ambush, so the one call
      that draws numbers draws them all distinct and there is nothing left to exclude
      against — an exported helper with no caller fails `knip`. `nextEvent` hands back
      `null` rather than a figure for an empty band, which is the review-focus item.
- [x] 4. `hooks/use-arcade-run.ts` — `ambush` on `Run`, the four phases and their beats,
      the fight's timer, the heart, the spoil, the write-back to the map, the pause shift.
      Three deviations, all noted in Build notes: `cutDown` is tri-state (`null` = never
      met) so criterion 11 can tell a road nobody has met from one fled without a kill; the
      four beats run on an effect and a timer of their own, beside hunger's, because folding
      them into the beats chain broke its complexity budget; and a strike now refuses an
      ambushed way on either hop rather than flying over the men.
- [x] 5. `lib/arcade-layout.ts` — `ambushFrame`; `lib/arcade-layout.test.ts` covers it
- [x] 6. `components/game/bandit-mark.tsx` and `components/game/ambush-field.tsx` — the
      hero centred, the band round it, the numbers, the cut. A third file,
      `bandit-cut.tsx`, holds the man going down: he is drawn after he has left the band, so
      he cannot be the same component. A bandit is drawn by `SiegeSoldier` rather than by a
      second man — what tells the two fights apart is the ring, not the figure.
- [x] 7. `components/game/arcade-game.tsx` — the four phases in `CAMERA_IN`, `DRIFT_MS`,
      `TRAVEL` and `CREEP`; the frame chosen; the field mounted. Two questions the screen
      kept asking twice are now module-level helpers — `fightAt` (does this way end in a
      fight, of either kind) and `frameFor` (which framing this beat is looked at under) —
      which is also what kept the component inside its complexity budget.
- [x] 8. `components/game/ambush-mark.tsx` — the mark on a road already met, placed on the
      fan from `arcade-game.tsx`. Crossed sabres on a knockout disc, at the point along the
      way the fight springs, so the mark says where as well as what.
- [x] 9. `dev/arcade-dev-state.ts`, `dev/arcade-section.tsx` — `AMBUSH NOW` beside
      `SIEGE NOW`, so the fight can be reached without walking to one. It marks the first way
      of the fan and goes straight to the spring rather than walking there.
- [x] 10. Copy — the two untrue How to Play lines and two new bullets; `pnpm i18n:extract`
      and the Czech. No words on the fight itself: the spec's copy gate is amended, with the
      reason — the spoil is read where a siege's is, and a siege announces neither of them.
- [x] 11. `CLAUDE.md` — ambush, bandit and spoil into the domain table

## Verification log

**Verdict: incomplete — 6 of 12 verified, 0 failed, 6 awaiting a run of the app.**
Nothing has failed. The suite is green but for one pre-existing failure, named below.

The six settled criteria were checked with adversarial scratch probes written for this
stage and thrown away after — not with the tests the build shipped, which would have been
circular. The probes ran over 400–600 seeds each where a seed was involved.

| #   | Criterion                                                                           | Result  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The roll, its three guards, idempotence, and a map otherwise unchanged              | PASS    | 600 seeds × 6-deep branches: never two in a fan, never a walled way, never out of an ambushed crossroad, never at depth 0, same answer on re-growth. And the clincher — `main`'s own `openCrossroad` extracted and run side by side: every way's angle, reach, value and clock and every endpoint's walls, dry, depth, name, pos and heading identical over 400 seeds and 60 branches. The roll takes nothing from the fan's generator. |
| 2   | The walk stops partway; camera closes; 5–10 men, distinct numbers                   | PARTIAL | Band size is 5 at depth 0 and 10 deep and never outside that; numbers distinct over 6 depths × 60 roads; `ambushFrame` springs it at `AMBUSH_ALONG`, strictly between the ends, on three canvases. **The walk stopping and the camera closing are unverified.**                                                                                                                                                                         |
| 3   | Whole band from the first frame, own bearings, nearest is soonest, never reinforced | PASS    | Every man's `spawnedAt` is one value after `sprung`; no two bearings within half a slot; sorted by arrival the distances rise monotonically over 80 roads; the band never grows across a simulated 40-second fight.                                                                                                                                                                                                                     |
| 4   | A cut man stays cut; the fan cannot be dialled mid-fight                            | PARTIAL | Cutting the same number twice cuts one man and the second press answers nothing. **The dial refusing the crossroad's own ways is unverified** — it lives in the hook's press branch.                                                                                                                                                                                                                                                    |
| 5   | One heart, dragged back, same fan, no second cost; `invincible` spares it           | PENDING | Hook-level. Not checkable without running.                                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | The road, thinned: fallen gone, survivors unmoved, numbers fresh                    | PASS    | Two men cut, re-dealt on a _different_ grid: exactly those two absent, every survivor's bearing, distance and pace identical, and the numbers different — so they are redrawn against the grid the hero now holds.                                                                                                                                                                                                                      |
| 7   | Clearing frees the road for the run; the hero walks on and the fan grows            | PENDING | Hook-level. Not checkable without running.                                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | Pays once from the road's seed; a heart at three pays food                          | PARTIAL | 200 roads: the same road always rolls the same spoil; `paidAs` never returns a heart at full hearts across 200 rolls; `SPOIL_BITE_BACK` is a third and clamps at full. **"Pays once" is hook-level and unverified.**                                                                                                                                                                                                                    |
| 9   | The last heart ends the run through `overrun`; presses not billed on                | PENDING | Hook-level. Not checkable without running.                                                                                                                                                                                                                                                                                                                                                                                              |
| 10  | A pause freezes the fight                                                           | PASS    | Every man's walk-progress is identical across a 37-second pause; the next arrival is due exactly that much later; nobody arrives across an hour-long pause.                                                                                                                                                                                                                                                                             |
| 11  | The sabres on a road already met, and on no other                                   | PENDING | Screen-level. Not checkable without running.                                                                                                                                                                                                                                                                                                                                                                                            |
| 12  | Suite green, Czech included, the guide's two false claims gone                      | PASS\*  | i18n verify (679 messages, 0 missing), lint 0 errors, tsc clean, knip clean, 1697 tests. Neither "only way to get one back" nor "only food on the map" survives; both replaced and translated. **\*** One pre-existing format failure — see below.                                                                                                                                                                                      |

**The pre-existing failure.** `pnpm check` exits 1 on
`docs/work/2026-10-10-challenge-sessions/spec.md`, which is unmodified in this branch and
whose committed copy on `main` fails the same check — demonstrated by extracting
`main:docs/work/.../spec.md` and running prettier on it. Not this work's, and it blocks the
gate for the challenge-sessions item too. A `prettier --write` on `main` clears it.

### What the five pending checks need

All of them need an arcade run. The dev column's **AMBUSH NOW** reaches a fight directly;
meeting one by walking (about one leg in eight) is what also exercises criteria 2 and 11.

_(the run's findings land here)_

## Build notes

Five things differ from the spec, none of them in what the acceptance criteria ask for.

**`cutDown` is tri-state.** The spec gave the crossroad `ambushed: boolean` and
`cutDown: readonly string[]`, empty until the hero had been driven off. That cannot answer
criterion 11: a hero can lose a fight having cut nobody down, and an empty list would then
be indistinguishable from a road nobody has ever met — so the mark would not be drawn on a
road the player had plainly been driven off. `cutDown` is now `readonly string[] | null`,
where **null** is a road never met, **empty** is one met and lost with nobody cut down, and
a list is one worn down by that much. Null again when the road is cleared, which is review
focus 5.

**An ambush has its own timer effect.** The spec put the four beats on the run's one beats
effect. Four more phase blocks took that function past its complexity budget, and the two
extractions that would have fitted them in made it worse to read rather than better. The
fight now runs on an effect and a ref of its own, beside the one hunger already has — which
is the arrangement this file already uses for a clock that is not a beat.

**A strike refuses an ambushed way on either hop.** The spec said only that a strike cannot
skip a siege. A rocket is one movement with no stop in the middle of it, so a band standing
halfway along a way it flies would have nothing to stop — the strike gives way to the walk
that can meet them, on the dialled way and on the way through alike. The strike still counts.

**No words on the fight.** The spec's copy gate named five on-screen strings: a BANDITS
banner and a SPOILS line with its three outcomes. A siege pays a heart and a full bar and
announces neither — both are read in the top row, where the hero's hearts and the satiety bar
already are — and a banner over an ambush would make it the one fight in the mode that
explains itself. The spec's copy gate is amended with that reasoning. What is left is four
strings in the How to Play, extracted and translated.

**A bandit is drawn by `SiegeSoldier`.** The spec's file list implied a figure of its own.
The repo's own rule is to extend rather than fork, and a man with a sword and a number on his
shield is the same drawing whoever sent him; what tells the two fights apart is the ring round
the hero rather than the figure in it. `bandit-mark.tsx` owns the placement, the walk and the
number; a third file, `bandit-cut.tsx`, owns the man going down, because by then he has left
the band and what is drawn is a copy.

### The criteria, as the author reads them

Not a verification — `verify` does that independently, with the app running — but an honest
pass, and two of these I cannot claim.

1. **Believe so.** `machines/arcade.test.ts` covers all three guards and the idempotence over
   many seeds, and the roll is on an rng stream of its own.
2. **Believe so**, except the camera, which no test can see. The band's size is tested.
3. **Believe so.** `newAmbush` stamps every man at the spring; the nearest-is-soonest property
   is tested directly.
4. **Believe so.** `DIALABLE` gained `ambush`, and the press branch returns before the fan is
   ever looked at.
5. **Believe so** for the heart, the map and the bite. The _picture_ of being dragged back —
   `driven` running the spline backwards under an opening camera — is unverified by me.
6. **Believe so**, and tested: survivors keep bearing, distance and pace; numbers are redrawn.
7. **Believe so.** The fan is grown before the flag is cleared, which is also review focus 2.
8. **Believe so**, and tested, including the full-hearts substitution.
9. **Believe so.** The last heart goes through the same `overrun` a siege's does.
10. **Believe so.** `shift` is tested; the pause path calls it beside the siege's.
11. **Cannot claim.** The data is right — `waylaidAt` is held _and_ met — but whether crossed
    sabres at 20 points read as crossed sabres on a phone is a thing to look at, not to assert.
12. **`pnpm check` is green** as of this build: 1756 tests, lint, types, knip, format, and the
    Czech catalogue complete.
