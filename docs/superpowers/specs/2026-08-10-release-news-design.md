# Release Identity and In-App News — Design

Date: 2026-08-10

## Goal

Two related things, both aimed at the current dev phase rather than a mature
release process:

1. **Identify a build.** Enough to tell which deploy a screenshot or bug report
   came from — a commit sha and a timestamp. No semver, no tags, no changelog.
2. **Tell players what changed.** A curated, good-looking announcement on
   selected releases, plus an archive of everything announced so far.

Explicitly out of scope: semantic versioning, git tags, generated changelogs,
store version automation. Those become worthwhile at store submission; today
they would be ceremony.

## Build identity

`build:web` already computes `EXPO_PUBLIC_BUILD_ID` as `<sha>-<yymmdd.HHMM>`
and nothing reads it. `lib/build-info.ts` parses it into a sha and a date and
formats one line, falling back to `dev` when the variable is absent (which it
always is under `expo start`).

Shown in the advanced options overlay:

```
BUILD   1e3fc8a · 10 Aug 2026, 12:47
```

No tap-to-copy: it would need `expo-clipboard`, and the line is legible in a
screenshot.

## News data

`constants/news.ts` is the only file touched to announce something. Releases are
newest-first; each bundles one or more items, because several things can ship at
once.

```ts
type NewsItem = {
  id: string // stable, never reused — this is what "seen" tracks
  icon: IoniconName
  accent: string // from the mode spectrum
  title: string
  body: string // markdown
}

type Release = {
  date: string // ISO day, e.g. '2026-08-10'
  items: NewsItem[]
}
```

Seen state tracks **item ids**, not dates or versions, in
`nine.seen-news.v1`. That choice matters:

- shipping twice before a player opens the app shows both releases, not just the
  newer one;
- reordering entries or fixing a typo never re-shows something;
- build stamps change on every deploy, so they are useless as a "have you seen
  this" key.

**A first-ever launch marks every item seen and shows nothing.** A new player
should meet the game, not a list of features they never lived without.

## Popup

Appears once the menu is reachable, so it never competes with the splash. One
unseen item per screen as a hero card — accent-tinted icon tile, title in mono
caps, markdown body — with progress dots and a CTA. Dismissing marks every
shown item seen.

## Archive

Inside the advanced options overlay, under the build line. A `FlatList` of
releases, newest first: a dated heading with its items beneath. The array is
bundled with the app, so the list is offline, needs no backend, and renders
lazily as it scrolls.

## Markdown

`marked` parses to tokens; the app renders those tokens with its own components.
The alternative — a ready-made React Native markdown renderer — arrives with its
own typography, and this app's is specific enough (mono, letter-spaced caps,
`text-primary` / `text-dim`) that a renderer would need a large style-override
object to stop looking foreign. Owning ~60 lines of rendering is less work than
fighting one, and `marked` itself has no peer dependencies.

Supported: paragraphs, headings, bullet and ordered lists, bold, italics,
inline code, and links (opened with React Native's `Linking`). Anything else
renders as its plain text rather than throwing, so a stray token can never blank
a card.

## Ship integration

A new step in `.claude/skills/ship/SKILL.md`, after the checks and migration
gate and before the commit message, so the announcement lands in the same commit
as the feature it describes:

1. Ask whether this release deserves an announcement.
2. If yes, read the diff and draft the item — title, icon, accent, markdown body
   — in player-facing language rather than commit-speak.
3. Present it for confirmation or edits.
4. Append it to `constants/news.ts` under today's date, creating the release
   entry if today has none.

## Files

```
constants/storage.ts                  + NEWS_KEY
constants/news.ts                     releases and items — the file you edit
lib/build-info.ts        + test       parse EXPO_PUBLIC_BUILD_ID
lib/news.ts              + test       unseen items, parse stored ids
lib/markdown.ts          + test       marked tokens → a renderable shape
hooks/use-whats-new.ts                hydrate, visibility, dismiss
components/overlays/whats-new-overlay.tsx    the pager
components/overlays/news-card.tsx            one announcement
components/overlays/news-archive.tsx         the dated list
components/markdown-text.tsx                 token renderer
components/overlays/advanced-options-overlay.tsx   + build line and archive
app/(tabs)/index.tsx                  wire the popup
.claude/skills/ship/SKILL.md          the announcement step
```

Pure logic lives in `lib/` with Vitest coverage, matching `tutorial-progress`
and `scoring`. Components stay one-per-file per the code guide.

## Testing

- `lib/build-info.test.ts` — parsing a well-formed stamp, a malformed one, and
  the missing-variable fallback.
- `lib/news.test.ts` — unseen filtering, the first-launch case (no stored value
  at all versus an empty list), corrupt stored payloads.
- `lib/markdown.test.ts` — each supported token type, and that an unsupported
  one degrades to plain text.

## Note on branching

`main` and PR #1 (the tutorial) have diverged, and both add an overlay to
`app/(tabs)/index.tsx`. That is a merge conflict to resolve, not a runtime
clash: the first-launch rule means a new player gets the tutorial and no news,
so the two never appear together.
