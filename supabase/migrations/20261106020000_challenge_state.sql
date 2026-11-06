-- A **challenge state**: `live` or `pending`.
--
-- The catalog is code, so which challenges an admin has held back has to be a row. A
-- pending challenge cannot be planned and players cannot see it; a live one — the usual —
-- is planned and played as before. **No row means live**, which leaves every shipped
-- challenge working on the day this lands and means nothing needs backfilling.
--
-- Not a session's status (`live` / `upcoming` / `expired`, read off the clock): that is
-- when a window is open, this is whether the challenge may be offered at all.

create table challenge_states (
  mode_id    text primary key,
  state      text not null check (state in ('live', 'pending')),
  changed_at timestamptz not null default now(),
  changed_by uuid references profiles (id) on delete set null
);

alter table challenge_states enable row level security;

-- Only an admin reads it. Players are told nothing about what is held back: the reads
-- below simply leave those challenges out.
create policy "admin read" on challenge_states
  for select using (has_feature(auth.uid(), 'admin'));

grant select on public.challenge_states to authenticated;

-- ─── The question everything else asks ───────────────────────────────────────
create or replace function challenge_is_pending(p_mode_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenge_states where mode_id = p_mode_id and state = 'pending'
  );
$$;

grant execute on function public.challenge_is_pending(text) to anon, authenticated;

-- ─── Who may read a session ──────────────────────────────────────────────────
-- Everybody, as before, except a pending challenge's sessions, which only an admin sees.
-- `has_feature` of a null caller (a signed-out read) is false rather than an error.
drop policy "public read" on challenge_sessions;

create policy "public read" on challenge_sessions for select using (
  not challenge_is_pending(mode_id) or has_feature(auth.uid(), 'admin')
);

-- The card on the start screen is a `security definer`, which the policy does not reach, so
-- it leaves a pending challenge out itself. Restated from
-- `…_session_hits_measure.sql` with that one predicate added; a session running now of a
-- challenge made pending is hidden too — pending means off.
drop function if exists open_sessions_with_leaders();

create function open_sessions_with_leaders()
returns table (
  id             uuid,
  mode_id        text,
  opens_at       timestamptz,
  closes_at      timestamptz,
  teaser_minutes int,
  extended_at    timestamptz,
  measure        text,
  leader_name    text,
  leader_score   int,
  leader_time    int,
  leader_hits    int,
  leader_acc     int,
  leader_spd     int
) language sql stable security definer set search_path = public as $$
  select
    s.id, s.mode_id, s.opens_at, s.closes_at,
    coalesce(
      s.teaser_minutes,
      (select int_value from settings where key = 'teaser_minutes'),
      2160
    ),
    s.extended_at,
    s.measure,
    lead_row.nickname::text,
    lead_row.best_score,
    lead_row.time_ms,
    lead_row.hits,
    lead_row.avg_acc,
    lead_row.avg_spd
  from challenge_sessions s
  left join lateral (
    select p.nickname, b.best_score, b.time_ms, b.hits, f.avg_acc, f.avg_spd
    from session_scores b
    join profiles p on p.id = b.user_id
    left join lateral player_factors(b.user_id) f on true
    where b.session_id = s.id and p.nickname is not null
    order by
      case when s.measure = 'time' then b.time_ms is null end asc,
      case when s.measure = 'time' then b.hits end desc,
      case when s.measure = 'time' then b.time_ms end asc nulls last,
      case when s.measure = 'hits' then b.hits end desc,
      case when s.measure = 'time' then null else b.best_score end desc,
      b.updated_at asc
    limit 1
  ) lead_row on true
  where s.closes_at > now()
    and not challenge_is_pending(s.mode_id)
  order by s.opens_at asc;
$$;

grant execute on function public.open_sessions_with_leaders() to anon, authenticated;

-- ─── The writes ──────────────────────────────────────────────────────────────
-- Planning and re-pointing refuse a pending challenge, and the auto-plan's pool leaves it
-- out. Each restated from `…_session_queue.sql` with that one guard added.

create or replace function plan_challenge_session(
  p_mode_id text,
  p_measure text default 'score'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
  v_at     timestamptz;
  v_floor  timestamptz;
  v_id     uuid;
begin
  perform lock_challenge_queue();
  if challenge_is_pending(p_mode_id) then
    raise exception 'plan_challenge_session: that challenge is pending';
  end if;
  select greatest(max(opens_at), now()) + interval '1 day', min(opens_at)
    into v_at, v_floor
    from challenge_sessions where opens_at > now();
  v_at := coalesce(v_at, now() + interval '1 day');
  insert into challenge_sessions (mode_id, opens_at, closes_at, measure, created_by)
  values (p_mode_id, v_at, v_at + interval '24 hours', p_measure, v_caller)
  returning id into v_id;
  perform repack_challenge_queue(now(), coalesce(v_floor, '-infinity'));
  return v_id;
end;
$$;

create or replace function edit_challenge_session(
  p_id      uuid,
  p_mode_id text,
  p_measure text default 'score'
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_was    text;
  v_closes timestamptz;
  v_played int;
begin
  perform require_admin();
  if challenge_is_pending(p_mode_id)
     and (select mode_id from challenge_sessions where id = p_id) is distinct from p_mode_id then
    raise exception 'edit_challenge_session: that challenge is pending';
  end if;
  select mode_id, closes_at into v_was, v_closes from challenge_sessions where id = p_id;
  if not found then
    raise exception 'edit_challenge_session: no such session';
  end if;
  -- A session that has closed is the record of what ran, played or not: re-pointing it
  -- would rewrite the counts beside every challenge and the auto-planner's idea of which
  -- one has gone longest without. The planner draws it read-only; this is the promise.
  if v_closes <= now() and v_was is distinct from p_mode_id then
    raise exception 'edit_challenge_session: that session has closed, so it cannot change challenge';
  end if;
  select count(*) into v_played from session_scores where session_id = p_id;
  if v_played > 0 and v_was is distinct from p_mode_id then
    raise exception
      'edit_challenge_session: % % already scored on it, so it cannot change challenge',
      v_played, case when v_played = 1 then 'player has' else 'players have' end;
  end if;
  update challenge_sessions set mode_id = p_mode_id, measure = p_measure where id = p_id;
end;
$$;

create or replace function plan_next_challenge_session(p_now timestamptz default now())
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mode    text;
  v_measure text;
  v_id      uuid;
begin
  perform lock_challenge_queue();
  perform repack_challenge_queue(p_now);

  -- Something live or still to come is a session planned. Half-open, as everywhere: one
  -- closing exactly now has closed.
  if exists (select 1 from challenge_sessions where closes_at > p_now) then
    return null;
  end if;

  select pool.mode_id, pool.measure into v_mode, v_measure
    from (
      select distinct on (mode_id) mode_id, measure, opens_at
        from challenge_sessions
       order by mode_id, opens_at desc
    ) pool
   where not challenge_is_pending(pool.mode_id)
     and (not exists (
           select 1 from challenge_sessions s join session_scores sc on sc.session_id = s.id
            where s.opens_at > p_now - interval '60 days'
         )
      or exists (
           select 1 from challenge_sessions s join session_scores sc on sc.session_id = s.id
            where s.mode_id = pool.mode_id and s.opens_at > p_now - interval '60 days'
         ))
   order by pool.opens_at, random()
   limit 1;
  -- Nothing ever booked is nothing to go on.
  if not found then
    return null;
  end if;

  -- In at a placeholder and onto its slot by the re-pack, the way `plan_challenge_session`
  -- does it, so the slot rule has one home. Nothing is queued here, so there is no floor.
  insert into challenge_sessions (mode_id, opens_at, closes_at, measure)
  values (v_mode, p_now + interval '1 day', p_now + interval '2 days', v_measure)
  returning id into v_id;
  perform repack_challenge_queue(p_now, '-infinity');
  return v_id;
end;
$$;

-- Both at once, at the end of the queue, as a **pair**: the planner's PLAN SESSION picks two
-- candidates and the queue draws its first two as the vote. One call rather than two
-- `plan_challenge_session`s, so a refusal on the second cannot leave the first booked.
create or replace function plan_challenge_pair(
  p_mode_a    text,
  p_measure_a text,
  p_mode_b    text,
  p_measure_b text
)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
  v_at     timestamptz;
  v_floor  timestamptz;
  v_a      uuid;
  v_b      uuid;
begin
  if p_mode_a = p_mode_b then
    raise exception 'plan_challenge_pair: a pair needs two different challenges';
  end if;
  perform lock_challenge_queue();
  if challenge_is_pending(p_mode_a) or challenge_is_pending(p_mode_b) then
    raise exception 'plan_challenge_pair: that challenge is pending';
  end if;
  select greatest(max(opens_at), now()) + interval '1 day', min(opens_at)
    into v_at, v_floor
    from challenge_sessions where opens_at > now();
  v_at := coalesce(v_at, now() + interval '1 day');
  insert into challenge_sessions (mode_id, opens_at, closes_at, measure, created_by)
  values (p_mode_a, v_at, v_at + interval '24 hours', p_measure_a, v_caller)
  returning id into v_a;
  insert into challenge_sessions (mode_id, opens_at, closes_at, measure, created_by)
  values (
    p_mode_b, v_at + interval '1 day', v_at + interval '2 days', p_measure_b, v_caller
  )
  returning id into v_b;
  perform repack_challenge_queue(now(), coalesce(v_floor, '-infinity'));
  return array[v_a, v_b];
end;
$$;

revoke all on function public.plan_challenge_pair(text, text, text, text) from public, anon;
grant execute on function public.plan_challenge_pair(text, text, text, text) to authenticated;

-- ─── Setting a state ─────────────────────────────────────────────────────────
-- Making a challenge pending takes its **planned** sessions out of the queue (they have
-- opened for nobody, so they have no scores) and re-packs what is left onto the cadence.
-- A session running now is kept, as the record of what is being played, and hidden from
-- players by the read above. Setting `live` deletes nothing and restores nothing. Returns
-- how many planned sessions were removed, for the dialog to have named beforehand.
create or replace function set_challenge_state(p_mode_id text, p_state text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_caller  uuid := require_admin();
  v_removed int := 0;
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
    -- The earliest slot the removal frees, kept before the delete and handed to the re-pack
    -- as its floor — as `cancel_challenge_session` does — so what is behind moves up into it.
    -- Without the floor the re-pack starts at the first survivor's own slot and a removal at
    -- the front of the queue would leave a day empty.
    select min(opens_at) into v_first
      from challenge_sessions where mode_id = p_mode_id and opens_at > now();
    delete from challenge_sessions where mode_id = p_mode_id and opens_at > now();
    get diagnostics v_removed = row_count;
    if v_removed > 0 then
      perform repack_challenge_queue(
        now(),
        least(v_first, (select min(opens_at) from challenge_sessions where opens_at > now()))
      );
      perform settle_next_vote();
    end if;
  end if;
  return v_removed;
end;
$$;

revoke all on function public.set_challenge_state(text, text) from public, anon;
grant execute on function public.set_challenge_state(text, text) to authenticated;

-- ─── Moving a pair ───────────────────────────────────────────────────────────
-- A **pair** is the planner's unit — one item, one set of sort buttons — so the queue moves
-- by pairs: `p_id` names the first session of a pair, and the pair swaps places with the
-- one before it (-1) or after it (1). The queue is read in the order it opens and cut in
-- twos, exactly as the planner draws it, so a session that is not first in its pair is
-- refused. A pair that has nowhere to go does nothing. A single left over at the end of an
-- odd queue is a block of one, and moves like the rest.
create or replace function move_challenge_pair(p_id uuid, p_delta int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ids    uuid[];
  v_opens  timestamptz[];
  v_closes timestamptz[];
  v_n      int;
  v_i      int;
  v_a_hi   int;
  v_lo     int;
  v_hi     int;
  v_order  uuid[];
  k        int;
begin
  perform require_admin();
  perform lock_challenge_queue();
  if p_delta is null or p_delta not in (-1, 1) then
    raise exception 'move_challenge_pair: delta must be -1 or 1';
  end if;
  select array_agg(id order by opens_at, created_at),
         array_agg(opens_at order by opens_at, created_at),
         array_agg(closes_at order by opens_at, created_at)
    into v_ids, v_opens, v_closes
    from challenge_sessions where opens_at > now();
  v_n := coalesce(cardinality(v_ids), 0);
  v_i := array_position(v_ids, p_id);
  if v_i is null then
    raise exception 'that session is no longer in the queue';
  end if;
  if (v_i - 1) % 2 <> 0 then
    raise exception 'move_challenge_pair: that session does not start a pair';
  end if;
  v_a_hi := least(v_i + 1, v_n);
  if p_delta < 0 then
    if v_i = 1 then
      return;
    end if;
    v_lo := v_i - 2;
    v_hi := v_a_hi;
    v_order := v_ids[v_i:v_a_hi] || v_ids[v_i - 2:v_i - 1];
  else
    if v_a_hi >= v_n then
      return;
    end if;
    v_lo := v_i;
    v_hi := least(v_a_hi + 2, v_n);
    v_order := v_ids[v_a_hi + 1:v_hi] || v_ids[v_i:v_a_hi];
  end if;
  for k in 0 .. cardinality(v_order) - 1 loop
    update challenge_sessions
       set opens_at = v_opens[v_lo + k], closes_at = v_closes[v_lo + k]
     where id = v_order[k + 1];
  end loop;
  perform repack_challenge_queue();
end;
$$;

revoke all on function public.move_challenge_pair(uuid, int) from public, anon;
grant execute on function public.move_challenge_pair(uuid, int) to authenticated;

-- ─── The vote's "last challenge" skips a pending one ─────────────────────────
-- `next_vote_options` (…_next_vote_players_only.sql) takes the latest session that has
-- opened as the one a voter must have played. A session of a challenge made pending while
-- it ran is hidden from players, so nobody could have played it and nobody could vote until
-- the next one opened; it is left out of the question, exactly as it is left out of the
-- start screen. Restated in full with that one predicate added.
create or replace function next_vote_options()
returns table (session_id uuid, mode_id text, votes int, mine boolean, can_vote boolean)
language sql stable security definer set search_path = public as $$
  with pair as (
    select id, mode_id, opens_at from challenge_sessions
     where opens_at > now()
     order by opens_at, created_at
     limit 2
  ),
  last_opened as (
    select id from challenge_sessions
     where opens_at <= now() and not challenge_is_pending(mode_id)
     order by opens_at desc, created_at desc
     limit 1
  )
  select p.id, p.mode_id,
         (select count(*)::int from next_votes v where v.session_id = p.id),
         exists (
           select 1 from next_votes v where v.session_id = p.id and v.user_id = auth.uid()
         ),
         exists (
           select 1 from session_scores s
            where s.session_id = (select id from last_opened) and s.user_id = auth.uid()
         )
    from pair p
   where (select count(*) from pair) = 2
   order by p.opens_at;
$$;
