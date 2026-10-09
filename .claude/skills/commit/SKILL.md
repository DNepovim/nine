---
name: commit
description: Use when asked to commit — via `/commit` or in plain words ("commit this", "commit my changes") — or when another skill needs work committed. Owns this repo's commit-message conventions, the split-into-separate-commits rule, and the confirm-before-committing gate.
---

# Commit

**Never commit without the user's explicit confirmation of the message(s).** Use
`AskUserQuestion` for that confirmation, never plain text — it keeps the session
unblocked.

## Step 1 — Know what you're committing

One call, not three — these are independent, so splitting them only buys
round trips:

```bash
git status --short && git diff --stat && git log --oneline -3
```

If the tree is clean, say there's nothing to commit and stop.

Read the full `git diff` only for the files whose _why_ you cannot infer from the
stat and the filenames. On a large change a full diff is mostly noise you will
not cite: get the shape from `--stat`, then `git diff -- <paths>` for the two or
three files that carry the actual decision.

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
  showed up.
- `style` means whitespace and formatting, not visual design. A UI change that
  alters what the player sees is `feat` or `fix`.

### Keep it brief

A commit message is skimmed in a log, not studied. **The default is a subject and
nothing else.**

- **Subject:** 72 characters or fewer.
- **Body:** one paragraph, two or three sentences, and only when the subject
  cannot carry the _why_ on its own.
- **No body at all** for most `chore`, `ci`, `style`, `docs`, `test` and
  one-line fixes. A body that only restates the subject is worse than none.
- **Two paragraphs is the ceiling.** Wanting a third means the commit should have
  been split — go back to Step 3.

Leave out what is already somewhere better:

- **How it works.** This repo comments heavily at the code; a body that
  re-explains the mechanism goes stale the moment one of those comments is
  edited, and the comment is what the next reader actually finds.
- **File lists, counts, per-file notes.** `git show --stat` is one keystroke.
- **Reasoning a spec already records.** Reference `docs/work/<slug>/spec.md` by
  path instead of restating it.
- **Narration of the work** — what was tried, what was verified, which checks
  ran. None of it survives as useful history.

Long bodies appear in this repo's older history. Don't match them; they are the
habit this section exists to correct.

> **Too long** — three paragraphs on mechanism, counts and sequencing:
>
> ```
> refactor(design): make a text style a role rather than a triplet
>
> The app had grown 139 distinct text styles across 112 files, and the drift had
> become legible: the label on a primary button was 13px in most places, 12px on
> the feedback and install dialogs, and 11px on the three cards that ask for a
> nickname, an address and a motto. Nothing chose those three sizes — each was
> typed next to whatever was already on screen.
>
> `constants/typography.ts` holds the scale now: `TYPE` for the mono voice, a
> size-only `GLYPH` ramp for emoji, `READOUT` for the DSEG7 digits. 328 call
> sites moved onto it; the 18 that would change a size are held back. […]
> ```
>
> **Right** — the why, once:
>
> ```
> refactor(design): make a text style a role rather than a triplet
>
> 139 text styles had accumulated across 112 files, to the point where the
> primary button's label was 13px in most places, 12px in two dialogs and 11px
> in three cards. A screen now asks `constants/typography.ts` for a role and
> picks no sizes of its own.
> ```

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
