---
name: commit
description: Use when asked to commit — via `/commit` or in plain words ("commit this", "commit my changes") — or when another skill needs work committed. Owns this repo's commit-message conventions, the split-into-separate-commits rule, and the confirm-before-committing gate.
---

# Commit

**Never commit without the user's explicit confirmation of the message(s).** Use
`AskUserQuestion` for that confirmation, never plain text — it keeps the session
unblocked.

## Step 1 — Know what you're committing

```bash
git status --short
git diff            # staged + unstaged
```

If the tree is clean, say there's nothing to commit and stop.

**Checks must be green before committing.** If the caller already ran the
**`check`** skill in this turn (`ship` does), don't run it again. Otherwise run it
now; if anything can't be made green, stop and report rather than committing
failing code.

## Step 2 — Write the message

Follow **Conventional Commits v1.0.0**
(https://www.conventionalcommits.org/en/v1.0.0/):

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
- Scope in parentheses, e.g. `feat(scoring): …`.
- Body: say _why_, not just what. Name the defect a `fix` repairs and how it
  showed up. Skip the body entirely for genuinely trivial changes.
- `style` means whitespace and formatting, not visual design. A UI change that
  alters what the player sees is `feat` or `fix`.

Every message ends with the footer:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Keep the model name matching whichever model is actually authoring the commit;
the repo's history uses this form.

## Step 3 — Split logically separate changes

If the tree holds unrelated changes, propose **one commit each** — a coherent
Conventional Commit plus the files it covers — rather than one catch-all.

Splitting only works when the changes occupy **different files**, because
interactive git (`git add -p`, `git add -i`) is unavailable in this environment.
When two changes share a file, say so and propose a single commit instead of
pretending the split is available.

## Step 4 — Confirm, then commit

Present the message(s) with **`AskUserQuestion`**:

- **"Ship it"** / **"Commit"** — proceed as-is (Recommended)
- **"Edit message"** — the user supplies a replacement; use it verbatim
- **"Cancel"** — stop, commit nothing

If the user picks "Edit" but sends no replacement text, **do not commit** — ask
again for the copy, offering drafts they can pick from.

Once confirmed, stage per commit and pass the message on stdin so multi-line
bodies survive intact:

```bash
git add <paths for this commit>
git commit -F - <<'EOF'
feat(scope): do the thing

Why it was needed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

Report the resulting SHA and file count. **Pushing is not part of committing** —
only push when the user or the calling skill asked for it.

## Never

- Amend or rewrite history the user didn't ask about.
- Stage unrelated files. `git add -A` is fine only when everything in the tree
  belongs to this one commit.
- Commit secrets. `.env` is gitignored — keep it that way.
