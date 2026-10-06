---
name: spec
description: Turn a shaped piece of work into the contract the build is held to — `/spec <slug>`, "spec this out", "write the plan for this". Names the domain words, the files, the data, the copy, the gates and the numbered acceptance criteria, then breaks it into tasks in plan.md. Third stage of the development cycle; skipped on the small track.
---

# Spec

The shape says what is worth doing. This says what "done" means, precisely enough
that **`verify`** can decide it without asking anyone, and **`build`** can be wrong
about nothing except the code.

Read `.claude/skills/sdlc/PROTOCOL.md`, load the item, and read its `spec.md` in full
before writing a word. Then read the code it names — properly, not by filename. A
spec written off a shape without opening the files is a spec whose file list is wrong.

## Not this skill's job

- **Writing the code.** Not even a correct line of it. Snippets in a spec are for
  _shapes_ — a type, a row of a value map — never an implementation.
- **Re-opening the shape.** The appetite is fixed. If the contract cannot fit it, say
  so and cut scope against the **Out** list with the user, rather than quietly
  producing a week of spec for an evening's appetite.

## Step 1 — The domain words

Do this first, because every other section is written in them. `CLAUDE.md`'s tables
are law: a **run**, a **board**, the **grid**, the **dial**, the **rules**, a
**record** vs a **medal** vs an **achievement**, the **fortune**.

- **Words this work uses** — list them, and if one is being used loosely, pick the
  right one now.
- **Words this work introduces** — each needs a one-line definition, the identifier it
  lives under, and a note that `CLAUDE.md`'s table gains a row. A concept that ships
  without a word ends up with three.
- **Collisions** — this repo has real ones (`admin` the room host vs `admin` the role;
  `Challenge` the dare vs a **challenge** the mode). If the new word is near one, say
  which and how they stay apart.

## Step 2 — Files

A table: path, created or modified, and one line on its responsibility. Every path
verified to exist (or deliberately new). Grouped created-then-modified.

Follow where the repo already puts things — pure helpers in `lib/` with a colocated
test, machine logic in `machines/`, one mode per file in `modes/definitions/`, one
component per file. The **`code-guide`** skill is the authority; name anything here
that it would forbid, now, rather than letting `review` find it.

## Step 3 — Data and types

The shapes, not the code: the new types, the value maps and the union they are
exhaustive over, the storage key (and whether a shape change needs a **new versioned
key**), the machine context and events that gain fields.

If the schema changes, this section owns it: the migration's filename, the tables,
columns, functions and policies, and **what already-shipped rows do** on the day it
lands. Migrations are not applied by CI — the **`deploy`** skill asks the database
what is pending — so say explicitly whether the code can run against the old schema
or whether the push has to go first.

## Step 4 — Copy, and the gates

Four questions this repo punishes you for answering late. Answer all four, even when
the answer is "none" — a visible "none" is what stops `review` re-deriving it.

| Gate            | The question                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | Every player-visible string, listed. All of them go through Lingui and get Czech; an unextracted string renders its id.    |
| **How to Play** | Does this touch controls, targets, timers, modes, difficulty, scoring, streaks or lives? If yes, name the section to edit. |
| **Flag**        | Is it behind a `constants/features.ts` key, and at what floor? `nobody` while it is off the app entirely.                  |
| **Buttons**     | Any new pressable needs a `ButtonId` in `constants/buttons.ts` before `TrackedPressable` can use it.                       |

## Step 5 — Acceptance criteria

The heart of the document, and the thing `verify` walks. Numbered, and each one
**checkable by someone with no memory of this conversation**: it names what to do and
what must be true, in terms of what is on the screen or what a function returns.

```markdown
1. On Trainee, taking a key mid-swipe fires one light impact; taking two keys in one
   swipe fires two, not one.
2. With haptics off in options, no run fires any.
3. `runRules('trainee', 'easy').haptics` is `true`; `('speed', 'extreme')` is `false`.
4. `pnpm check` is green, Czech included.
```

Six to twelve is the usual range. Then **## Tests** — which colocated `*.test.ts`
files are created or extended, and the behaviours each covers. Every pure function in
`lib/` and every machine helper gets one; UI does not, unless the behaviour is
non-trivial.

## Step 6 — Review focus

Three to five things the spec _implies_ that no happy path would catch, each pinned to
the task that owns it: the effect that re-fires because an identity changed every
render, the query whose filter now excludes the row somebody went looking for, the
guard that one of two routes bypasses, the key that exists on one side only. This is
the list **`review`** reads. Writing it here, while the design is still in your head,
is worth more than finding the same things after the code exists.

## Step 7 — Write it

**`spec.md`** gains **## Contract** with Steps 1–4 under it, then **## Acceptance
criteria**, **## Tests** and **## Review focus**. Leave the shape's sections intact
above — the why stays with the what.

**`plan.md`** is new, and short. The tasks, in the order they can actually be done,
each one a sitting or less:

```markdown
# <Title> — Plan

Spec: docs/work/<folder>/spec.md

## Tasks

- [ ] 1. `modes/dial.ts` — add `haptics` to `DialSpec`, default off
- [ ] 2. `modes/definitions/trainee.ts` — turn it on; `modes/rules.test.ts` covers it
- [ ] 3. `components/game/dial.tsx` — fire on key cross, once per key
- [ ] 4. Options row + Czech; `pnpm i18n:extract`

## Verification log

_(verify fills this in)_
```

Dependencies first, player-visible last where there is a choice — it keeps the tree
runnable between tasks. No prose context inside a task: the spec is one file away and
`build` reads it.

Then set `Stage: spec` and `Next: /build <slug>`.

## Step 8 — Put the contract up

`AskUserQuestion` before handing off: the acceptance criteria are what the work will
be judged against, and a criterion the user disagrees with is cheapest to fix now.
Offer accept / change the criteria / cut scope.

## Hand off

`Next: /build <slug>` — works the plan task by task against these criteria.
