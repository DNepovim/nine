---
name: build
description: Implement a specced work item task by task — `/build <slug>`, "build this", "implement the plan", "continue the build". Works plan.md's checklist against the spec's acceptance criteria, consulting code-guide and design-guide, ticking tasks as they land, and stops at the spec's edge. Fourth stage of the development cycle; hands to verify.
---

# Build

The decisions are made. This stage writes the code the spec describes and **nothing
else** — the judgement here is about how, never about what.

Read `.claude/skills/sdlc/PROTOCOL.md`, load the item — `spec.md`'s **## Contract**,
**## Acceptance criteria** and **## Tests** (on the small track, its **## Tasks** and
criteria), and `plan.md`'s **## Tasks** for the ticks. On a build reopened by
`verify` or `review`, add the latest log or review section, and only that. Say which task you are starting on before you start it; a
resumed build must show the user it picked up where the last one stopped.

Then read the **`code-guide`** skill — functional TypeScript, no `any`, no `as`, no
`!`, value maps over ternary chains, `narrowland` guards, one component per file,
module-level animated components, `className` over `style`. And for anything the
player sees, the **`design-guide`** skill before choosing a colour, a size or a motion.

## Not this skill's job

- **Changing the design.** If the spec is wrong, **stop** — see below. Do not improve
  it in passing; a build that silently diverges from its spec makes `verify`
  meaningless.
- **The full check suite.** **`verify`** owns `pnpm check`. Run the tests you touched
  and typecheck when you suspect it; don't run the gate eight times.
- **Committing.** **`ship`** owns that, at the end of the cycle.
- **Tidying the neighbourhood.** A refactor the spec didn't ask for belongs in its own
  work item. Note it, move on.

## Working a task

One task at a time, in the plan's order.

1. **Read what you are changing** — the whole file, not the region. This codebase
   carries long prose comments explaining _why_; match that density when editing, and
   leave the reasoning intact when moving code.
2. **Write it** the way the surrounding file does. The house style beats a better style
   imported from elsewhere.
3. **Tests** — the spec's **## Tests** section says which. Pure functions in `lib/` and
   machine helpers always get one. Run just that file:
   `pnpm exec vitest run <path>`.
4. **Strings** — any player-visible copy goes through Lingui as it is written, not
   afterwards. Then `pnpm i18n:extract` and write the Czech. A missing catalog entry
   ships the generated id to the player's screen, so this is part of the task.
5. **Dev data** — if the task added a table, a column, a state a row can be in, or a
   screen that reads the database, ask whether the local stack has anything to show
   it. See **Dev data** below. Skip it for a task that touches none of those.
6. **Tick it** — `- [x]` in `plan.md`, with a few words after it if what landed
   differs from what the task said. Tick as you go: the file is the only thing that
   survives a cleared session.

## Dev data

A feature nobody can see locally is a feature `verify` drives against an empty screen.
When a task gives the database something new to hold, check that a fresh
`pnpm db:reset` leaves the screen reading it with something in it — and, where the
screen draws states differently (a chip, a filter, a faded row, a disabled button),
**one row in each of them**. The admin MESSAGES screen is the model: one message owed,
one in the post, one seen, one waiting for a build, one set aside.

- **Where:** `supabase/dev-fixtures.sql`, not `seed.sql`. The seed is what the SQL
  tests read and they assert shipped defaults against it; the fixtures are what a
  person reads, applied after the reset and refused anywhere but the local stack.
- **How:** relative to `now()`, never a literal date — a fixture pinned to a timestamp
  has expired by the time anybody looks. Re-runnable: `on conflict … do update` back
  to the fixture's own state, so a row changed while clicking around goes back on the
  next run (`do nothing` where a trigger forbids the update, as `session_scores` does).
  Fixed ids with a recognisable prefix (`5eed…`, `5e55…`), and the seeded players
  `u1`…`u8` as authors.
- **Prove it:** `pnpm dev:fixtures` twice — the second run must be as clean as the
  first — and one `select` showing every state is present.
- **When not to:** data the app writes the moment it is used (a run, a score) needs no
  fixture, and neither does a column no screen reads yet. If you are unsure whether it
  is worth it, say so in the task's tick rather than skipping silently.

Say in **## Build notes** what the fixtures gained, or that the task needed none.

## When the spec is wrong

It will be, somewhere — a type that doesn't fit, a file that doesn't exist, a
criterion that contradicts another. This is normal and it is not yours to absorb.

- **A detail the spec didn't settle** (a variable name, which helper, where a constant
  lives) — decide it, note the decision in the task's tick, keep going.
- **A difference the acceptance criteria would notice** — stop. Say what the spec
  says, what the code requires, and what you propose, and put it to the
  **`sdlc-advisor`**: amend the spec (recommended — it keeps `verify` honest), build
  it the spec's way anyway, or cut the task. The user hears of it only if the
  advisor escalates. Amending means editing `spec.md`, not just the plan.
- **The shape doesn't hold** — the appetite is blown, a rabbit hole turned out to be
  real. Stop building and put it to the advisor. That is a decision for **`shape`**,
  not a longer build — and blowing the appetite is one the advisor hands the user.

## Step N — Close the build

When every task is ticked:

```bash
git status --short
pnpm exec tsc --noEmit
```

Then read the spec's acceptance criteria once, yourself, and say for each whether you
believe the code satisfies it. Not a verification — `verify` does that, independently
and with the app running — but an honest pass that catches the criterion everyone
forgot. Where you cannot claim one, say so rather than letting the next stage find it
cold.

Write a short **## Build notes** section into `plan.md`: what differs from the spec and
why, any decision taken at a fork, anything left deliberately undone. Set
`Stage: build` and `Next: /verify <slug>`.

## Hand off

`Next: /verify <slug>`, then invoke **`verify`** — it runs the check suite, walks
the criteria one by one, and drives the app for anything the player can see.

When this build was reopened by `verify` or `review`, the hand-off is the same: back
to **`verify`**, never straight to `review` or `ship`.
