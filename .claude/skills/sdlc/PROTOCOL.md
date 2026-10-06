# The work item protocol

Every skill in the cycle reads this first. It is the only reason a stage can be run
in a session that knows nothing — the state is on disk, not in the conversation.

## The cycle

```
brainstorm → shape → spec → build → verify → review → ship
  (itch)     (bound) (contract) (code) (does it?) (is it good?) (out)
```

`brainstorm` is optional — it exists for an itch, not for a task. `spec` is skipped
on the **small** track. `verify` and `review` both hand **backwards** when they find
something; only `ship` ends the cycle.

## Where a work item lives

One folder per item, committed:

```
docs/work/<yyyy-mm-dd>-<slug>/
  spec.md     the what and the why — written once per stage, rarely rewritten
  plan.md     the how — tasks, ticks, the verification log (full track only)
```

The date is the day the item was **started** and never changes. The slug is
kebab-case, short, and the same word used for the branch: `dial-haptics` →
`feat/dial-haptics`.

## The header

The first lines of `spec.md` are the state of the item. Nothing else holds it, and
`plan.md` only points back here:

```markdown
# Haptics on the dial

Slug: dial-haptics
Stage: spec
Next: /build dial-haptics
Track: full
Branch: feat/dial-haptics
Started: 2026-10-07
```

- **Stage** — the stage that has **finished**: `brainstorm`, `shape`, `spec`,
  `build`, `verify`, `review`, `shipped`. Written by the skill that finished it.
- **Next** — the literal command to type next. A stage that hands backwards writes
  the backwards command here.
- **Track** — `small` or `full`, decided by `shape`.
- **Branch** — written by `shape` as an intention; `ship` is what actually creates it.

## Step 0 — Load (every skill does this, before anything else)

```bash
grep -H '^Stage:\|^Next:\|^Track:' docs/work/*/spec.md 2>/dev/null
```

- **A slug was given** — read that folder's `spec.md` in full, and `plan.md` too from
  `build` onward.
- **No slug** — take the items whose `Stage` is the one this skill consumes. Exactly
  one, use it. More than one, `AskUserQuestion`. None, say so and name the stage that
  would produce one.
- **No `docs/work/` at all** — this is the first item; only `brainstorm`, `shape` and
  `sdlc` may create one.

Then say, in two lines, what you loaded — the title, the slug, the stage, the track,
the branch. A cold session must show the user it landed on the right item before it
starts changing things.

## The order guard

Run out of order only on a confirmed skip. If the item's `Stage` is not the one this
skill consumes, `AskUserQuestion`:

- **"<the proper stage> first"** — hand off to it (Recommended)
- **"Run <this stage> anyway"** — proceed, and write `Skipped: <stage>` into the
  header so the gap is visible later
- **"Cancel"**

Never skip silently. A `build` with no spec behind it is the normal way this pipeline
produces the wrong feature.

## The hand-off (every skill ends this way)

1. Write your section into `spec.md` (or `plan.md`, from `build` on).
2. Set `Stage:` to the stage you just finished and `Next:` to the command that follows.
3. Close with **one line**: the next skill as a command the user can type, and what it
   will do. `Next: /verify dial-haptics — runs the checks and walks the five criteria.`

Nothing in the cycle moves on its own. Each skill stops at its own edge and names the
next one; the user types it.
