-- The **vote**: which of the next two queued challenges opens first.
--
-- The two options are the first two sessions of the **queue** — the admin's booking is the
-- shortlist, so there is no new admin screen. A player votes for one of them, from the third
-- step of the rating dialog or from the link on the intro, and sees each option's count once
-- they have.
--
-- ─── The row ─────────────────────────────────────────────────────────────────
--
-- One vote per player, not per pair. A vote names a session; it counts only while that
-- session is one of the queue's first two, so the moment it runs or is moved back it stops
-- counting by itself and nothing has to be cleared. A player whose pick is still in the next
-- pair is shown as having voted, and may change their mind.
--
-- No select policy, like `session_ratings`: the counts go out through `next_vote_options`,
-- the voter's identity never does.

create table next_votes (
  user_id    uuid not null primary key references profiles (id) on delete cascade,
  session_id uuid not null references challenge_sessions (id)   on delete cascade,
  voted_at   timestamptz not null default now()
);

alter table next_votes enable row level security;

-- The queue's first two sessions, in the order they open, with each one's count and whether
-- the caller's vote is on it. Nothing at all unless there are two: one queued session is not
-- a choice.
create or replace function next_vote_options()
returns table (session_id uuid, mode_id text, votes int, mine boolean)
language sql stable security definer set search_path = public as $$
  with pair as (
    select id, mode_id, opens_at from challenge_sessions
     where opens_at > now()
     order by opens_at, created_at
     limit 2
  )
  select p.id, p.mode_id,
         (select count(*)::int from next_votes v where v.session_id = p.id),
         exists (
           select 1 from next_votes v where v.session_id = p.id and v.user_id = auth.uid()
         )
    from pair p
   where (select count(*) from pair) = 2
   order by p.opens_at;
$$;

revoke all on function public.next_vote_options() from public, anon;
grant execute on function public.next_vote_options() to authenticated;

-- Puts the first slot on the option with more votes. A tie goes to the earlier booking, so a
-- tied pair settles one way however the votes got there. Swaps the two rows' spans the way
-- `move_challenge_session` does, and needs no re-pack: both slots are already on the cadence.
--
-- Run on every vote rather than on a clock, so the queue always reads as the votes stand and
-- nothing has to wake before a session opens. An admin's own MOVE still wins until the next
-- vote — the admin acts on purpose, and a vote is a lean.
create or replace function settle_next_vote()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_first  challenge_sessions%rowtype;
  v_second challenge_sessions%rowtype;
  v_a      int;
  v_b      int;
begin
  select * into v_first from challenge_sessions
   where opens_at > now() order by opens_at, created_at limit 1;
  select * into v_second from challenge_sessions
   where opens_at > now() order by opens_at, created_at offset 1 limit 1;
  if v_first.id is null or v_second.id is null then
    return;
  end if;
  select count(*) into v_a from next_votes where session_id = v_first.id;
  select count(*) into v_b from next_votes where session_id = v_second.id;
  if v_b > v_a or (v_b = v_a and v_second.created_at < v_first.created_at) then
    update challenge_sessions set opens_at = v_second.opens_at, closes_at = v_second.closes_at
     where id = v_first.id;
    update challenge_sessions set opens_at = v_first.opens_at, closes_at = v_first.closes_at
     where id = v_second.id;
  end if;
end;
$$;

revoke execute on function settle_next_vote() from public, anon, authenticated;

-- The only way in. Refuses anything that is not one of the two on offer; a second call moves
-- the vote.
create or replace function vote_next(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'vote_next: not signed in';
  end if;
  perform lock_challenge_queue();
  if not exists (select 1 from next_vote_options() o where o.session_id = p_session) then
    raise exception 'vote_next: that session is not up for a vote';
  end if;
  insert into next_votes (user_id, session_id)
  values (auth.uid(), p_session)
  on conflict (user_id)
  do update set session_id = excluded.session_id, voted_at = now();
  perform settle_next_vote();
end;
$$;

revoke all on function public.vote_next(uuid) from public, anon;
grant execute on function public.vote_next(uuid) to authenticated;
