---
name: deploy
description: Deploy the app to production — establishes what will ship, asks whether to push pending database migrations, then dispatches the manual GitHub workflow (.github/workflows/deploy.yml) which gates on the static suite and the dependency audit before letting EAS build and publish the web bundle. Use only when the user explicitly asks to deploy, release, or ship to production.
---

# Deploy

Nothing reaches players on its own. Both deploy workflows are
`workflow_dispatch` only — a push to `main` runs the checks and stops — so a
person asking is the only way production changes.

CI is split across two providers. GitHub Actions holds everything cheap:
`checks.yml` is the static suite (lint, Prettier, types, Knip, tests, i18n), and
`.github/workflows/deploy.yml` runs that suite **plus** `pnpm audit` as a gate,
then creates the EAS run only if both pass. EAS runs only what needs EAS — the
env vars, the build, the deploy.

So the gate is in the pipeline, not in this skill: a red lint means the EAS run
is never created. **Dispatch the GitHub workflow** (Step 5) and let it enforce
that. Steps 1–4 are still yours, because the pipeline cannot tell you whether a
migration is pending or whether `main` is the commit the user meant.

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

The deploy workflow re-runs the whole suite against the ref itself, so this step
is about finding out **now** rather than after a dispatch. Two cheap ways, and
the first is better because it answers for the commit that ships:

```bash
gh run list --workflow checks.yml --branch main --limit 3 \
  --json headSha,conclusion,createdAt
```

A `success` on the sha from Step 1 means the gate will pass. A failure, or no run
for that sha, means fix it first.

`gh` is **not installed on this machine** — if the command isn't found, don't
retry it. Either run the **`check`** skill (`pnpm check`) instead, or read the run
off the Actions tab. If what you checked is the working tree while `origin/main`
differs, say so, because you verified a different thing than the one shipping.

Either way: if it can't be made green, **stop**. The pipeline would refuse the
deploy anyway; refusing here costs the user less time.

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

Dispatch the **GitHub** workflow, not the EAS one. It is the gated path.

`gh` is not installed on this machine, so by default this step is the user's to
press — hand them the link and say what to click:

> <https://github.com/DNepovim/nine/actions/workflows/deploy.yml> → **Run
> workflow** → branch `main` → **Run workflow**.

If `gh` is available (they installed it, or asked you to run it), dispatch it
yourself instead:

```bash
gh workflow run deploy.yml --ref main
gh run watch "$(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

`main` is the ref the gate and the deploy both run on; name a different branch
only if the user said so. Report the run URL.

Three jobs, in this order: the static suite and the audit in parallel, then the
deploy — which re-checks that the branch tip has not moved since the gate ran,
and calls `eas workflow:run … --wait` so the GitHub job's result **is** the
deploy's result. On the EAS side: env vars, build, `eas deploy --prod`.

It takes a few minutes. Offer to watch rather than assuming it passed. For the
EAS half specifically:

```bash
pnpm dlx eas-cli@latest workflow:view     # pick the run, see its jobs
pnpm dlx eas-cli@latest workflow:logs     # drill into a failing step
```

### The bypass

`pnpm dlx eas-cli@latest workflow:run .eas/workflows/deploy.yml --ref main --non-interactive`
still works and still skips the whole gate — no lint, no audit. Use it only when
GitHub Actions itself is down or the user explicitly asks for it, say out loud
that the gate was skipped, and never take it to get around a red suite.

## When it fails

- **Static checks failed** — the suite is red on the ref. Nothing was deployed and
  no EAS compute was spent. Fix it and dispatch again; don't reach for the bypass.
- **Audit failed** — a dependency advisory, not the user's code. Report the
  package and ask whether to bump it or deploy anyway (the gate exists to be a
  decision, not a wall). "Anyway" here means the bypass, so say that it skips the
  static suite too.
- **"Ref has not moved" failed** — someone pushed to the branch while the gate was
  running. Re-read Step 1 for the new commit and dispatch again.
- **`EXPO_TOKEN` missing or rejected** — the GitHub secret, not a local login. The
  fix is an Expo robot token in the repo's Actions secrets; `eas login` locally
  does nothing for this.
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
