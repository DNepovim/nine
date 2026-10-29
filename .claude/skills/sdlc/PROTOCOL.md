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

Each stage **runs the next one itself** (see the hand-off below), and puts its
questions to the **`sdlc-advisor`** agent before the user (see Asking). The user is
stopped only for what the advisor says is theirs.

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
Ticket: NNN-12
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
- **Ticket** — the Jira key, written by **`ticket`**. Absent on work that never got
  one; never invented by another stage.

## Step 0 — Load (every skill does this, before anything else)

```bash
grep -H '^Stage:\|^Next:\|^Track:' docs/work/*/spec.md 2>/dev/null
```

- **A slug was given** — read that folder's header, then **only the sections this
  stage uses** (each skill names them; `grep -n '^## ' spec.md plan.md` finds them).
  Read a file in full only where the skill says so.
- **Already loaded this session** — when the previous stage of the chain ran in this
  same conversation, the item is in context. Don't re-read it; re-read only what that
  stage wrote.
- **No slug** — take the items whose `Stage` is the one this skill consumes. Exactly
  one, use it. More than one, `AskUserQuestion` (through the advisor — see Asking).
  None, say so and name the stage that would produce one.
- **No `docs/work/` at all** — this is the first item; only `brainstorm`, `shape` and
  `sdlc` may create one.

Then say, in two lines, what you loaded — the title, the slug, the stage, the track,
the branch. A cold session must show the user it landed on the right item before it
starts changing things.

## The order guard

Run out of order only on a confirmed skip. If the item's `Stage` is not the one this
skill consumes, `AskUserQuestion` (through the advisor):

- **"<the proper stage> first"** — hand off to it (Recommended)
- **"Run <this stage> anyway"** — proceed, and write `Skipped: <stage>` into the
  header so the gap is visible later
- **"Cancel"**

Never skip silently. A `build` with no spec behind it is the normal way this pipeline
produces the wrong feature.

## Asking — the advisor first

The cycle runs on its own, and the user is asked as little as possible. **Every
`AskUserQuestion` a cycle skill names** — the order guard, the appetite, the track,
the contract, a spec that turned out wrong, ship's questions — is first judged
against the rules in `.claude/agents/sdlc-advisor.md`. Spawning that agent is the
expensive route: it starts cold and re-reads the item. So, in this order:

1. **On the advisor's "always" list** (deploy, any production write — `db:push`,
   `config:push` — Chrome, an ignored advisory, a rule CLAUDE.md reserves for the
   user) — straight to `AskUserQuestion`. No agent: its answer is fixed.
2. **Settled inline** — when the item is already in your context, apply the
   advisor's "answer it yourself" rules yourself. Your recommendation with nothing
   written against it, a detail of _how_, or a cheap and visible mistake: decide it.
3. **Spawn the advisor** (`subagent_type: "sdlc-advisor"`) only when neither settles
   it — a product direction the spec might already answer, a history question. Gather
   every such question of the stage into **one** call, with the folder path, each
   question's options and your recommendation, and the finding that raised it. Wait
   for the reply.

Record a decision taken in 2 or 3 where it belongs (the spec's section, the task's
tick, the build notes) as `decided by advisor: <why>`, so the user can see later what
was decided without them. Everything that ends up the user's goes in **one**
`AskUserQuestion` per stage.

## Keep the files short

Every later stage and every advisor pays to read what an earlier stage wrote. So:

- **Rounds collapse.** When a stage goes round again (a second verification log, a
  second set of build notes), first boil the previous round down to a few lines — what
  failed, what fixed it — and put the new round under that, rather than appending a
  whole second copy.
- **No restating.** A section points to the one above it ("per Shape") instead of
  repeating it. Evidence in a log is a line, not a transcript.

## The hand-off (every skill ends this way)

1. Write your section into `spec.md` (or `plan.md`, from `build` on).
2. Set `Stage:` to the stage you just finished and `Next:` to the command that follows.
   `Next:` is still written every time: it is what a cold session resumes from when a
   chain is interrupted.
3. Say in **one line** what finished and what runs now —
   `verify: 7/7 PASS. Running /review dial-haptics.`
4. **Invoke the next skill** with the Skill tool, passing the slug, in the same turn.
   Backwards too: a `verify` that fails invokes `build`, which invokes `verify` again.

The chain stops only when:

- **`ship` finishes.** The deploy offer at its end is the last thing the user sees;
  deploying is never part of the chain.
- **A question was escalated** and the user has to answer it. After the answer, carry
  on and keep chaining.
- **The same item has gone backwards twice** in this session (verify or review →
  build). A third pass goes to the advisor first, which hands it to the user.
- **The user asked for one stage only** — `/build <slug> --step`, "just spec it",
  "stop after verify". Then close with the `Next:` line as a command they can type,
  and stop.
