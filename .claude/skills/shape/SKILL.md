---
name: shape
description: Bound a piece of work before it is specified — `/shape <slug or an idea>`, "shape this", "how big is this", "what's in and what's out". Fixes the appetite, draws the boundary, names the rabbit holes, and decides whether the work needs a full spec or goes straight to build. Second stage of the development cycle.
---

# Shape

An idea with no boundary grows until it is abandoned. This stage draws the boundary,
and the boundary is a **time budget, not a feature list**: how much is this worth, and
therefore what fits.

Read `.claude/skills/sdlc/PROTOCOL.md` first, then load the item — or create it, if
the user came here with an idea and no folder (the normal way work starts).

## Not this skill's job

- **The contract.** No types, no function signatures, no acceptance criteria. Those
  are **`spec`**'s, and writing them here is what makes shaping take a day.
- **Naming every file.** Name the _areas_ — "the dial, the game machine, one new
  constant". `spec` resolves that to paths.
- **Code.** Reading it, yes. Writing it, no.

## Step 1 — The problem, in one line

Not the solution with "add" in front of it. What is wrong for the player right now.

> ❌ Add haptics to the dial.
> ✅ A key taken on a fast swipe gives no sign it registered, so players re-swipe and lose the route.

If you cannot write that line, the brainstorm wasn't finished. Say so and offer
**`brainstorm`**.

## Step 2 — The appetite

Ask the user, with `AskUserQuestion`, in the units they actually work in:

- **An evening** — one sitting, one branch, no new concepts.
- **A day or two** — a new screen or a real mechanic, still inside what exists.
- **A week** — new tables, new domain words, something the How to Play has to explain.

The appetite is **fixed**, and it is an input to the design rather than an estimate of
it. If the shape doesn't fit the appetite, the shape gets smaller — never the other
way round. Say that out loud when it happens.

## Step 3 — The breadboard

Walk the work as the player meets it, in prose, naming only what already exists plus
what has to be new. Five to fifteen lines. For each beat: where the player is, what
they do, what changes.

Then, in one short list, the **areas** it touches, with a word each on what changes:
the screen, the machine, the rules, the schema, the copy. Read enough of the code to
be sure each one is real — a shape that names the wrong area sends `spec` hunting.

Two things this repo will ask of almost every shape, and they are cheaper to answer
now than after the code exists:

- **Is this a mode's business or the engine's?** Nothing outside `modes/` branches on
  a mode's name. If the work wants to behave differently per mode, it is a rule or a
  capability on `RunRules` — say which, roughly.
- **Does it need a flag?** Anything a player should not see yet is a `constants/features.ts`
  entry and a floor. Decide the floor here (`nobody` while it is off the app).

## Step 4 — The boundary

Three lists, and the second two are the ones that make this stage worth doing.

- **In** — what the appetite buys. Short.
- **Out** — the adjacent, reasonable, tempting things that are explicitly not happening.
  Name them; an unnamed exclusion gets built by accident.
- **Rabbit holes** — the places this work could sink: a system that would have to be
  rewritten, an animation that has to land exactly right, a schema change that touches
  a shipped column, a leaderboard whose scores would stop being comparable. For each,
  either the way around it, or "this is why the appetite might not hold".

## Step 5 — The track

`AskUserQuestion`, with a recommendation based on what Steps 3 and 4 turned up:

- **Small** — shape → **`build`** → **`verify`** → **`ship`**. No `spec.md` contract
  section and no `plan.md`; the tasks and the acceptance criteria go straight into
  this document, briefly. Recommend this when nothing new is being named, the schema
  is untouched, and the whole thing is one sitting.
- **Full** — the seven stages. Recommend it when the work introduces a domain word,
  changes the schema, touches scoring or the rules, or spans more than one screen.

Being wrong here is cheap in one direction only: a small-track item can be promoted
later by running **`spec`** on it; a full-track item nobody specced is just an
unspecced item. When it is genuinely borderline, go full.

## Step 6 — Write it

Into `spec.md`, under the brainstorm's sections if they are there:

- **## Problem** (Step 1) · **## Appetite** (Step 2) · **## Shape** (Step 3)
- **## In / Out / Rabbit holes** (Step 4)
- On the **small** track only: **## Tasks** and **## Acceptance criteria**, kept to a
  handful of lines each — the same format `spec` would write, just shorter.

Header: `Stage: shape`, `Track:` as decided, `Branch: <type>/<slug>`, and `Next:` the
command below.

## Hand off

- **Full track** — `Next: /spec <slug>` — turns this into the contract the build is
  held to.
- **Small track** — `Next: /build <slug>` — implements it against the tasks above.
