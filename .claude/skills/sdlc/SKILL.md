---
name: sdlc
description: The development cycle for this repo — where every piece of work stands and what to run next. Use for `/sdlc` (a status board of open work items), `/sdlc <slug>` (what one item needs next), or when the user asks "what was I working on", "where is X", "what's next on this". Also the place a new piece of work starts when it isn't clear which stage it belongs at.
---

# The cycle

Seven stages, each its own skill, each able to run in a session that knows nothing
because the state is on disk:

| Stage       | Skill            | Produces                                    |
| ----------- | ---------------- | ------------------------------------------- |
| brainstorm  | **`brainstorm`** | Directions, costed. No decision.            |
| shape       | **`shape`**      | The appetite, the boundary, the track.      |
| spec        | **`spec`**       | The contract and the acceptance criteria.   |
| build       | **`build`**      | The code, against the criteria.             |
| verify      | **`verify`**     | Does it do what the spec said?              |
| code review | **`review`**     | Is it code this repo wants to keep?         |
| ship        | **`ship`**       | Commit, PR or `main`, and the deploy offer. |

Read `.claude/skills/sdlc/PROTOCOL.md` — it owns the work-item format, the loading
rule, the order guard and the hand-off, and every skill above obeys it.

## `/sdlc` — the status board

```bash
grep -H '^Stage:\|^Next:\|^Track:\|^Branch:' docs/work/*/spec.md 2>/dev/null
git branch --format='%(refname:short)' | head -20
git status --short
```

Report one row per item — title, stage, track, the command that moves it — newest
first, and put anything at `shipped` under a short "done" line rather than in the
table. Then say which one the working tree is actually on, if any: an item at `build`
on a branch nobody has checked out is the thing a status board exists to surface.

Nothing else. Do not start work from the board; name the command and stop.

## `/sdlc <slug>` — one item

Load it per the protocol, summarise where it stands in a few lines, and name the one
command that moves it. If its stage is `verify` or `review` and the last section
records failures, say that the next command goes **backwards** and why.

## `/sdlc <a description of something to do>`

The dispatcher. Judge what the input actually is and hand off — don't do the stage
here:

| The input is…                                                                              | Hand off to                             |
| ------------------------------------------------------------------------------------------ | --------------------------------------- |
| An itch, a complaint, a feeling — "the intro feels dead"                                   | **`brainstorm`**                        |
| One idea, not yet bounded — "add haptics to the dial"                                      | **`shape`**                             |
| Bounded already, with the shape obvious — "the dial should buzz on each key, Trainee only" | **`shape`**, small track                |
| A one-line fix with nothing to decide                                                      | Just do it — say so, and skip the cycle |

That last row matters. This cycle is for work worth a document. A typo, a colour
nudge, a renamed variable: fix it, run **`check`**, **`commit`**. Running seven
stages over a one-liner is how a process stops being used.
