---
name: ticket
description: The one entry to Jira for this repo — `/ticket NNN-12` picks a ticket up (assign, move to In Development, hand to the cycle), `/ticket create <title or notes>` files a new Story or Task, `/ticket review NNN-12` fills in one that is too thin to start from. Also the place a ticket key gets attached to a work item in `docs/work/`.
---

# Ticket

Jira is the ledger: what is being done and why, in words a non-developer reads.
`docs/work/<date>-<slug>/spec.md` is the contract. **Nothing technical belongs in a
ticket** — no paths, no function names, no table columns. If you catch yourself
writing one, it belongs in the spec.

## Write it short

A ticket is read in ten seconds or it is not read. This is the rule the skill exists
to hold, so it is first:

- **Necessary information only.** Nothing a reader of the summary already knows.
- **Short sentences.** One clause each. No "This ticket covers…", no "The goal of
  this work is to…", no closing restatement.
- **Drop empty headings.** No Out of Scope when nothing is out, no Context when the
  summary is the context. A Task whose summary says everything gets no description.
- **Hard caps:** summary ≤ 80 characters. Description ≤ 120 words. Acceptance
  criteria ≤ 7 lines, one observable outcome each, present tense.
- **No hedging and no padding** — not "should ideally", not "as appropriate".

Longer is not more thorough. It is just longer.

## Config

| Setting        | Value                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Cloud ID       | `4004a004-65ed-4b17-87da-6340f0299d94`                                                                                            |
| Project        | `NNN` — "Nine", team-managed. `KAN` is a retained old key: it still resolves, but every issue comes back as `NNN-<n>`. Use `NNN`. |
| Board          | `KAN board` (named before the rename), Kanban — **no sprints**, never set one                                                     |
| Browse URL     | `https://blahadominik2.atlassian.net/browse/NNN-<n>`                                                                              |
| Content format | `contentFormat: "markdown"`, real newlines, never `\n`                                                                            |
| Language       | **English content** on a Czech-locale site. The copy you write is English; the type and status names below are not.               |

**Issue types** — the names are Czech and are what the API wants:

| What it is | Pass as   | ID                               |
| ---------- | --------- | -------------------------------- |
| Story      | `Scénář`  | `10009`                          |
| Task       | `Úkol`    | `10008`                          |
| Epic       | `Epic`    | `10006`                          |
| Subtask    | `Subtask` | `10007`                          |
| Bug        | —         | **does not exist yet** — see 2.1 |

**Statuses and transitions:**

| Status           | Means       | Transition ID |
| ---------------- | ----------- | ------------- |
| `Úkoly`          | To Do       | `11`          |
| `In Development` | being built | `21`          |
| `In Testing`     | verifying   | `31`          |
| `Hotovo`         | Done        | `41`          |

**Current user:** `atlassianUserInfo` → `account_id`. Nobody else is on this project,
so pickup assigns to that id without asking who.

Priority and labels are not configured here. Don't set them. If a create is rejected
on a field, drop the field and retry once — never retry the whole create (it may have
landed; check with the key in the response first).

## Step 0 — Mode

Parse `$ARGUMENTS`:

- **`NNN-12`** / `nnn 12` / `12`, or a `KAN-12` from before the rename → **pick up**
  (Mode 1).
- **`create …`** → **create** (Mode 2). If what follows is a work-item slug under
  `docs/work/`, read that item first (Mode 2.4).
- **`review NNN-12`** → **review** (Mode 3).
- **Empty** → `AskUserQuestion`: pick up / create / review.

---

## Mode 1 — Pick up

1. `getJiraIssue` — summary, description, status, assignee, parent, links, type.
2. **Ready?** A ticket is ready when the next stage can start without guessing: a
   Story needs its user-story line and its criteria; a Task needs its goal and its
   criteria. Not ready → `AskUserQuestion`: "Fill it in first" (Mode 3.2–3.4) /
   "Pick it up anyway".
3. **Take it** — `editJiraIssue` assignee = your accountId, and
   `transitionJiraIssue` to `21` (In Development). Both in one turn.
4. **Hand on** (Mode 4).

Already In Development and assigned → say so and go straight to 4.

---

## Mode 2 — Create

### 2.1 The type

Read the notes and pick: **Story** when a player gets something they did not have,
**Task** for everything else — tooling, refactors, infrastructure, copy, schema.
State the pick in one line; the user corrects it or it stands.

**A bug has no type in this project yet.** Stop and say so:
`AskUserQuestion` — "I'll add it (Project settings → Issue types → Add work type →
Bug), hold" / "File it as `Úkol` instead". On the first, stop; on the second,
continue with the Bug body under `Úkol`. Never invent a type name.

### 2.2 The body

**Story**

```
As a player, I want {action}, so that {benefit}.

## Acceptance criteria

- {one thing the player can see or do}

## Out of scope      ← only if something is
```

**Task**

```
{Why, one or two sentences. Skip if the summary says it.}

## Acceptance criteria

- {one checkable outcome}
```

**Bug** (filed as `Úkol` until the type exists)

```
**Where:** {device / web, build}

## Steps

1. …

**Expected:** … · **Actual:** …
```

Use the domain words from `CLAUDE.md` — run, board, dial, medal, fortune, session.
A ticket that says "round" or "session" for a run is wrong in the only language this
project has.

### 2.3 Create

Confirm the draft first — `AskUserQuestion`: "Create" / "Edit" / "Cancel". Never
create without it. Then `createJiraIssue`: `projectKey: "NNN"`, the Czech type name,
`contentFormat: "markdown"`, `parent` if an epic was named. Report the key and the
browse URL, nothing else. The ticket lands in `Úkoly`; creating does not pick it up.

### 2.4 From a work item

If the argument names a folder under `docs/work/`, read its `spec.md` and write the
ticket from the title and the "what" — translated out of the technical and down to
what changes for the player. Criteria come from the spec's acceptance criteria,
rewritten as outcomes a non-developer can check. Then Mode 4 writes the key back.

---

## Mode 3 — Review

### 3.1 Fetch

As Mode 1.1.

### 3.2 What's missing

Empty or stale description, no criteria, scope you cannot draw a line around.

### 3.3 Draft

Read the code the ticket names before rewriting it — a description rewritten off the
summary is a guess. Then redraft to the Mode 2.2 format, under the caps in **Write it
short**. Shortening an overlong ticket is a valid review outcome on its own.

### 3.4 Update

Show current vs proposed. `AskUserQuestion`: "Update" / "Edit" / "Cancel". On
approval, `editJiraIssue`. Report `Updated NNN-12.`

---

## Mode 4 — Hand to the cycle

A ticket and a work item are two halves of one thing: the ticket is the ledger entry,
`docs/work/<date>-<slug>/` is the work. Keep them pointed at each other.

**Ticket → item.** After a pickup, `AskUserQuestion`:

- **`/shape <slug>`** (recommended) — the normal next step. `shape` creates the
  folder; suggest a slug from the summary.
- **Build directly** — a one-line change. Then `check`, `commit`.
- **Done for now.**

**Item → ticket.** Write the key into the item's `spec.md` header, under `Slug:`:

```
Ticket: NNN-12
```

That line is the whole link, and the only one: it is how a cold session gets from a
branch back to the ticket. `PROTOCOL.md` documents the field.

**Onward.** `In Testing` and `Hotovo` are moved by hand — no skill does it today, and
`ship` has never heard of Jira. Offer the move when a pickup's work is visibly past
In Development, and transition only on the user's word.

## Guidelines

- **Confirm every write.** Create, edit, transition — all need the user's word first.
- **No sprint, no priority, no labels.** The board is Kanban and the fields are not
  configured.
- **One ticket, one thing.** Two unrelated changes are two tickets, and saying so is
  cheaper than splitting them later.
