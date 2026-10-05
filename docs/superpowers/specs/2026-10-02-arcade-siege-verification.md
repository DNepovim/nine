# Arcade Fortified Villages — Verification Guide

Date: 2026-10-05
Branch: `feat/arcade-siege`

**Nothing in this feature has ever been rendered.** This repo has no hook or
component tests — Vitest runs in `environment: 'node'` — so every screen change on
this branch was verified by reading code, and two of the three serious bugs found
during the build were runtime-only and invisible to lint, types and all 1398 tests.

This is the list of things to look at on a real device before the feature goes
anywhere near a release. Arcade is behind `arcade: 'developer'` — see
`constants/features.ts`.

## The two that matter most

Everything else on this page is polish. These two are the ones that were broken
during the build and fixed by reasoning alone, with nobody watching the screen.

1. **Lock the phone mid-siege, unlock, press CONTINUE, and watch for a warrior.**
   Warriors must still be visible and still walking from where they stood. The bug
   this replaces made every warrior for the rest of the run render at zero scale —
   invisible, parked on the gate — while still taking a heart on arrival. If you see
   hearts drain with an empty field, that is this bug returning.

2. **Lose your last heart to a warrior and read the card.** It must say
   **WALL / HELD** (Czech **ZEĎ / DRŽÍ**). If it says FELL BACK you have been shown
   the other death's card — that is the mouth ending, for running out of way at the
   first crossroad.

## On the map, before a fight

3. At a crossroad whose fan holds a walled village, **one bud is visibly heavier**
   than its neighbours — a thicker wall, bigger quarter-towers. It must still read as
   a town, not a new symbol.
4. The numeral inside it is **as legible as any other bud's**.
5. Walk to a different way at that crossroad and retreat back: **the same bud is
   still the walled one**, with the same number.
6. Check a four-way fan in both themes — nothing crosses, no name collides.

## Walking in

7. Dialling the walled village: the hero walks the way **over the usual walk time**
   and **stops short of the gate**, not on the village.
8. The camera comes **in** over about three quarters of a second.
9. The country, trail and other ways **fade back to about a quarter**, but the way
   back down stays visible — a player who flees has to see where they are going.
10. The **compass rose** stays put and un-zoomed.
11. The **dial is dead** during the zoom and comes alive when the fight starts.
12. Repeat with a **strike** that lands on a walled village: same stop short, same
    zoom. A strike must never carry you through a siege.

## The fight

13. **Four towers** stand round the wall, evenly spaced from straight up. Six at
    depth ~20+, which is the crowded case worth checking.
14. **Every number is legible** — none covered by a tower in front of it, none
    crossing its neighbour, none under the hero.
15. Dial a tower's number: **it loses height** over about a fifth of a second.
16. **Dial it again without moving: nothing happens.** Dial away and come back: it
    chips. This is the least discoverable rule in the feature and the one the guide
    now explains.
17. Dial a **flattened** tower's number: nothing happens. The stump still shows its
    number.
18. **Warriors leave the gate** and walk at the hero, two or three at once coming
    down different lines.
19. Dial a warrior's number and he is gone.
20. **Numbers stay upright when the sheet turns** — tap the compass mid-fight.
21. **Sharpness**: the sheet is scaled 2.4× during a fight, so check the numerals
    are not soft.
22. The first warrior should leave the gate about **2.6 s** after the fight starts —
    not during the zoom.

## Leaving

23. **RETREAT appears only during a fight**, and pressing it costs a heart and drops
    you back one crossroad.
24. **The map must not move** when RETREAT appears or leaves. It sits in a
    permanently reserved row for exactly this reason.
25. Walk back into a village you **fled**: it is walled again, full strength.
26. Walk back into a village you **took**: it is an ordinary village, no second
    fight.
27. When the walls come down, the hero **walks in through the gate** — no jump.
28. Warriors must **vanish the moment the village falls**, not keep walking at a
    hero who has left.

## Hearts and the cards

29. **Three full hearts** from the first frame of a run.
30. A warrior reaching the hero **takes a heart** and the heart reacts.
31. Taking a village **returns a heart**, capped at three.
32. **VESNICE / VILLAGES** shows on the pause screen and the game-over card.
33. **Fall into the mouth** once — run the clock out on the very first crossroad —
    and confirm that card still says **FELL BACK** (Czech **PÁD / ZPĚT**) and the
    hero still falls down the stub. This path was deliberately left byte-identical;
    a change here is a regression.

## The guide

34. Read the whole arcade chapter in **English**, then in **Czech**
    (Options → language → HOW TO PLAY). Nothing may overflow; Czech is longer.
35. Check both themes.

## Known gaps, not bugs

- **Losing a heart has no feedback where you are looking.** The spec called for a
  floating indicator; the existing one hardcodes an untranslated string from
  Accuracy's rules and would be nonsense at a siege. Needs a design decision.
- **Nothing yet makes a player choose a walled village.** Deliberate — the reward
  work is a separate piece. See the spec's own "open hole" section.
- **Deep sieges may be a slog.** 30 tower hits at depth 24, and a tower's number
  drifts out of its press band as the dial wanders — measured at up to 8 presses
  after fifteen presses of chipping. Every number is a constant in
  `constants/siege.ts`.
- **Two Czech strings want a native eye**: `PÁD / ZPĚT` reads as a noun phrase
  ("a fall backwards") rather than the verb phrase "fell back".
- `lib/game-over-title.ts`'s thirty wordmark titles are now the app's only
  untranslated player-facing wordmarks.
