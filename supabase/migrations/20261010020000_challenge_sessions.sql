-- When a challenge is on, as rows rather than as a build.
--
-- A **session** is one planned appearance of a challenge: one challenge, one start, one
-- end. Until now a challenge's window was two literal timestamps in
-- `modes/challenges/catalog.ts`, so putting one on the app for a day meant shipping a
-- build on the day it opened and another to take it down. This is where that decision
-- moves to.
--
-- A word of warning, because this schema has three meanings of "session" within reach:
-- a **challenge session** is what this table holds. A Supabase **auth** session is what
-- …_session_bound_writes.sql means. And a **run** — one game from start to game over —
-- is never called a session anywhere, which is the rule `CLAUDE.md` already carries.
-- Nothing here uses the bare word: the table, the columns and the functions all say
-- challenge session.
--
-- This phase only records sessions. Nothing resolves one into the rules a run is played
-- under yet — the app's registry is still compiled, and the only screens that read this
-- are the admin planner and the challenge lab.

create table challenge_sessions (
  id         uuid primary key default gen_random_uuid(),
  -- The challenge, by the id `modes/registry.ts` registers it under
  -- ('challenge/four-keys'). No foreign key, and none is possible: a mode is a value in
  -- the bundle, not a row, so there is nothing to reference. The same arrangement
  -- `features.key` has — a key means something because the client holds a guard for it
  -- — except that features at least have rows and modes do not. The planner draws a
  -- session whose challenge this build has never heard of rather than hiding it, which
  -- is the whole of the integrity check and deliberately so: a row the server holds and
  -- the code does not is worth seeing.
  mode_id    text not null,
  opens_at   timestamptz not null,
  closes_at  timestamptz not null,
  created_at timestamptz not null default now(),
  -- Who booked it. `set null` rather than `cascade`: a session outliving the admin who
  -- planned it is still a session that ran, and deleting a profile must not delete the
  -- record of what was on the app that week.
  created_by uuid references profiles (id) on delete set null,

  -- A session that closes when it opens is not a short session, it is one nobody can
  -- play. A constraint rather than a check in the RPC, because this has to hold against
  -- a later migration and against any caller that is not the planner screen.
  constraint closes_after_opens check (closes_at > opens_at)
);

-- The planner lists every session and the challenge lab lists them per challenge, both
-- newest first; phase two will ask for whatever is open now. One index serves all three.
create index challenge_sessions_opens_at_idx on challenge_sessions (opens_at desc);

-- ─── Who may read ────────────────────────────────────────────────────────────
-- Everybody, the same audience `features` has and for the same reason: when a challenge
-- is on is not a secret — it is the thing the app will shortly be announcing on its own
-- start screen. No insert, update or delete to anybody; every write is an RPC below.
alter table challenge_sessions enable row level security;

create policy "public read" on challenge_sessions for select using (true);

grant select on public.challenge_sessions to anon, authenticated;

-- ─── Two sessions of one challenge may not overlap ───────────────────────────
-- Two sessions of the same challenge running at once is nonsense — phase two would have
-- to pick one of them to put on the start screen, and there is no right answer. Two
-- sessions of *different* challenges overlap freely; that is just two challenges on at
-- once.
--
-- A check in the write path rather than an exclusion constraint: `btree_gist` is an
-- extension to enable for this one guarantee, and the RPCs below are already the only
-- way a row gets in. So it is a soft guarantee, deliberately, and
-- supabase/tests/challenge_sessions.sql is what holds it.
--
-- `p_exclude` is the session being edited, which must not be found overlapping itself.
create or replace function challenge_session_clashes(
  p_mode_id   text,
  p_opens_at  timestamptz,
  p_closes_at timestamptz,
  p_exclude   uuid default null
)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from challenge_sessions s
     where s.mode_id = p_mode_id
       and (p_exclude is null or s.id <> p_exclude)
       and tstzrange(s.opens_at, s.closes_at) && tstzrange(p_opens_at, p_closes_at)
  );
$$;

-- ─── The writes ──────────────────────────────────────────────────────────────
-- Each opens with `require_admin()`, exactly as `set_feature` does. No `guard_admin_floor`
-- on any of them: that guard exists because the feature screen can edit its own access,
-- and nothing here can — planning a challenge cannot shut the door behind you.

create or replace function plan_challenge_session(
  p_mode_id   text,
  p_opens_at  timestamptz,
  p_closes_at timestamptz
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
  v_id     uuid;
begin
  if challenge_session_clashes(p_mode_id, p_opens_at, p_closes_at) then
    raise exception 'that challenge is already booked for part of that time';
  end if;
  insert into challenge_sessions (mode_id, opens_at, closes_at, created_by)
  values (p_mode_id, p_opens_at, p_closes_at, v_caller)
  returning id into v_id;
  return v_id;
end;
$$;

-- The challenge as well as the span, because a session is one editable row rather than a
-- booking that has to be torn up to be corrected.
--
-- The clash check therefore runs against the **new** `p_mode_id`, not the stored one:
-- moving a session onto a challenge that is already booked for that span has to be
-- refused the same way planning it twice would be.
create or replace function edit_challenge_session(
  p_id        uuid,
  p_mode_id   text,
  p_opens_at  timestamptz,
  p_closes_at timestamptz
)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if challenge_session_clashes(p_mode_id, p_opens_at, p_closes_at, p_id) then
    raise exception 'that challenge is already booked for part of that time';
  end if;
  update challenge_sessions
     set mode_id = p_mode_id, opens_at = p_opens_at, closes_at = p_closes_at
   where id = p_id;
end;
$$;

-- Whatever state the session is in, expired included. An expired session is the record
-- of what ran and nothing deletes one on its own — but an admin who booked the wrong
-- thing can take it away, and a guard that stopped them cleaning up a mistake would be
-- preserving the mistake instead. Phase two is where a session with a board under it
-- stops being free to delete, and the cascade that governs that is phase two's.
create or replace function cancel_challenge_session(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  delete from challenge_sessions where id = p_id;
end;
$$;

grant execute on function public.challenge_session_clashes(text, timestamptz, timestamptz, uuid)
  to authenticated;
grant execute on function public.plan_challenge_session(text, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.edit_challenge_session(uuid, text, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.cancel_challenge_session(uuid)
  to authenticated;
