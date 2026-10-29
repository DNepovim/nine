-- The session booked on its own opens at the next noon and runs the challenge the
-- rotation has gone longest without.
--
-- Replaces three choices `…_auto_plan_session.sql` made, and nothing else — the trigger
-- (nothing live or to come), the twenty-four hours, the measure each challenge carries
-- and the cron job all stand:
--
--   · it opens at the **next noon Prague** from when the job runs, not two days after
--     the last close. The job only runs once nothing is live, a few minutes past the
--     noon a session closed on, so in practice that is the following day's noon.
--   · it picks the challenge whose **latest session opened longest ago**, rather than a
--     random one other than the last. The one that just ran is, by that measure, the
--     newest, so it still never repeats while there is another in the pool. Ties —
--     which only a hand-booked pair at the same instant can make — break at random.
--   · the pool is every challenge **played in the last sixty days**, not every one ever
--     booked. Picking the oldest would otherwise make a challenge taken out of the
--     catalog the certain next pick, forever: its last session only grows older. A
--     challenge no build has any more is a session nobody scores on, so it drops out
--     on its own. With nothing played in that time, the pool is every one ever booked,
--     as before.

create or replace function plan_next_challenge_session(p_now timestamptz default now())
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mode    text;
  v_measure text;
  v_opens   timestamptz;
  v_id      uuid;
begin
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
   where not exists (
           select 1 from challenge_sessions s join session_scores sc on sc.session_id = s.id
            where s.opens_at > p_now - interval '60 days'
         )
      or exists (
           select 1 from challenge_sessions s join session_scores sc on sc.session_id = s.id
            where s.mode_id = pool.mode_id and s.opens_at > p_now - interval '60 days'
         )
   order by pool.opens_at, random()
   limit 1;
  -- Nothing ever booked is nothing to go on.
  if not found then
    return null;
  end if;

  -- The next noon to come, or this one if the job runs on the instant of it.
  v_opens := (((p_now at time zone 'Europe/Prague')::date) + time '12:00')
             at time zone 'Europe/Prague';
  if v_opens < p_now then
    v_opens := (((p_now at time zone 'Europe/Prague')::date + 1) + time '12:00')
               at time zone 'Europe/Prague';
  end if;

  insert into challenge_sessions (mode_id, opens_at, closes_at, measure)
  values (v_mode, v_opens, v_opens + interval '24 hours', v_measure)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function plan_next_challenge_session(timestamptz) from public;
