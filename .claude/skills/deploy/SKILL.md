---
name: deploy
description: Deploy the app to production — runs the local check suite, asks whether to push pending database migrations, then triggers the manual EAS workflow (.eas/workflows/deploy.yml) which builds the web bundle and publishes it to EAS Hosting. Use only when the user explicitly asks to deploy, release, or ship to production.
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

## Step 3 — Migrations (ask every time)

Code that reads a column the production database doesn't have is a broken app,
not a slow rollout. **Never deploy past this step without putting the question
to the user.**

Ask the database what it actually has — not git. A migration can be committed
and already applied, or uncommitted and never applied, and the working tree
can't tell you which:

```bash
pnpm exec supabase migration list --linked
```

The `Local` / `Remote` columns are the answer: any row with a local version and
no remote one is **not yet in production**. The linked project _is_ production
(`supabase/.temp/project-ref`), so `pnpm db:push` writes to the live database —
there is no staging rung below it, and no undo.

### If anything is unapplied

List the pending migrations by filename, then ask with **`AskUserQuestion`**:

- **"Push them, then deploy"** — run `pnpm db:push` and wait for it to succeed.
  Migrations go **before** the deploy: new code reading an old schema breaks,
  old code ignoring a new column does not. (Recommended)
- **"Deploy without pushing"** — only sane when the deploy doesn't depend on
  them. Say which pending migrations you're leaving behind before continuing.
- **"Cancel"** — stop entirely.

Show what will run before pushing if the user wants to see it:

```bash
pnpm exec supabase db push --dry-run
```

If `db:push` fails, **report the error and stop** — do not deploy code that
expects a schema the push didn't deliver.

### If everything is applied

Say so in one line — "no pending migrations, production schema is current" —
and move on. Don't skip it silently; the user wants to see that this was
checked.

### If the check itself fails

A CLI that isn't linked, isn't authenticated, or can't reach the project tells
you **nothing** about the schema. Do not read that as "clean". Report what
failed and ask whether to deploy blind or stop.

## Step 4 — Confirm

Ask with **`AskUserQuestion`**, naming the commit from Step 1 and what Step 3
settled:

- **"Deploy `<sha> <subject>` to production"** — and in the description, say
  where the schema stands: migrations pushed, nothing pending, or pending and
  deliberately skipped.
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
