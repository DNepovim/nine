---
name: review
description: The quality pass before shipping — `/review <slug>`, "review this", "code review before I ship". Runs the built-in `/code-review` and `simplify` over the work, then the house pass this repo cares about: domain language, no mode branching outside modes/, extracted strings, How to Play currency. Sixth stage of the development cycle; hands to ship.
---

# Review

**`verify`** asked whether the code does what was promised. This asks whether it is
code this repo wants to keep. Different question, different findings, and it comes
second on purpose: reviewing code whose behaviour is still wrong wastes both passes.

Read `.claude/skills/sdlc/PROTOCOL.md`, load the item, and read the spec's
**## Review focus** — the three to five things written down while the design was still
in someone's head. Those are the findings most worth confirming, and the ones a
generic review is least likely to see.

```bash
git status --short
git diff
```

## Step 1 — The built-in review

Invoke **`/code-review high`** over the current diff. It finds correctness bugs and
reuse/simplification/efficiency cleanups, and it is better at that than a prose
checklist. Let it run; don't duplicate it by hand.

Then take its findings and **triage them against this item**, rather than applying
them blind:

- **A real defect in this work** — fix it, or hand it back to **`build`** if it is a
  task's worth.
- **A pre-existing problem the diff merely touched** — note it, leave it. It is its own
  work item, and the user decides whether to open one.
- **Something the spec decided deliberately** — say so and keep the spec's choice. A
  review finding is not senior to a decision somebody made on purpose.

## Step 2 — Review focus, confirmed one by one

For each item in the spec's **## Review focus**: say whether the code has the problem,
and show why not when it doesn't — the line, the guard, the test. "Checked, fine" for
five of them is not a pass, it is a skipped step.

If one of them turns out to be real, it is a `build` task with a test pinned to it,
not a quick fix in the review.

## Step 3 — The house pass

What `/code-review` has no way to know. Each of these is a rule this repo states
somewhere and pays for when it is broken:

| Check               | What to look for                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain language** | Identifiers, comments and copy use `CLAUDE.md`'s words — **run**, **board**, **grid**, **dial**, **fortune**, **record** vs **medal** vs **achievement**. A new word the spec named has its row in the table.        |
| **Mode branching**  | Nothing outside `modes/` reads a mode's name. A `mode === 'trainee'` in a screen is a missing **capability** or a missing rule.                                                                                      |
| **Value maps**      | No ternary chain or `switch` selecting a value from a known set. `as const satisfies Record<Union, V>`, so adding a member breaks the build instead of a screen.                                                     |
| **Strings**         | Every player-visible string is in the catalogs, with Czech. `pnpm i18n:verify` is the gate, but read the Czech too — an extracted-but-English string passes the gate.                                                |
| **How to Play**     | If the diff touched controls, targets, timers, modes, difficulty, scoring, streaks or lives, is `how-to-play-overlay.tsx` still true? This is the check `CLAUDE.md` asks for at the end of every task; it ends here. |
| **Design**          | Colours, type and motion from the **`design-guide`** scales, both themes, contrast held.                                                                                                                             |
| **Comments**        | They explain _why_. A comment restating the line above it is noise; a removed explanation of a decision is a loss.                                                                                                   |
| **Tests**           | Pure functions in `lib/` and machine helpers have colocated tests covering the edges, not only the happy path.                                                                                                       |

## Step 4 — Simplify

Invoke the **`simplify`** skill over the diff: reuse, altitude, dead scaffolding, the
abstraction built for a second caller that never arrived. Then re-run **`check`** —
simplification breaks types more often than anything else in this cycle.

## Step 5 — Write it up and hand off

A **## Review** section in `plan.md`: what was found, what was fixed, what was
deliberately left and why, and anything worth its own work item later. The last list
is the one that pays off — it is where the next `brainstorm` starts.

`Stage: review`. Then:

- **Something needs real work** — `Next: /build <slug>`, and say what reopens. Back
  through **`verify`** afterwards; a fix that skipped verification is an unverified
  build with a review attached.
- **Clean** — `Next: /ship <slug>`.

## Hand off

`Next: /ship <slug>` — checks, the news entry, the commit, the branch or `main`, and
the deploy offer. `ship` reads this item's spec for the _why_ behind the commit and
the PR.
