---
name: deploy
description: Deploy the app to production — runs the local check suite, then triggers the manual EAS workflow (.eas/workflows/deploy.yml) which builds the web bundle and publishes it to EAS Hosting. Use only when the user explicitly asks to deploy, release, or ship to production.
---

# Deploy

Nothing reaches players on its own. `.eas/workflows/deploy.yml` is
`workflow_dispatch` only — a push to `main` builds nothing and ships nothing —
so this skill is the one path by which production changes.

CI is split: the static gate (lint, Prettier, types, Knip, tests, i18n) runs in
GitHub Actions, where minutes are free. EAS runs only the build and the deploy,
and trusts whoever triggers it to have checked. **That trust is this skill's
job** — Step 2 is not optional.

## The gate

**CLAUDE.md: never deploy to production unless the user explicitly asks for it
in the current turn.** "Continue", "ship it", "looks good" and an approval given
earlier in the conversation are all _not_ that. If you reached this skill
without an explicit deploy instruction in the latest message, stop and ask.

## Step 1 — Know what will ship

The deploy runs with `--ref main`, so it ships the **remote `main`** — not the
working tree, not the current branch. Establish what that is:

```bash
git status --short          # uncommitted work will NOT ship
git fetch origin main
git log --oneline origin/main -5
git status -sb              # ahead/behind origin/main
```

Report the commit that will go out: short sha and subject. Then:

- **Tree dirty, or branch ahead of `origin/main`** — say so plainly and ask
  whether to ship `origin/main` as it stands or commit and push first. The
  **`ship`** skill owns getting work onto `main`; don't reimplement it here.
- **Not on `main`** — the deploy still takes `main`. Say it out loud.

## Step 2 — Check the ref

EAS will not check for you. Run the **`check`** skill (`pnpm check` — i18n, lint,
Prettier, types, Knip, tests). If anything can't be made green, **stop**. Do not
deploy on a red suite.

If what you just checked is the working tree and the working tree differs from
`origin/main`, say so — you verified a different thing than the one shipping.

## Step 3 — Migrations

```bash
git status --short supabase/migrations/
git diff --stat origin/main -- supabase/migrations/
```

Code that reads a column the production database doesn't have is a broken app,
not a slow rollout. If any migration is new or unpushed, ask with
**`AskUserQuestion`** whether to `pnpm db:push` first, and wait for it to
succeed before deploying. If it fails, report and stop.

If nothing touched `supabase/migrations/`, skip this silently.

## Step 4 — Confirm

Ask with **`AskUserQuestion`**, naming the commit from Step 1:

- **"Deploy `<sha> <subject>` to production"**
- **"Cancel"**

No confirmation, no deploy.

## Step 5 — Run it

```bash
pnpm dlx eas-cli@latest workflow:run .eas/workflows/deploy.yml --ref main --non-interactive
```

`--ref main` matters: **without it the CLI packages and uploads the local
project directory**, so uncommitted and unpushed work would ship. Always pass
it, and pass a branch the user named rather than `main` only if they said so.

The workflow checks the env vars, runs `pnpm audit --audit-level high`, builds
the web bundle and deploys with `--prod`. Report the run URL the CLI prints.

It takes a few minutes. Offer to watch rather than assuming it passed:

```bash
pnpm dlx eas-cli@latest workflow:view     # pick the run, see its jobs
pnpm dlx eas-cli@latest workflow:logs     # drill into a failing step
```

## When it fails

- **Audit failed** — a dependency advisory, not the user's code. Report the
  package and ask whether to bump it or deploy anyway (the gate exists to be a
  decision, not a wall).
- **Env vars failed** — the `EXPO_PUBLIC_*` values are missing from the EAS
  environment, not from `.env`. Say that; the fix is in the EAS dashboard.
- **Build failed** — the static gate passed but the export didn't. Reproduce
  locally with `pnpm run build:web` before guessing.
- **`eas` not authenticated** — tell the user to run `! eas login` rather than
  retrying.

Production is unchanged in every one of these cases; EAS keeps serving the
previous deployment until a new one succeeds.

## Notes

- A deploy is the one action here visible to every player at once. Prefer
  reporting too much about what went out over too little.
- Rolling back is a promotion of an earlier deployment — look the command up
  rather than guessing flags, and treat it as a production action needing the
  same explicit instruction as a deploy.
