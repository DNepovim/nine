---
name: build
description: Implement a specced work item task by task — `/build <slug>`, "build this", "implement the plan", "continue the build". Works plan.md's checklist against the spec's acceptance criteria, consulting code-guide and design-guide, ticking tasks as they land, and stops at the spec's edge. Fourth stage of the development cycle; hands to verify.
---

# Build

The decisions are made. This stage writes the code the spec describes and **nothing
else** — the judgement here is about how, never about what.

Read `.claude/skills/sdlc/PROTOCOL.md`, load the item, read `spec.md` in full and
`plan.md` for the ticks. Say which task you are starting on before you start it; a
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
5. **Tick it** — `- [x]` in `plan.md`, with a few words after it if what landed
   differs from what the task said. Tick as you go: the file is the only thing that
   survives a cleared session.

## When the spec is wrong

It will be, somewhere — a type that doesn't fit, a file that doesn't exist, a
criterion that contradicts another. This is normal and it is not yours to absorb.

- **A detail the spec didn't settle** (a variable name, which helper, where a constant
  lives) — decide it, note the decision in the task's tick, keep going.
- **A difference the acceptance criteria would notice** — stop. Say what the spec
  says, what the code requires, and what you propose. `AskUserQuestion`: amend the
  spec (recommended — it keeps `verify` honest), build it the spec's way anyway, or
  cut the task. Amending means editing `spec.md`, not just the plan.
- **The shape doesn't hold** — the appetite is blown, a rabbit hole turned out to be
  real. Stop and say so. That is a decision for **`shape`**, not a longer build.

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

`Next: /verify <slug>` — runs the check suite, walks the criteria one by one, and
drives the app for anything the player can see.
