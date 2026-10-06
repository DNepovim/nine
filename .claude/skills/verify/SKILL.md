---
name: verify
description: Check that built work actually does what its spec said — `/verify <slug>`, "verify this", "does it work", "test it properly". Runs the full static suite, walks every acceptance criterion one at a time, drives the real app for anything player-visible, and records a pass or fail per criterion. Fifth stage of the development cycle; hands back to build on a failure, forward to review on a pass.
---

# Verify

One question, asked criterion by criterion: **does the code do what the spec said it
would?** Not whether it is good code — that is **`review`**. Not whether it is the
right feature — that was **`shape`**.

Read `.claude/skills/sdlc/PROTOCOL.md`, load the item, and read the spec's
**## Acceptance criteria** and the plan's **## Build notes** before running anything.
A build note that says a criterion was changed is the first thing to check.

## The posture

You are trying to make each criterion **fail**. A verification that assumes the code
works finds nothing, and a cheerful pass here is worse than no stage at all: it is
what sends a broken build to `ship` with a document saying it was checked.

Two standing rules:

- **No criterion passes on inspection alone** if it describes something a player does.
  Reading the code and concluding it must work is not verification. Run it.
- **Report what happened, including the parts that didn't run.** A criterion you could
  not check is `SKIPPED` with a reason, never a pass.

## Step 1 — The suite

Invoke the **`check`** skill: i18n verify, lint, Prettier, types, Knip, tests. It
fixes what it can.

Anything it cannot make green **stops this stage**. Do not continue to the criteria on
a red suite — write the failure into the log and hand back to **`build`**. The one
exception is a failure that predates this work and is demonstrably not yours: name it,
show that it fails on `main` too, and carry on.

## Step 2 — The criteria, one at a time

Walk them in order. For each, pick the cheapest honest evidence:

| The criterion is about…                      | Verify it by…                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| A pure function or a machine helper          | A test — the spec's, or a scratch `vitest run` if the criterion goes further     |
| The rules a run is governed by               | Resolving them: `runRules(mode, difficulty)` and reading the field               |
| Something the player sees, presses, or feels | The **`run`** skill — drive the real app and look                                |
| The database                                 | Querying it locally; production writes are the user's to run, never this stage's |
| A string                                     | `pnpm i18n:verify`, plus the Czech actually reading as Czech                     |

Record each as it lands, in `plan.md`'s **## Verification log**:

```markdown
| #   | Criterion                    | Result | Evidence                                                   |
| --- | ---------------------------- | ------ | ---------------------------------------------------------- |
| 1   | One impact per key taken     | PASS   | ran the app, three-key swipe → three taps                  |
| 2   | Off in options silences it   | FAIL   | still fires; `dial.tsx:88` reads the spec, not the setting |
| 3   | `runRules` exposes `haptics` | PASS   | `vitest run modes/rules.test.ts`                           |
```

Keep going after the first failure — a full list of what is broken is worth far more
than the first thing that broke. Only an environment that cannot run at all justifies
stopping early.

## Step 3 — Look past the criteria, briefly

The criteria are the contract, not the whole truth. Spend a few minutes on what a
spec routinely fails to say, and add anything you find as a **new numbered criterion**
rather than as a loose remark:

- The **first launch** path: no profile, no scores, nothing hydrated, auth not settled.
- The **other modes and difficulties** the change was not written for, including the
  **tutorial** — its rules take things off, and code assuming they are on breaks there.
- **Both themes**, if anything visual changed, and both locales.
- What the player sees while something is **loading or offline**.

## Step 4 — The verdict

Write it at the top of the verification log, and say it in the message in one line:
how many criteria passed, which failed, which were skipped and why.

- **Anything FAILED** — `Stage: verify`, `Next: /build <slug>`, and hand **backwards**.
  Say which tasks reopen. Do not fix it here: this stage loses its value the moment it
  also writes the code it is judging. A one-line typo is the only reasonable
  exception, and say that you took it.
- **All PASS** — `Stage: verify`, `Next: /review <slug>`.
- **A criterion that turned out to be wrong**, rather than unmet — `AskUserQuestion`.
  Amending `spec.md` is legitimate; deleting a criterion because the code does
  something else is not, and the difference is whether the _player_ is better off.

## Hand off

- **Failures** — `Next: /build <slug>` — the log says which criteria reopen.
- **Clean** — `Next: /review <slug>` — the quality pass, then `ship`.
