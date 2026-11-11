-- The auto-planner books a session with both candidates on its ballot, as the planner's
-- PLAN SESSION does, instead of one. With a single challenge left to pick it still books
-- that one alone — a ballot of one — rather than booking nothing.

create or replace function plan_next_challenge_session(p_now timestamptz default now())
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_modes    text[];
  v_measures text[];
  v_id       uuid;
begin
  perform lock_challenge_queue();
  perform repack_challenge_queue(p_now);

  -- Something live or still to come is a session planned. Half-open, as everywhere: one
  -- closing exactly now has closed.
  if exists (select 1 from challenge_sessions where closes_at > p_now) then
    return null;
  end if;

  -- The two challenges longest without a session, ties broken at random: the first leads
  -- the ballot, the second is its other candidate.
  select array_agg(picked.mode_id order by picked.rank),
         array_agg(picked.measure order by picked.rank)
    into v_modes, v_measures
    from (
      select pool.mode_id, pool.measure,
             row_number() over (order by pool.opens_at, random()) as rank
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
       limit 2
    ) picked;
  -- Nothing ever booked is nothing to go on.
  if v_modes is null then
    return null;
  end if;

  -- In at a placeholder and onto its slot by the re-pack, the way `plan_challenge_session`
  -- does it, so the slot rule has one home. Nothing is queued here, so there is no floor.
  insert into challenge_sessions
    (mode_id, measure, alt_mode_id, alt_measure, first_mode_id, opens_at, closes_at)
  values (
    v_modes[1], v_measures[1], v_modes[2], v_measures[2], case when v_modes[2] is null then null else v_modes[1] end,
    p_now + interval '1 day', p_now + interval '2 days'
  )
  returning id into v_id;
  perform repack_challenge_queue(p_now, '-infinity');
  return v_id;
end;
$$;
