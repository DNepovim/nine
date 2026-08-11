---
name: ship
description: Ship the current work — first run the `check` suite, then (default) commit on a new branch and open a GitHub PR, or (`ship prod`) commit and push straight to main. Use when finishing a piece of work and you want it committed / PR'd / shipped. Argument, `prod`, controls the mode.
---

# Ship

Two modes:

- **`ship`** (no argument) → ask the user whether to open a branch + PR or commit directly to `main`.
- **`ship prod`** → skip the question and commit directly to `main`.

The commit itself belongs to the **`commit`** skill — this skill gates, decides
where the work lands, and pushes. **Never push or open a PR without the user's
explicit confirmation**, which the `commit` skill collects for the message and
Step 0c collects for the branch name.

## Step 0 — Gate on checks (both modes)

Invoke the **`check`** skill (lint, Prettier, types, Knip). It fixes what it can;
if anything can't be made green, **stop** and report — do not ship failing checks.

Then look at what will ship: `git status --short` and `git diff` (staged +
unstaged). If the tree is clean, say there's nothing to ship and stop.

Having run `check` here, tell the `commit` skill it's already green so it doesn't
run the suite a second time.

## Step 0b — Migration check (both modes)

Check whether any migration files are new or modified in the current working tree:

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

## Step 0bb — Offer a release announcement (both modes)

Players see announcements in the app's what's-new popup, sourced from
`constants/news.ts`. Adding one here means it lands in the **same commit** as the
feature it describes.

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
one-commit-per-logically-separate-change rule, the confirmation gate and the
co-author footer. Pass it the context it needs:

- checks are already green (Step 0), so it should not re-run them
- any `constants/news.ts` entry added in Step 0bb belongs in the commit

In branch mode, create and switch to the confirmed branch **before** invoking it
(`git checkout -b <branch>` carries the uncommitted changes across).

If the user cancels at the commit skill's gate, stop here — nothing to push.

## Step 2 — Push

### Default (`ship`, no arg): branch + PR

1. `git push -u origin <branch>`
2. Open the PR:
   `gh pr create --base main --head <branch> --title "<conventional title>" --body "<short summary of what & why>"`
3. Report the PR URL.

### `ship prod`: push to main

1. `git push origin main`
2. **Note to the user:** pushing `main` triggers the EAS Workflow
   (`.eas/workflows/deploy.yml`) → checks + **production deploy**. So `ship prod`
   effectively ships to production via CI.

## Notes

- Use `gh` for the PR; if `gh` isn't authenticated, tell the user to run
  `gh auth login` (as a `! gh auth login` prompt) rather than failing silently.
- Don't touch unrelated files or amend history the user didn't ask about.
- A push that fails on infrastructure (rather than on git) is worth one retry
  before reporting it.
