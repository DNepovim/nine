-- A session has **two candidates and one date**.
--
-- Until now a "pair" was two sessions, each with its own date, and the vote was between the
-- queue's first two rows. What the admin means is one session — one opening — with two
-- challenges the players choose between. So `mode_id` stays what every reader already reads:
-- the challenge the session runs, which is the one **leading the vote** until it opens. A
-- new `alt_mode_id` holds the other candidate, and `alt_measure` its measure (the server
-- cannot resolve a challenge, so the runner-up's measure rides along and swaps with it).
-- A session booked with one challenge — the auto-planner's, and every one that has
-- already run — has both null.
--
-- **Voting is in progress** for the first planned session that has two candidates, the one
-- that opens next — and only while no session is running, so it is the gap between one
-- closing and the next opening; the votes stop when it opens. Each vote is one row (player, session,
-- the candidate picked), and after every vote the leader is written into `mode_id`. A tie
-- goes to the candidate the admin booked first, whichever has been ahead since — so a
-- tie never depends on the order the votes happened to arrive in.

-- `first_mode_id` is the candidate booked first, which settles a tie; null with no ballot.
alter table challenge_sessions
  add column alt_mode_id text,
  add column alt_measure text,
  add column first_mode_id text;

alter table challenge_sessions add constraint challenge_sessions_candidates check (
  (alt_mode_id is null) = (alt_measure is null)
  and (alt_mode_id is null) = (first_mode_id is null)
  and alt_mode_id is distinct from mode_id
  and (alt_measure is null or alt_measure in ('score', 'time', 'hits'))
  and (first_mode_id is null or first_mode_id in (mode_id, alt_mode_id))
);

-- ─── The vote ────────────────────────────────────────────────────────────────
-- Dropped and made again: a vote used to be a player's one pick of a *session*, and a pick
-- of a candidate is a different question. Votes cast under the old model are discarded.
drop function if exists vote_next(uuid);
drop function if exists next_vote_options();
drop table next_votes;

create table next_votes (
  user_id    uuid not null references profiles (id) on delete cascade,
  session_id uuid not null references challenge_sessions (id) on delete cascade,
  mode_id    text not null,
  voted_at   timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table next_votes enable row level security;

-- ─── The queue, merged two by two ────────────────────────────────────────────
-- What was planned one challenge a row becomes sessions of two candidates: the first's
-- challenge stays in `mode_id`, the second's moves to `alt_mode_id` and its row is deleted.
-- An odd last session stays a single, and so does one whose challenge is the same as the
-- one before it (a candidate cannot be its own rival). Nothing that has opened is touched.
-- The queue is re-packed once; the first session keeps its slot.
do $$
declare
  v_row  record;
  v_prev record;
  v_have boolean := false;
begin
  perform lock_challenge_queue();
  for v_row in
    select id, mode_id, measure from challenge_sessions
     where opens_at > now() order by opens_at, created_at
  loop
    -- Nested rather than one `or`: `v_prev` is unassigned until the first row, and a
    -- condition's two halves are not guaranteed to be tried in order.
    if not v_have then
      v_prev := v_row;
      v_have := true;
    elsif v_row.mode_id = v_prev.mode_id then
      v_prev := v_row;
    else
      update challenge_sessions
         set alt_mode_id = v_row.mode_id, alt_measure = v_row.measure,
             first_mode_id = v_prev.mode_id
       where id = v_prev.id;
      delete from challenge_sessions where id = v_row.id;
      v_have := false;
    end if;
  end loop;
  perform repack_challenge_queue();
end;
$$;

-- ─── The leader ──────────────────────────────────────────────────────────────
-- The candidate with strictly more votes is written into `mode_id`, with its measure; the
-- other goes to `alt_*`. A tie leaves them as they are.
create or replace function settle_next_vote()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_s    challenge_sessions%rowtype;
  v_a    int;
  v_b    int;
  v_lead text;
begin
  select * into v_s from challenge_sessions
   where opens_at > now() order by opens_at, created_at limit 1;
  if v_s.id is null or v_s.alt_mode_id is null then
    return;
  end if;
  select count(*) into v_a from next_votes where session_id = v_s.id and mode_id = v_s.mode_id;
  select count(*) into v_b from next_votes where session_id = v_s.id and mode_id = v_s.alt_mode_id;
  -- Strictly more votes leads; a tie goes to the candidate booked first.
  v_lead := case
    when v_b > v_a then v_s.alt_mode_id
    when v_a > v_b then v_s.mode_id
    else v_s.first_mode_id
  end;
  if v_lead is distinct from v_s.mode_id then
    update challenge_sessions
       set mode_id = v_s.alt_mode_id, measure = v_s.alt_measure,
           alt_mode_id = v_s.mode_id, alt_measure = v_s.measure
     where id = v_s.id;
  end if;
end;
$$;

revoke execute on function settle_next_vote() from public, anon, authenticated;

-- The next session's two candidates, in a fixed order (by challenge, so the two tiles never
-- trade places when a vote changes the lead), with each one's votes. Nothing unless
-- the first planned session has two. `can_vote`: whether the caller played the last
-- challenge a player can see (a session of a pending challenge is skipped, as it is hidden).
create or replace function next_vote_options()
returns table (session_id uuid, mode_id text, votes int, mine boolean, can_vote boolean)
language sql stable security definer set search_path = public as $$
  with s as (
    -- Nothing is voted on while a session is running: the vote is for the gap between one
    -- session closing and the next opening, so a running session leaves the ballot empty. One
    -- of a pending challenge does not count: players cannot see it, so for them nothing is on.
    select id, mode_id, alt_mode_id from challenge_sessions
     where opens_at > now()
       and not exists (
         select 1 from challenge_sessions r
          where r.opens_at <= now() and r.closes_at > now()
            and not challenge_is_pending(r.mode_id)
       )
     order by opens_at, created_at
     limit 1
  ),
  last_opened as (
    select id from challenge_sessions
     where opens_at <= now() and not challenge_is_pending(mode_id)
     order by opens_at desc, created_at desc
     limit 1
  ),
  cand as (
    select id, mode_id as cand, 0 as ord from s where alt_mode_id is not null
    union all
    select id, alt_mode_id, 1 from s where alt_mode_id is not null
  )
  select c.id, c.cand,
         (select count(*)::int from next_votes v where v.session_id = c.id and v.mode_id = c.cand),
         exists (
           select 1 from next_votes v
            where v.session_id = c.id and v.mode_id = c.cand and v.user_id = auth.uid()
         ),
         exists (
           select 1 from session_scores sc
            where sc.session_id = (select id from last_opened) and sc.user_id = auth.uid()
         )
    from cand c
   order by c.cand;
$$;

revoke all on function public.next_vote_options() from public, anon;
grant execute on function public.next_vote_options() to authenticated;

create or replace function vote_next(p_session uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'vote_next: not signed in';
  end if;
  perform lock_challenge_queue();
  if not exists (
    select 1 from next_vote_options() o where o.session_id = p_session and o.mode_id = p_mode
  ) then
    raise exception 'vote_next: that is not up for a vote';
  end if;
  if not exists (
    select 1 from next_vote_options() o
     where o.session_id = p_session and o.mode_id = p_mode and o.can_vote
  ) then
    raise exception 'vote_next: only players of the last challenge may vote';
  end if;
  insert into next_votes (user_id, session_id, mode_id)
  values (auth.uid(), p_session, p_mode)
  on conflict (user_id, session_id)
  do update set mode_id = excluded.mode_id, voted_at = now();
  perform settle_next_vote();
end;
$$;

revoke all on function public.vote_next(uuid, text) from public, anon;
grant execute on function public.vote_next(uuid, text) to authenticated;

-- ─── Booking and editing ─────────────────────────────────────────────────────
-- One session, two candidates. Dropped first: a changed argument list adds an overload
-- beside the old one rather than replacing it, and an old client would book through it.
drop function if exists plan_challenge_session(text, text);
drop function if exists edit_challenge_session(uuid, text, text);
drop function if exists plan_challenge_pair(text, text, text, text);
drop function if exists move_challenge_pair(uuid, int);
-- Sessions are no longer reordered by hand: the queue is the order they were booked in.
drop function if exists move_challenge_session(uuid, int);

create or replace function plan_challenge_session(
  p_mode_a    text,
  p_measure_a text default 'score',
  p_mode_b    text default null,
  p_measure_b text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
  v_at     timestamptz;
  v_floor  timestamptz;
  v_id     uuid;
begin
  perform lock_challenge_queue();
  if p_mode_b is not null and p_mode_a = p_mode_b then
    raise exception 'plan_challenge_session: the two candidates must be different challenges';
  end if;
  if p_mode_b is not null
     and (p_measure_b is null or p_measure_b not in ('score', 'time', 'hits')) then
    raise exception 'plan_challenge_session: the second candidate needs a measure';
  end if;
  if challenge_is_pending(p_mode_a) or (p_mode_b is not null and challenge_is_pending(p_mode_b)) then
    raise exception 'plan_challenge_session: that challenge is pending';
  end if;
  select greatest(max(opens_at), now()) + interval '1 day', min(opens_at)
    into v_at, v_floor
    from challenge_sessions where opens_at > now();
  v_at := coalesce(v_at, now() + interval '1 day');
  insert into challenge_sessions
    (mode_id, measure, alt_mode_id, alt_measure, first_mode_id, opens_at, closes_at, created_by)
  values (
    p_mode_a, p_measure_a, p_mode_b, case when p_mode_b is null then null else p_measure_b end,
    case when p_mode_b is null then null else p_mode_a end,
    v_at, v_at + interval '24 hours', v_caller
  )
  returning id into v_id;
  perform repack_challenge_queue(now(), coalesce(v_floor, '-infinity'));
  return v_id;
end;
$$;

-- Re-points a **planned** session's candidates. One that has opened is refused: its
-- challenge is the one being played. A candidate that leaves takes its votes with it; the
-- other keeps its own, and the leader is settled again.
create or replace function edit_challenge_session(
  p_id        uuid,
  p_mode_a    text,
  p_measure_a text default 'score',
  p_mode_b    text default null,
  p_measure_b text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_opens timestamptz;
begin
  perform require_admin();
  perform lock_challenge_queue();
  select opens_at into v_opens from challenge_sessions where id = p_id;
  if not found then
    raise exception 'edit_challenge_session: no such session';
  end if;
  if v_opens <= now() then
    raise exception 'edit_challenge_session: that session has opened, so its challenge cannot change';
  end if;
  if p_mode_b is not null and p_mode_a = p_mode_b then
    raise exception 'edit_challenge_session: the two candidates must be different challenges';
  end if;
  if p_mode_b is not null
     and (p_measure_b is null or p_measure_b not in ('score', 'time', 'hits')) then
    raise exception 'edit_challenge_session: the second candidate needs a measure';
  end if;
  if challenge_is_pending(p_mode_a) or (p_mode_b is not null and challenge_is_pending(p_mode_b)) then
    raise exception 'edit_challenge_session: that challenge is pending';
  end if;
  delete from next_votes
   where session_id = p_id and mode_id is distinct from p_mode_a and mode_id is distinct from p_mode_b;
  update challenge_sessions
     set mode_id = p_mode_a, measure = p_measure_a,
         alt_mode_id = p_mode_b,
         alt_measure = case when p_mode_b is null then null else p_measure_b end,
         first_mode_id = case when p_mode_b is null then null else p_mode_a end
   where id = p_id;
  perform settle_next_vote();
end;
$$;

revoke all on function public.plan_challenge_session(text, text, text, text) from public, anon;
grant execute on function public.plan_challenge_session(text, text, text, text) to authenticated;
revoke all on function public.edit_challenge_session(uuid, text, text, text, text) from public, anon;
grant execute on function public.edit_challenge_session(uuid, text, text, text, text) to authenticated;

-- ─── Holding a challenge back ────────────────────────────────────────────────
-- Restated from `…_challenge_state.sql`. A challenge made pending leaves every **planned**
-- session it is a candidate in: one with another candidate keeps its date and that candidate
-- (now alone, and so not voted on); one it was the only candidate of is removed. Returns how
-- many sessions it touched, for the dialog to have named beforehand.
create or replace function set_challenge_state(p_mode_id text, p_state text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_caller  uuid := require_admin();
  v_touched int := 0;
  v_n       int;
  v_first   timestamptz;
begin
  if p_state not in ('live', 'pending') then
    raise exception 'set_challenge_state: unknown state';
  end if;
  perform lock_challenge_queue();
  insert into challenge_states (mode_id, state, changed_by)
  values (p_mode_id, p_state, v_caller)
  on conflict (mode_id)
  do update set state = excluded.state, changed_at = now(), changed_by = excluded.changed_by;
  if p_state = 'pending' then
    -- The earliest slot a removal frees, kept before it, so what is behind moves up into it.
    select min(opens_at) into v_first
      from challenge_sessions
     where mode_id = p_mode_id and alt_mode_id is null and opens_at > now();
    delete from next_votes
     where mode_id = p_mode_id
       and session_id in (select id from challenge_sessions where opens_at > now());
    update challenge_sessions
       set mode_id = alt_mode_id, measure = alt_measure, alt_mode_id = null, alt_measure = null,
           first_mode_id = null
     where opens_at > now() and mode_id = p_mode_id and alt_mode_id is not null;
    get diagnostics v_n = row_count;
    v_touched := v_touched + v_n;
    update challenge_sessions set alt_mode_id = null, alt_measure = null, first_mode_id = null
     where opens_at > now() and alt_mode_id = p_mode_id;
    get diagnostics v_n = row_count;
    v_touched := v_touched + v_n;
    delete from challenge_sessions
     where opens_at > now() and mode_id = p_mode_id and alt_mode_id is null;
    get diagnostics v_n = row_count;
    v_touched := v_touched + v_n;
    if v_n > 0 then
      perform repack_challenge_queue(
        now(),
        least(v_first, (select min(opens_at) from challenge_sessions where opens_at > now()))
      );
    end if;
    perform settle_next_vote();
  end if;
  return v_touched;
end;
$$;

-- ─── What the admin reads ────────────────────────────────────────────────────
-- Who voted, and for which candidate. Admin only: a vote is a player's, and the players
-- themselves are never shown each other's.
create or replace function session_voters(p_session uuid)
returns table (nickname text, mode_id text, voted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return query
    select p.nickname::text, v.mode_id, v.voted_at
      from next_votes v join profiles p on p.id = v.user_id
     where v.session_id = p_session
     order by v.voted_at;
end;
$$;

-- How many runs each player made on a session. Admin only: receipts are not public.
create or replace function session_run_counts(p_session uuid)
returns table (user_id uuid, nickname text, runs bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return query
    select r.user_id, p.nickname::text, count(*)
      from run_receipts r join profiles p on p.id = r.user_id
     where r.session_id = p_session
     group by r.user_id, p.nickname
     order by count(*) desc, p.nickname;
end;
$$;

revoke all on function public.session_voters(uuid) from public, anon;
grant execute on function public.session_voters(uuid) to authenticated;
revoke all on function public.session_run_counts(uuid) from public, anon;
grant execute on function public.session_run_counts(uuid) to authenticated;
