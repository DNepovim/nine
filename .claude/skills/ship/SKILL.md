---
name: ship
description: Ship the current work — first run the `check` suite, then (default) commit on a new branch and open a GitHub PR, or (`ship prod`) commit and push straight to main. Use when finishing a piece of work and you want it committed / PR'd / shipped. Argument, `prod`, controls the mode.
---

# Ship

Two modes, decided by the argument:

- **`ship`** (no argument) → new branch + GitHub PR.
- **`ship prod`** → commit and push directly to `main`.

Both start by gating on the checks and proposing Conventional Commit messages
for confirmation. **Never commit, push, or open a PR without the user's explicit
confirmation of the message(s) — and, for the branch flow, the branch name.**

## Step 0 — Gate on checks (both modes)

Invoke the **`check`** skill (lint, Prettier, types, Knip). It fixes what it can;
if anything can't be made green, **stop** and report — do not ship failing checks.

Then look at what will ship: `git status --short` and `git diff` (staged +
unstaged). If the tree is clean, say there's nothing to ship and stop.

## Step 1 — Propose Conventional Commit message(s) (both modes)

Read the diff and propose commit message(s) following **Conventional Commits
v1.0.0** (https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

- **types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
  `ci`, `chore`, `revert`.
- `feat` → MINOR, `fix` → PATCH. Breaking change → append `!` after type/scope
  **and/or** a `BREAKING CHANGE:` footer.
- Description: imperative mood, lowercase, no trailing period, concise.
- Scope is optional and in parentheses, e.g. `feat(scoring): …`.

If the working tree contains **logically separate** changes, propose **multiple
commits** (each a coherent Conventional Commit with the files it covers) rather
than one catch-all. Otherwise propose a single commit.

Present the proposed message(s) (and, in branch mode, the branch name — see
Step 2) and **ask the user to confirm or edit**. Only continue once confirmed.

Every commit message must end with the footer:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Step 2 — Ship

### Default (`ship`, no arg): branch + PR

1. Suggest a branch name `<type>/<kebab-summary>` (e.g. `feat/leaderboard`,
   `fix/dial-overflow`) derived from the change. Include it in the Step 1
   confirmation prompt.
2. If on the default branch (`main`), create and switch to the new branch
   (`git checkout -b <branch>`) — this carries the uncommitted changes with it.
3. Commit the confirmed message(s) (stage per-commit if splitting).
4. Push: `git push -u origin <branch>`.
5. Open the PR with `gh pr create --base main --head <branch> --title "<conventional title>" --body "<short summary of what & why>"`.
6. Report the PR URL.

### `ship prod`: commit + push to main

1. Ensure you're on `main` (or check it out).
2. Commit the confirmed message(s).
3. `git push origin main`.
4. **Note to the user:** pushing `main` triggers the EAS Workflow
   (`.eas/workflows/deploy.yml`) → checks + **production deploy**. So `ship prod`
   effectively ships to production via CI.

## Notes

- Use `gh` for the PR; if `gh` isn't authenticated, tell the user to run
  `gh auth login` (as a `! gh auth login` prompt) rather than failing silently.
- Don't touch unrelated files or amend history the user didn't ask about.
