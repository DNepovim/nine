---
name: ship
description: Ship the current work — first run the `check` suite and the dependency audit, then (default) commit on a new branch and open a GitHub PR, or (`ship prod`) commit and push straight to main, and finally offer to deploy to production. Use when finishing a piece of work and you want it committed / PR'd / shipped. Argument, `prod`, controls the mode. Last stage of the development cycle: it reads the work item's spec for the why behind the commit, and marks the item shipped.
---

# Ship

Two modes:

- **`ship`** (no argument) → ask the user whether to open a branch + PR or commit directly to `main`.
- **`ship prod`** → skip the question and commit directly to `main`.

The commit itself belongs to the **`commit`** skill — this skill gates, decides
where the work lands, and pushes. **Running `/ship` is the confirmation for the commit
message** — the `commit` skill writes it and commits without asking. The one
confirmation still collected is Step 0c's, for where the work lands and the branch name.

Shipping is not deploying. Nothing that happens here reaches a player: pushing
`main` builds nothing and publishes nothing. Production moves only when someone
runs the **`deploy`** skill, which Step 3 offers at the end.

## First — the work item (when there is one)

Work that came through the cycle has a folder, and that folder holds the _why_ this
skill would otherwise have to reconstruct from a diff:

```bash
grep -H '^Stage:\|^Next:' docs/work/*/spec.md 2>/dev/null
```

An item whose `Next:` is `/ship <slug>` — or the slug the user named — is this one.
Read its `spec.md` (the problem, the shape) and its `plan.md` (what was built, what
`verify` found, what `review` left). Say in one line which item you are shipping.

If its `Stage:` is not `review`, the work skipped a stage. Ask — the **`sdlc-advisor`**
first, per the protocol: run the missing stage first (recommended), or ship anyway. Unverified work can be shipped —
it just must not be shipped _silently_.

No folder, no problem: work that never entered the cycle ships from the diff, exactly
as before. Read `.claude/skills/sdlc/PROTOCOL.md` only if you need the format.

## Ask once, not four times

Steps 0b, 0bb and 0c end in up to four `AskUserQuestion`s, and **none of them
depends on another's answer** — migrations, the project config, the announcement
and the branch-or-main choice are independent. `AskUserQuestion` takes four
questions per call, which is exactly what those come to at their fullest, so
gather them into **one** call and save three round trips.

Do the cheap reads first (`git status supabase/migrations/ supabase/config.toml`,
the diff) so the questions you ask are the ones that actually apply: a tree with
no migration files, no config change and nothing player-visible collapses to a
single question, or none at all in `prod` mode.

Sort that batch per the protocol's Asking rule (`.claude/skills/sdlc/PROTOCOL.md`).
A migration or config push writes to production, so it goes **straight to the user**,
with no advisor. Settle the branch-or-main choice and the announcement yourself from
the spec and the repo's habits (`git log --oneline -15` shows how recent items
landed). Spawn the advisor only if those really don't settle it. Whatever is left
reaches the user in one call.

The deploy offer in Step 3 is the exception and stays separate — it is only valid
once the push has actually landed.

## Step 0 — Gate on checks (both modes)

Invoke the **`check`** skill (lint, Prettier, types, Knip). It fixes what it can;
if anything can't be made green, **stop** and report — do not ship failing checks.

This is the cycle's last full `check`, and normally its only one after `verify`.
When `verify` ran it in this same session and nothing has changed since (no edits in
`review`, no announcement added), you can skip it — say so in one line.

Then run the same dependency audit the deploy workflow gates on:

```bash
pnpm audit --audit-level high
```

`check` does not run it, and a new advisory can land overnight against code
nobody touched — so a ship that skips it hands Step 3 a deploy that dies in
CI. If it fails, fix it in this ship: add a `pnpm.overrides` entry in
`package.json` raising the package to its patched version (the house way, as
the existing entries show), run `pnpm install`, then audit again. The override
and its lockfile change are their own `fix(deps)` commit, which the `commit`
skill splits out. Ignoring an advisory (`auditConfig.ignoreGhsas`) is the
user's decision, never this skill's. Only a green audit goes on.

Then look at what will ship, in one call rather than several:

```bash
git status --short && git diff --stat && git status --short supabase/migrations/
```

If the tree is clean, say there's nothing to ship and stop. Reach for the full
`git diff` only on the files whose _why_ the stat cannot give you — on a large
change it is mostly noise, and the commit message does not quote it.

Having run `check` here, tell the `commit` skill it's already green so it doesn't
run the suite a second time.

## Step 0b — Production state (both modes)

Two things live on the server rather than in the bundle, and code that assumes
either one is a broken app rather than a slow rollout. Both are checked in the
working tree, which is what is about to be committed — a change already
committed before `/ship` ran is caught later, by `deploy`'s own pass.

### Migrations

```bash
git status --short supabase/migrations/
```

If any migration files appear in the output (new `??` or modified `M`), ask the
user before proceeding using **`AskUserQuestion`**:

- **"Yes, push now"** — run `pnpm db:push` and wait for it to succeed before
  continuing. If it fails, report the error and stop — do not ship code with a
  failed migration. (Recommended for `ship prod`)
- **"No, skip"** — continue without pushing migrations.

If no migration files changed, skip this step silently.

### Project config

`supabase/config.toml` is production's auth and API settings as well as the
local stack's — site URL, OTP length and expiry, the rate limits, secure email
change, the Resend SMTP block — pushed from its `[remotes.production]` block.

```bash
git status --short supabase/config.toml
```

If it appears, ask with **`AskUserQuestion`**:

- **"Yes, push the config"** — run `pnpm config:push`. It refuses outright if
  the sender is still a placeholder or `RESEND_API_KEY` is unset, then hands
  over to the CLI, which prints a diff and asks. (Recommended for `ship prod`)
- **"No, skip"** — continue, and say which settings stay as production has them.

**Never pass `--yes`, and never answer the CLI's prompt on the user's behalf.**
The diff carries every pushable key in the file rather than only the edited
ones, so it is a diff somebody has to read. Show it and hand the decision back.

In branch mode this puts a setting live before the code that assumes it has
merged. Usually harmless and sometimes the point — a loosened rate limit hurts
nothing early — but say it out loud rather than pushing quietly.

If `config.toml` did not change, skip this step silently.

## Step 0bb — Offer a release announcement (both modes)

Players see announcements in the app's what's-new popup, sourced from
`constants/news.ts`. Adding one here means it lands in the **same commit** as the
feature it describes.

The work item's **## Problem** is the best source there is for this: it is already
written as what was wrong for the player, which is what an announcement answers.

Read the diff and judge whether anything in it is worth telling a player about —
a new feature, a visible change, something that alters how the game feels. Pure
refactors, CI changes, dependency bumps and internal fixes are not.

Ask with **`AskUserQuestion`**:

- **"Yes, announce it"** — draft and add an entry (Recommended when the diff
  contains anything player-visible)
- **"No"** — skip; ship without touching `constants/news.ts`

If yes, draft the entry and show it for confirmation **before writing the file**:

- `id` — short, kebab-case, permanent. Never reuse one; "seen" state is keyed on
  it, so a reused id means players silently miss the new announcement.
- `icon` — an Ionicons name that suits the change.
- `accent` — a colour from the app's mode spectrum (`#4C7EFF`, `#7273D2`,
  `#c36282`, `#E5534B`, `#FF8C00`).
- `title` — a few words, sentence case; it is upper-cased in the UI.
- `body` — markdown, and **brief**: two or three sentences whose job is to make a
  player want to try it. Say what they can now do and why that is good, then
  stop.
  - Leave out the specifics — colours, timings, thresholds, counts, file names,
    commit types, anything about how it was built. A player is not reading a
    changelog.
  - Bullets only for a genuine list of separate things. Prose reads warmer.
  - **One array entry is one paragraph, not one line.** Never split a sentence
    across entries to keep the source narrow. The entries are joined verbatim,
    and a newline inside a paragraph renders as a hard line break in the app —
    so the text wraps at whatever column the source happened to use instead of
    at the screen edge. Join paragraphs with `'\n\n'`, or use a plain string
    when there is only one.

Present the drafted entry with **`AskUserQuestion`**: "Use it", "Edit" (they
supply replacement copy), or "Skip the announcement".

If they pick "Edit" but send no replacement text, **do not commit yet** — ask
again for the copy, offering drafts they can pick from.

Once confirmed, add it to `constants/news.ts` under today's date — appending to
that release's `items` if today already has an entry, otherwise adding a new
release at the **top** of the array. Re-run `pnpm check` after editing the file,
and make sure the commit message covers the announcement as part of the change.

## Step 0c — Choose ship mode (only when invoked as plain `ship`)

Ask the user using **`AskUserQuestion`**. In branch mode the branch name is this
skill's to confirm, so include it in the same question:

- **"Branch + PR"** — create branch `<type>/<kebab-summary>` (e.g.
  `feat/leaderboard`, `fix/dial-overflow`) derived from the change, commit, push,
  open a GitHub PR. (Recommended)
- **"Commit to main"** — commit and push directly to `main` (same as `ship prod`).

## Step 1 — Commit

Invoke the **`commit`** skill. It owns the Conventional Commit format, the
one-commit-per-logically-separate-change rule and the co-author footer. Pass it the
context it needs:

- checks are already green (Step 0), so it should not re-run them
- **skip the message confirmation** — commit as soon as the message is written, and
  show the message(s) in the final report instead of in a question
- any `constants/news.ts` entry added in Step 0bb belongs in the commit

In branch mode, create and switch to the confirmed branch **before** invoking it
(`git checkout -b <branch>` carries the uncommitted changes across).

If the commit fails (a hook, nothing to commit), stop here — nothing to push.

## Step 2 — Push

### Default (`ship`, no arg): branch + PR

1. `git push -u origin <branch>`
2. Open the PR:
   `gh pr create --base main --head <branch> --title "<conventional title>" --body "<short summary of what & why>"`

   The body writes itself from the work item: the spec's problem statement, what the
   acceptance criteria were, and a line on what `verify` and `review` found. Link the
   spec by path so the reasoning is one click from the diff.

3. Report the PR URL.

### `ship prod`: push to main

1. `git push origin main`
2. **Note to the user:** a push to `main` runs nothing — no checks, no build, no
   deploy. The work is on `main`, and players still have the previous build.
   Production is Step 3's question.

## Step 3 — Offer to deploy (both modes)

Ask with **`AskUserQuestion`** — directly, not through the advisor: deploying is the
user's alone. This is where an automatic chain ends.

- **"Deploy to production"** — invoke the **`deploy`** skill, which re-states
  what will ship and confirms again before triggering anything.
- **"Not now"** — stop here. Say plainly that the work is pushed but not live,
  and that `deploy` is how it goes out later.

Two rules on this question:

- **Only offer it when the work is on `main`.** In branch mode the PR hasn't
  merged, so `main` doesn't have the change and deploying would ship the _old_
  code under a message implying otherwise. Skip the question, and say the deploy
  comes after the merge.
- **Treat choosing it as the explicit instruction** the `deploy` skill's gate
  requires — but nothing else does. If the user answers anything other than
  picking that option, do not deploy.

## Step 4 — Close the work item

Only for work that had a folder, and only once Step 2 actually pushed.

Set `Stage: shipped` in `spec.md`, and `Next:` to what is genuinely left — `—` when it
is on `main` and deployed, `merge the PR` in branch mode, `/deploy` when it is on
`main` and still waiting. Then add one line under the plan's review section: the
commit sha, and the PR URL if there is one.

The folder stays. It is the record of why the code looks like this, and `/sdlc` reads
its header to keep it off the open board.

## Notes

- Use `gh` for the PR; if `gh` isn't authenticated, tell the user to run
  `gh auth login` (as a `! gh auth login` prompt) rather than failing silently.
- Don't touch unrelated files or amend history the user didn't ask about.
- A push that fails on infrastructure (rather than on git) is worth one retry
  before reporting it.
