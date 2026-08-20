-- Player feedback, stored in a table we own rather than sent as an analytics event.
--
-- Feedback shipped as the PostHog `feedback_submitted` event (`20260817` era, see
-- docs/analytics.md), and that turned out to be the wrong place for it twice over. A
-- `posthog.capture` call cannot be awaited and cannot fail out loud, so the dialog said
-- THANK YOU whether or not anything left the device — and analytics hosts are on every
-- ad-blocker and DNS filter list there is, so the players most likely to have something
-- to report are the ones whose message silently never arrives. A row in this table can be
-- awaited, can fail, and is still here next month when the analytics retention window has
-- rolled over.
--
-- Nobody reads this from the client. There is no select policy and no select grant, so a
-- player cannot list anyone's feedback including their own; it is read in the dashboard
-- and the SQL editor, which run as a role that bypasses RLS.

create table feedback (
  id         uuid primary key default gen_random_uuid(),
  -- Stamped by the database rather than sent by the client. The value RLS checks against
  -- and the value in the row are then the same expression, so they cannot disagree —
  -- there is no request shape that files a message under someone else's id.
  --
  -- Nullable for the delete: a player removing their account should not also retract
  -- what they told us, so the row outlives the profile with its author cleared.
  user_id    uuid references profiles (id) on delete set null default auth.uid(),
  message    text not null check (length(btrim(message)) between 1 and 800),
  -- What the player was looking at when they wrote it. All three modes, unlike `scores`
  -- and `daily_scores` — trainee is unscored, but a trainee has as much to report as
  -- anyone, and rather more reason to.
  mode       text not null check (mode in ('trainee', 'accuracy', 'speed')),
  difficulty text not null check (difficulty in ('easy', 'hard', 'extreme')),
  score      int not null default 0,
  -- The build the message came from, so a report can be pinned to a release.
  build      text not null,
  created_at timestamptz not null default now()
);

-- Newest first is the only way this table is ever read.
create index feedback_created_at_idx on feedback (created_at desc);

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- Insert only, and only for a signed-in player. `anon` gets nothing: every player is
-- signed in anonymously at startup (hooks/use-supabase-auth.ts), so requiring a session
-- costs a real player nothing while keeping the table off the unauthenticated surface.

grant insert on public.feedback to authenticated;

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table feedback enable row level security;

-- No select policy on purpose — see the note at the top of this file.
create policy "own insert" on feedback for insert with check (auth.uid() = user_id);
