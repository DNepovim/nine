---
name: challenge
description: Author a new challenge for the nine app — `/challenge <idea>`, "add a challenge", "make a challenge where the dial is...". Settles the one thing a challenge is about, then asks for its colour, its mark, its dial, its scoring, its streak, its shot and what its end screen claims, and writes the catalog entry. Use whenever a new challenge is being added; not for changing one that already exists.
---

# Challenge

A **challenge** is a mode that is on the app for a window and then is not — see
CLAUDE.md. Adding one is **one entry in `modes/challenges/catalog.ts`** and nothing
else: `defineChallenge` turns a spec into an ordinary `ModeDefinition`, the registry
holds it beside the permanent modes, and the engine never learns the difference.

That is the whole of the mechanism, and it is worth saying plainly before anything
else: **you are writing a value, not a feature.** If a question in this skill cannot
be answered by a field on the spec, the answer is probably that the challenge does not
need it.

## The one rule

**A challenge is about one thing.** The dial, the clock, the scoring, the streak and
the lives are all free to move — and a challenge that moves all of them is not a
challenge, it is a different game nobody can read in the thirty seconds they have
before the window shuts.

Settle what the one thing is before asking anything else. Everything the player meets
should be downstream of it:

> _Four keys, two of them twins_ — the dial is the thing. The clock, the lives and the
> targets are ordinary, and the player spends the day working out what a four-key dial
> can reach.

If the idea has two things in it, say so and ask which one it is. Two challenges is
the right answer more often than one challenge with two ideas.

## What to ask

Ask in **one `AskUserQuestion` call** wherever the answers do not depend on each other
— most of these do not. Give each option a `preview` where the choice is visual.

Everything below has a default, and a challenge that takes every default is a
perfectly good challenge. **Offer the default as the recommended option and say what
it gives**, rather than asking the author to design six things from nothing.

### 1. The colour

A challenge wears a near-black shared by every challenge plus a hue of its own,
generated from its place in the catalog — so **the default is to ask nothing and
write nothing.** See `modes/challenges/palette.ts`.

Ask only when the author wants a particular colour. Then it is a **hue in degrees**
on the spec (`hue: TURQUOISE`), never a pair of hexes: the near-black, the two
saturations and the two lightnesses stay the palette's, so a hand-picked challenge is
built the same way as a generated one.

**Check the hue against `palette.test.ts`'s collision rule before promising it.** Every
hue in the app already means something — the mode chain, gold for a record held, green
for an achievement kept, teal for multiplayer — and the generated arc refuses all of
them. A named hue must clear them by the same margin, and the test holds it to that.

Say what a hue costs if it is a light one. Turquoise's bright stop is about 1.7:1 on
the card, so the edge and the name end up two shades of it rather than one —
`challengeInk` brings the text down to something readable. That is the system working,
not an exception, but the author should know before they pick.

### 2. The mark

Drawn from the challenge's own dial — `rows × cols` dots, by `DialMark`. **There is
nothing to ask and nothing to author**: four keys is four dots, and a challenge on the
standard nine gets nine.

Mention it so the author knows the mark is already decided by the dial they pick in
the next question, rather than wondering where to put an icon.

### 3. The dial

`defineDial({ id, rows, cols, weights, digits })` — see `modes/dial.ts`. The default
is `NINE_DIAL`, the three-by-three every shipped mode is played on, and a challenge
that changes nothing else should probably not change this either.

Two things to check for the author, because both have bitten:

- **Reachability.** Targets are drawn from the whole of `0 … maxSum` with no
  reachability filter — see `fullRange` in `lib/target-value.ts`. A dial whose every
  weight is a multiple of three can only land on multiples of three, and a target will
  eventually spawn that it cannot reach. A weight of 1 somewhere makes every number
  answerable.
- **`maxSum` follows the weights.** It is `9 × Σweights`, so changing the dial changes
  the range targets are drawn from without anything else being said.

### 4. The counting — how a hit is scored

Two fields, and the defaults are already a challenge's own rather than the base mode's
(see `CHALLENGE_DEFAULTS` in `define.ts`):

- **`weights`** — the blend of accuracy and speed. Defaults to an **even** `0.5 / 0.5`,
  which is deliberately unlike every permanent mode: accuracy leans 85/15 one way,
  speed the other, and each is a board you get good at by getting good at one thing. A
  challenge is met once, so it asks for both halves at the same weight.
- **`base`** — the points a hit is worth before the blend. `SCORE_BASE` unless the
  challenge is much shorter or much longer than an ordinary run.

The **headline** is not a question: `favoured` derives it from the weights, and a dead
heat goes to accuracy — the half of the game a player can work at.

**Lives** are three, like every mode that spends them, and a wasteful hit costs none.
Ask before pinning fewer: the one mode a player meets cold should not also be the one
that forgives least.

### 5. The streak — what builds the multiplier

`StreakTrigger` in `modes/streak.ts`. Two predicate tables keyed by name, so **a new
rule is two rows and a union member** — the architecture is built for this.

What exists, and what each is made of:

| Trigger   | Builds on                              | Broken by      |
| --------- | -------------------------------------- | -------------- |
| `optimal` | every hit on the exact route           | any lesser hit |
| `fast`    | every hit with most of the ring left   | any lesser hit |
| `whole`   | every key on the dial moved on the way | any lesser hit |
| `clear`   | the board emptied                      | **nothing**    |
| `none`    | —                                      | —              |

**Do not leave a challenge on `clear` by accident.** It is the legacy board-clear rule
and `STREAK_BROKEN.clear` is `false`, so nothing the player does can break it — the
most forgiving of the five, inherited from whichever base mode was picked.

The good ones **pull against the score**. `whole` is the example: the cheapest route
rarely wants every key, so the multiplier and the accuracy factor ask for different
things and the player chooses on every target. A streak that agrees with the score is
a streak nobody notices.

A new trigger needs a **fact** in `StreakFacts`, computed in `streakFactsOf`
(`machines/game.ts`) from what the scoring loop already has: `steps`, `par`,
`spdFactor`, `refGrid`, and the new grid. If the idea cannot be read off those, say so
— it is a bigger change than a challenge should carry.

### 6. The shot — what a strike draws

`ShotKind` in `modes/types.ts`. **The shot is the streak made visible**, and that is
the rule for picking one: a chain of exact presses draws a single held beam, a run of
fast ones empties a magazine, a route through every key fires one beam from each.

| Kind      | Draws                                                     | Fires from  |
| --------- | --------------------------------------------------------- | ----------- |
| `sniper`  | one beam, held                                            | the sum row |
| `burst`   | five rounds, 30ms apart                                   | the sum row |
| `quartet` | one beam per key, together, in the challenge's own colour | each key    |
| `null`    | nothing                                                   | —           |

A challenge inherits its base mode's shot unless it names one. **If the streak changed,
the shot almost certainly should too** — a `whole` streak firing `burst` is the mode
telling the player two different things about what it wants.

Every shot must finish inside the gap between two hits at this mode's cadence. Work it
out: `clock.base × difficulty timeoutScale × spawn.share`. Sniper is 420ms, burst
230ms, and four-keys' gap is about 1690ms.

### 7. The claims — what the end screen says about a run

The wordmark over the game-over screen is the app's **claim** about the run — `BEST
EVER`, `TOOK GOLD`, `COLD DIAL`. A tier is picked from what the run did, then a line is
drawn from that tier's pool.

**Every one of those pools is about a board**, and a challenge has none. Left alone, a
challenge run can only ever be told it was `cold`, `strong` or `played` — the same three
things a bad Accuracy run is told, under a mode it is not.

So a challenge may name its own, per tier, and a tier it does not name falls through:

```ts
claims: {
  board:  [['FOUR', 'KEYS'], ['KEPT', 'FOUR']],   // took the session
  medal:  [['NEAR', 'FOUR']],                      // second or third on it
  strong: [['GOOD', 'KEYS']],                      // a run with real streaks in it
  cold:   [['COLD', 'KEYS']],                      // barely got going
},
```

**Which tiers are worth naming.** A challenge reaches `board` and `medal` through its
**session standing** rather than through a board — rank one is `board`, second and third
are `medal` — and `strong`, `cold` and `played` on the run's own merits. The rest
(`crown`, `owl`, `eagle`, `allTime`, `personal`) belong to boards and reigns a challenge
cannot have; naming them writes words nothing will ever read.

**Write them about the challenge, not about a board.** `TOOK GOLD` on a mode with no
board is the screen describing something that does not exist. The one thing every claim
here can be about is the thing the challenge changed — which is the same thing the whole
spec is about, asked once more.

Two or three per tier, as the app's own pools have: a player who dies twice in a row
should not read the same words twice. Four letters a word is the app's habit rather than
a rule — the component measures its own ramp, so a longer word is drawn correctly, it
just reads less like a mark.

### 8. The window

`from` and `until`, absolute ms timestamps. **Not the author's real question** — a
challenge is put on the app by planning a **session** on the admin screen, which is a
row rather than a rebuild. The window on the definition is what a session will one day
be resolved from; keep it short and in the past if the entry is only being written.

## Writing it

One entry, appended to `CHALLENGES` — **appended, never inserted**. The list is
append-only by design, and a challenge's colour is derived from its index: inserting
one would silently recolour every challenge after it.

```ts
const SOME_NAME: ChallengeSpec = {
  slug: 'some-name',
  label: msg`SOME NAME`,
  description: msg`One line, said as the player would say it.`,
  base: SPEED,
  from: Date.UTC(2026, 8, 1),
  until: Date.UTC(2026, 8, 1) + DAY,
  // Only the fields this challenge actually moves.
  rules: { dial: defineDial({ … }), scoring: { streak: 'whole' } },
  shot: 'quartet',
  claims: { board: [['SOME', 'NAME']], cold: [['COLD', 'NAME']] },
}
```

Then, in order:

1. `pnpm i18n:extract`, and **translate the label and the description into Czech**. A
   production build strips the English out of the descriptor — a missing message puts
   its generated id on the player's screen.
2. `pnpm check`.
3. Resolve it once and read the result back, rather than trusting the layering:
   `runRules(challengeId('some-name'), 'hard')` — the weights, the lives, the streak
   and the dial, in one look.
4. **The guide needs nothing.** The challenges chapter is deliberately vague and says
   so: a challenge may change the dial, the clock, the scoring and the lives, so
   anything it said about how one plays would be wrong for the next one.

## What not to do

- **Don't give it a board.** `defineChallenge` forces `board: false` and the server's
  own check constraint would refuse the write. Its standings belong to its session.
- **Don't name hexes.** A hue, or nothing.
- **Don't branch on its id anywhere.** Nothing outside `modes/` knows a mode's name —
  screens ask `traitsOf`, `isChallenge`, or the rules.
- **Don't delete a challenge whose window has closed.** A stored run, a stat row and a
  player's history all still name it, and a mode nothing is registered under reads as
  corrupt rather than as over.
