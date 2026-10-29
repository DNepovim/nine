# Ranks

Slug: ranks
Stage: brainstorm
Next: /shape ranks
Started: 2026-10-23

## The itch

A player has a **fortune** and a shelf of **achievements**, but nothing turns the two into
one title that says what they are. The wish: every player holds a **rank**, named after
mathematics — Computer, Adder, Multiplier, Exponent, Root, Differentiator, Integrator… —
reached by fixed rules built from their fortune, their achievements and tasks.

What the code has today: fortune only ever grows and is deliberately "never a rating, a
rank or a standing" (CLAUDE.md); about sixty permanent achievements in ten groups
(`constants/achievements.ts`), several of them secret, many of them already skill tests
(`surgeon`, `lightning`, `immaculate`, `perfectRoute`); and no notion of a task at all.
The word **rank** is already spoken for in code — `WIN_RANKS` on the podium and a
leaderboard's rank — so the name needs settling before anything is specified.

## The direction

**Named-achievement gates.** Each rank names the specific achievements it requires
(e.g. Multiplier asks for `maxMultiplier` and `steadyHand`; Integrator for `immaculate`
and `perfectRoute`). The achievements _are_ the tasks — no new task mechanic. Whether a
fortune floor sits beside them is for shape. A rank is permanent, like the achievements
it is read off: it only ever goes up.

## Directions considered

| Direction                                                       | Appetite     | Risk                                                                      | Outcome                                              |
| --------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Ladder from what exists (fortune threshold + achievement count) | a day        | Measures grind, not skill                                                 | Lost — a count rewards hours on Easy                 |
| **Named-achievement gates**                                     | a day or two | Achievements were not designed as a ladder; secret ones can't be required | **Chosen**                                           |
| Rank proofs (fortune + achievements + bespoke tasks per rank)   | a week+      | Writing and balancing ~30 proofs, keeping them fair as scoring moves      | Lost — a whole task system before we know ranks land |
| Proofs as an exam run (drill-style pass/fail run per rank)      | 1–2 weeks    | A new kind of run; failing an exam stings                                 | Lost — too big                                       |
| A rank per mode (Accuracy rank, Speed rank)                     | a week       | Two titles dilute "one word for who I am"                                 | Lost                                                 |
| Rank replaces the achievements screen's grouping (removal)      | a few days   | Achievements lose their own groups; some fit no rung                      | Lost — worth revisiting as the ranks screen's layout |
| Just the title (rank word off fortune alone)                    | an evening   | Fortune with a name; blocks a richer version                              | Lost                                                 |

Rejected outright: a losable, current-skill rank — it duplicates **medals** and breaks the
"only grows" promise fortune and achievements both keep.

## Open for shape

- The word in code (rank is taken — the host/`admin` arrangement is the precedent).
- The ladder itself: how many rungs, which names, which achievements on each.
- Secret achievements: excluded from gates, or allowed once earned?
- Fortune floor beside the achievements, or achievements alone.
- Where rank is shown: profile only, or beside the nickname on boards and in rooms.
