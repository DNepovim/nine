---
name: brainstorm
description: Open up a vague itch into costed directions before anything is decided — `/brainstorm <the itch>`, "what could we do about X", "the intro feels dead", "ideas for the game over screen". Produces a list of candidate directions with appetite and risk, picks none of them, and hands the chosen one to `shape`. First stage of the development cycle.
---

# Brainstorm

This stage exists for an **itch**: something feels wrong, or thin, or missing, and
nobody has said yet what to do about it. If the user already knows what they want
built, this is the wrong skill — hand to **`shape`** and say why.

Read `.claude/skills/sdlc/PROTOCOL.md` first.

## Not this skill's job

- **Deciding.** You produce the menu; the user orders. A brainstorm that arrives at
  one answer did design work in the dark.
- **Designing.** No file lists, no types, no component names. A direction is one or
  two sentences a player could understand.
- **Code.** Not one line, not a sketch, not "I tried it to see".

## Step 1 — Understand the itch before widening it

Ask the repo, not the user, wherever you can. Read the screen or system the itch is
about; find out what is actually there now. Two or three files is usually enough, and
it is the difference between directions that are possible and directions that are
wishes.

Then put the itch in one sentence and say what you found, so the user can correct the
premise before you spend a page on it.

If the itch is about something the player sees, the **`design-guide`** skill is what
the colours, type and motion already allow — ideas that fight it are expensive for a
reason worth knowing in advance.

## Step 2 — Widen

Five to eight directions. Each one:

- **A name** — a few words, in the repo's domain language (`CLAUDE.md`). A direction
  called "a new rating system" is already wrong here; this app has a **fortune**.
- **One or two sentences** on what the player would experience. Not how it works.
- **Appetite** — an evening, a day, a week. A guess, honestly labelled.
- **The risk** — the one thing most likely to make it not worth it. Every direction
  has one; a direction listed without one hasn't been thought about.

Make them genuinely different from each other. Five variations on the same idea is
one direction with four coats of paint. Include at least one that is _smaller_ than
what the user seems to be imagining, and at least one that solves the itch by
**removing** something — both are regularly the right answer and neither gets
proposed on its own.

Say plainly if a direction would break something the app already promises: a mode's
rules, a leaderboard's comparability, the tutorial's one-thing-at-a-time cadence.

## Step 3 — Put them up

Present the directions as a short list in the message — this is a stage the user
reads, not a document they file. Then `AskUserQuestion` with the three or four
strongest as options, each description carrying the appetite and the risk, so the
choice is made against the cost and not against the name.

Offer **"None of these"** as a real route back: it means the itch was misread, and
the answer is another pass at Step 1, not a bigger list.

## Step 4 — Write the item

Only once the user has picked. Create the folder and write the direction down with
the ones it beat — six months from now, the rejected list is the half of this
document worth having:

```bash
mkdir -p docs/work/$(date +%Y-%m-%d)-<slug>
```

`spec.md` gets the header from the protocol — `Stage: brainstorm`, `Track:` not yet
decided, `Next: /shape <slug>` — then:

- **## The itch** — one paragraph. What was wrong, and what you found in the code.
- **## The direction** — the one chosen, in the user's words where they gave them.
- **## Directions considered** — a table: name, appetite, risk, and a word on why it
  lost. Keep the one that won in the table too, marked as chosen.

## Hand off

`Next: /shape <slug>` — fixes the appetite and the boundary, and decides whether this
needs a spec at all.
