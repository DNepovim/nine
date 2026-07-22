# NINE — Leaderboard Backend (Phase 2 Design)

**Date:** 2026-07-22
**Status:** Approved design, ready for implementation planning
**Depends on:** Phase 1 (scoring model) — fully shipped

## Context

Phase 1 delivered the full scoring model (hits, composite score, accuracy/speed blend, streak
multipliers) and three game modes (Trainee / Accuracy / Speed) across three difficulties (Easy /
Hard / Extreme). Scores are persisted device-locally in `nine.stats.v3` (AsyncStorage) and
displayed in a `HighScores` component that currently renders mock data.

Phase 2 wires a real backend: anonymous identity, global leaderboards per mode × difficulty, and
offline-first score submission. The infrastructure must also accommodate two future features
without requiring a destructive migration:

- **Multiplayer**: real-time head-to-head or room-based matches.
- **In-app "dethroned" notifications**: when another player beats the user's #1 position, show
  an in-app banner via a live Supabase Realtime (WebSocket) connection.

Both features are **out of scope for Phase 2** but the schema (uuid PKs, profiles table,
Realtime included in `@supabase/supabase-js`) is designed so they can be added without migration.

---

## Technology

**Backend:** [Supabase](https://supabase.com) — hosted Postgres + Auth + Realtime + Edge Functions.
One project for all three platforms (web PWA, iOS, Android).

**Client SDK:** `@supabase/supabase-js` — isomorphic; the same code runs on React Native and web.
Realtime (WebSocket) and the REST/PostgREST client are both in this single package.

**Session storage:** AsyncStorage (already installed). Pass it as the custom `storage` adapter
when calling `createClient`.

**New packages to add:**

- `@supabase/supabase-js` — the only new runtime dependency for Phase 2.
- `react-native-url-polyfill` — Supabase's URL usage requires this on React Native New
  Architecture (enabled in this project). Import `react-native-url-polyfill/auto` at the very
  top of `app/_layout.tsx` before any other import.

**Config (env vars):**

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Anon key is public by design; RLS protects all data. Add both to `.env.example` and as EAS
secrets so CI picks them up.

---

## Data Model

Leaderboards cover 6 boards: modes `accuracy` and `speed` × difficulties `easy`, `hard`,
`extreme`. Trainee is excluded (practice mode, no ranking).

### Table: `profiles`

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    citext unique,   -- null until the player sets one
  created_at  timestamptz not null default now()
);
```

Auto-create a profile row when Supabase creates a new auth user:

```sql
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### Table: `scores` (all-time bests)

One row per `(user_id, mode, difficulty)`. Only ever updated when the new score is higher.

```sql
create table scores (
  user_id     uuid not null references profiles(id) on delete cascade,
  mode        text not null check (mode in ('accuracy', 'speed')),
  difficulty  text not null check (difficulty in ('easy', 'hard', 'extreme')),
  best_score  int  not null default 0,
  hits        int  not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, mode, difficulty)
);
```

### Table: `daily_scores` (time-windowed boards)

Supports the TODAY and THIS WEEK leaderboard tabs. Stores each player's best score per calendar
day (UTC) per board. Multiple games on the same day keep only the highest score.

```sql
create table daily_scores (
  user_id     uuid not null references profiles(id) on delete cascade,
  mode        text not null check (mode in ('accuracy', 'speed')),
  difficulty  text not null check (difficulty in ('easy', 'hard', 'extreme')),
  day         date not null default current_date,
  best_score  int  not null default 0,
  hits        int  not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, mode, difficulty, day)
);
```

---

## SQL Functions

### `leaderboard(p_mode, p_difficulty, p_limit, p_since)`

Single function covers all three tabs (TODAY / THIS WEEK / FOREVER) and is future-ready for a
friends-filtered board (`p_user_ids uuid[] default null` can be added as a fourth parameter
without breaking existing callers).

```sql
create function leaderboard(
  p_mode       text,
  p_difficulty text,
  p_limit      int  default 5,
  p_since      date default null  -- null = forever; a date = daily_scores since that date
) returns table (
  rank        bigint,
  user_id     uuid,
  nickname    text,
  best_score  int,
  hits        int
) language sql stable security definer as $$
  select
    rank() over (order by s.best_score desc, s.updated_at asc)::bigint,
    s.user_id,
    p.nickname,
    s.best_score,
    s.hits
  from (
    -- all-time: query scores directly
    select user_id, best_score, hits, updated_at from scores
    where mode = p_mode and difficulty = p_difficulty and p_since is null
    union all
    -- time-windowed: aggregate daily_scores in the window
    select user_id,
           max(best_score) as best_score,
           (array_agg(hits order by best_score desc))[1] as hits,
           max(updated_at) as updated_at
    from daily_scores
    where mode = p_mode and difficulty = p_difficulty
      and p_since is not null and day >= p_since
    group by user_id
  ) s
  join profiles p on p.id = s.user_id
  where p.nickname is not null
  order by s.best_score desc, s.updated_at asc
  limit p_limit;
$$;
```

Client calls:

- **FOREVER tab**: `leaderboard(mode, difficulty, 5, null)`
- **THIS WEEK tab**: `leaderboard(mode, difficulty, 5, current_date - 6)`
- **TODAY tab**: `leaderboard(mode, difficulty, 5, current_date)`

Ties broken by `updated_at asc` — the player who reached the score first ranks higher.

### `my_rank(p_user_id, p_mode, p_difficulty, p_since)`

Returns the user's rank and the total ranked player count (for "you are #42 of 318" display):

```sql
create function my_rank(
  p_user_id    uuid,
  p_mode       text,
  p_difficulty text,
  p_since      date default null
) returns table (rank bigint, total bigint, best_score int, hits int)
language sql stable security definer as $$
  with board as (
    select user_id, max(best_score) as best_score
    from (
      select user_id, best_score from scores
        where mode = p_mode and difficulty = p_difficulty and p_since is null
      union all
      select user_id, best_score from daily_scores
        where mode = p_mode and difficulty = p_difficulty
          and p_since is not null and day >= p_since
    ) raw
    join profiles p on p.id = raw.user_id
    where p.nickname is not null
    group by user_id
  ),
  mine as (select best_score from board where user_id = p_user_id)
  select
    (select count(*) + 1 from board where best_score > (select best_score from mine))::bigint,
    (select count(*) from board)::bigint,
    coalesce((select best_score from mine), 0)::int,
    coalesce((select hits from scores
              where user_id = p_user_id and mode = p_mode and difficulty = p_difficulty), 0)::int
$$;
```

---

## Row Level Security

```sql
alter table profiles     enable row level security;
alter table scores       enable row level security;
alter table daily_scores enable row level security;

create policy "public read" on profiles     for select using (true);
create policy "own all"     on profiles     for all    using (auth.uid() = id);

create policy "public read" on scores       for select using (true);
create policy "own all"     on scores       for all    using (auth.uid() = user_id);

create policy "public read" on daily_scores for select using (true);
create policy "own all"     on daily_scores for all    using (auth.uid() = user_id);
```

`leaderboard()` and `my_rank()` use `security definer` to aggregate across all rows while
exposing only public fields (nickname, score, hits).

---

## Identity

**Anonymous-first.** On first app launch:

```ts
const { data, error } = await supabase.auth.signInAnonymously()
```

Supabase mints a stable `uuid` user + JWT, persisted in AsyncStorage by the client. If the call
fails (offline), the game proceeds in local-only mode and retries on next launch.

Identity linking (Apple / Google → `supabase.auth.linkIdentity()`) is out of scope for Phase 2
but the schema supports it without changes.

---

## Nickname Flow

- Prompt on first leaderboard open _or_ after the first game-over in a non-trainee mode, if
  `profiles.nickname` is null.
- Validation: 3–16 characters, `[A-Za-z0-9_]`, server-unique, light client-side profanity check.
- Stored via `supabase.from('profiles').upsert({ id: userId, nickname })`. A unique-constraint
  violation means "already taken" — show an inline error and let the player retry.
- No nickname → leaderboard is view-only; the user's score row is not published.
- Editable in Settings (same validation path).

---

## Score Submission (offline-first)

After every game-over in a non-trainee mode, if `score > local best` (per `nine.stats.v3`):

1. **Online + has nickname** → upsert both tables:

   ```ts
   await supabase
     .from('scores')
     .upsert(
       { user_id, mode, difficulty, best_score: score, hits, updated_at: now },
       { onConflict: 'user_id,mode,difficulty' },
     )
   await supabase.from('daily_scores').upsert(
     {
       user_id,
       mode,
       difficulty,
       day: todayUTC,
       best_score: score,
       hits,
       updated_at: now,
     },
     { onConflict: 'user_id,mode,difficulty,day' },
   )
   ```

   Server-side guard — prevent lowering a stored score via a concurrent or replayed request:

   ```sql
   create rule no_score_downgrade as on update to scores
     where (new.best_score < old.best_score) do instead nothing;

   create rule no_daily_score_downgrade as on update to daily_scores
     where (new.best_score < old.best_score) do instead nothing;
   ```

2. **Offline or unauthenticated or no nickname** → append
   `{ mode, difficulty, score, hits, day }` to `nine.pending-scores.v1` (AsyncStorage queue).

3. **On next launch:** flush the queue — deduplicate by keeping the max score per
   `(mode, difficulty, day)`, then submit in order. Failures stay in queue and retry next launch.

4. All submission failures are silent — never block or crash gameplay.

---

## Leaderboard UI (HighScores updates)

`components/overlays/high-scores.tsx` currently renders mock data. Replace with live queries
via `hooks/use-leaderboard.ts`:

```ts
type LeaderboardData = {
  top5: ScoreEntry[]
  userRank: number | null // null if user has no score on this board yet
  userTotal: number
  userScore: number
  userHits: number
  loading: boolean
  error: string | null
}
```

- Hook fetches on mount and when `activeTab` or `(gameMode, difficulty)` changes.
- Cache results per tab for the session — don't re-fetch when switching back to a tab already loaded.
- Skeleton rows while loading (dim placeholders matching row height).
- On error: show the last cached result + a subtle "couldn't refresh" indicator.

---

## Future: In-App Dethroned Notification (out of scope for Phase 2)

When live boards ship, a Supabase Realtime Postgres Changes subscription on the `scores` table
(WebSocket, included in `@supabase/supabase-js`) will drive an in-app banner when the user is
knocked off their #1 spot. Realtime channel naming convention:

- **Leaderboard changes**: `scores:{mode}:{difficulty}`
- **Multiplayer rooms** (future): `game:{room_id}` — Broadcast for moves, Presence for connection state
- **User-targeted events** (future): `user:{user_id}` — dethroned, friend-beat

No implementation needed in Phase 2. The Realtime client is available the moment
`@supabase/supabase-js` is installed.

---

## Client File Structure

| Path                               | Purpose                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `lib/supabase.ts`                  | Supabase singleton; `createClient` with AsyncStorage session storage      |
| `lib/leaderboard.ts`               | Typed wrappers: `fetchTop5(mode, difficulty, since?)`, `fetchMyRank(...)` |
| `lib/score-submission.ts`          | Offline-first upsert + AsyncStorage queue flush                           |
| `hooks/use-supabase-auth.ts`       | Anonymous sign-in on mount; exposes `userId`, `isReady`                   |
| `hooks/use-leaderboard.ts`         | React hook: top5 + my-rank per tab, per-session cache, loading/error      |
| `supabase/migrations/001_init.sql` | All DDL: tables, RLS, functions, trigger, guard rules                     |
| `constants/storage.ts`             | Add `PENDING_SCORES_KEY = 'nine.pending-scores.v1'`                       |

`lib/supabase.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // required for React Native
    },
  },
)
```

`react-native-url-polyfill/auto` must be the very first import in `app/_layout.tsx`.

---

## Multiplayer Readiness

Schema decisions made now that keep the multiplayer path open without migration:

- All PKs are `uuid` (server-generated) — safe FKs for future `rooms` / `room_players` tables.
- `profiles.id = auth.users.id` — single identity, joinable from any future table.
- `scores (user_id, mode, difficulty)` PK — joinable to match result rows.
- Realtime channel naming convention documented above.

Multiplayer schema (`rooms`, `room_players`) and authoritative game server logic are deferred to
a dedicated spec.

---

## Anti-cheat (minimal)

- Authenticated writes + RLS ensure a player can only write their own rows.
- Server-side `no_score_downgrade` rules prevent lowering a score via replay or race condition.
- Client score is trusted. Accepted risk for v1; revisit when a multiplayer server is introduced.

---

## Sequencing

1. **Supabase project setup** — create project, run `001_init.sql`, set env vars in EAS secrets.
2. **`lib/supabase.ts` + URL polyfill** — client singleton working; auth smoke-tested on device.
3. **`hooks/use-supabase-auth.ts`** — anonymous sign-in on launch; `profiles` row auto-created.
4. **`lib/score-submission.ts`** — offline-first upsert + queue; smoke-tested with a real game.
5. **`lib/leaderboard.ts` + `hooks/use-leaderboard.ts`** — replace mock data in `HighScores`.
6. **Nickname flow** — prompt UI + validation (inline error for taken names).

---

## Verification

- **Auth persistence**: kill + reopen the app → `supabase.auth.getUser()` returns the same UUID;
  a `profiles` row exists in the Supabase dashboard.
- **RLS guard**: attempt to upsert with another user's UUID → Postgres error `42501`.
- **Score submission**: play a non-trainee game with a new high score → row appears in both
  `scores` and `daily_scores` in the Supabase SQL editor.
- **Offline queue**: airplane mode → play a game → enable WiFi → relaunch → queued row submitted.
- **Leaderboard rankings**: insert 6 test scores; `leaderboard()` returns correct order; ties
  broken by `updated_at asc`.
- **Time-window tabs**: rows with different `day` values appear only in the correct tab
  (TODAY / THIS WEEK / FOREVER).
- **Score downgrade guard**: submit a lower score after a high score → stored value unchanged.
- **Nickname uniqueness**: two sessions attempt the same nickname → second receives "already taken".

---

## Out of Scope

Friends leaderboards, identity linking (Apple / Google), multiplayer rooms, in-app dethroned
notifications, account deletion, GDPR export.
