-- The planner books the next session itself when nobody else has.
--
-- Until now a **session** existed only because an admin opened the planner and booked
-- one, so the app went quiet the moment one closed and nobody had thought ahead. This
-- fills that gap and nothing more: when the last session has closed and nothing is live
-- or still to come, a session is booked on its own —
--
--   · opening at **noon Prague, two days after the day the last one closed** — a session
--     closing at noon on Tuesday is followed by one opening at noon on Thursday;
--   · lasting **twenty-four hours**, a literal duration rather than noon-to-noon, so a
--     daylight-saving night gives a 23- or 25-hour gap before it and never a short day;
--   · on a **random challenge**, not the one that just ran when there is another to pick.
--
-- An admin's booking always wins: anything live or upcoming — of any challenge — means
-- something is planned, and this does nothing.
--
-- ─── Where the challenges come from ──────────────────────────────────────────
--
-- The server has never heard of a mode — a challenge is a value in the app's bundle, not
-- a row (see `…_challenge_sessions.sql`). So the pool is **every challenge that has ever
-- been booked**, read off `challenge_sessions` itself, each with the measure its latest
-- booking was stamped with. That is a list nothing has to keep in step with
-- `modes/challenges/catalog.ts`: a new challenge joins the rotation the first time an
-- admin books it by hand, which is also the first time anybody has seen it run. The
-- catalog is append-only, so a challenge in the pool never stops existing under it.
--
-- `created_by` is null on what this books. That is already what the column says of a
-- session whose planner is gone, and it is true here too: nobody planned it.

create or replace function plan_next_challenge_session(p_now timestamptz default now())
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_last_mode  text;
  v_last_close timestamptz;
  v_mode       text;
  v_measure    text;
  v_opens      timestamptz;
  v_id         uuid;
begin
  -- Something live or still to come is a session planned. Half-open, as everywhere: one
  -- closing exactly now has closed.
  if exists (select 1 from challenge_sessions where closes_at > p_now) then
    return null;
  end if;

  select mode_id, closes_at into v_last_mode, v_last_close
    from challenge_sessions
   order by closes_at desc
   limit 1;
  -- Nothing ever booked is nothing to go on: no pool and no day to count from.
  if not found then
    return null;
  end if;

  select pool.mode_id, pool.measure into v_mode, v_measure
    from (
      select distinct on (mode_id) mode_id, measure
        from challenge_sessions
       order by mode_id, opens_at desc
    ) pool
   order by pool.mode_id = v_last_mode, random()
   limit 1;

  v_opens := (((v_last_close at time zone 'Europe/Prague')::date + 2) + time '12:00')
             at time zone 'Europe/Prague';
  -- Only reachable when the last session closed long before this first ran — the day this
  -- lands, or after the job was off. Two days after a close that is a month old is in the
  -- past, so the next noon to come is the honest answer.
  if v_opens <= p_now then
    v_opens := (((p_now at time zone 'Europe/Prague')::date) + time '12:00')
               at time zone 'Europe/Prague';
    if v_opens <= p_now then
      v_opens := (((p_now at time zone 'Europe/Prague')::date + 1) + time '12:00')
                 at time zone 'Europe/Prague';
    end if;
  end if;

  insert into challenge_sessions (mode_id, opens_at, closes_at, measure)
  values (v_mode, v_opens, v_opens + interval '24 hours', v_measure)
  returning id into v_id;
  return v_id;
end;
$$;

-- No client-facing grant, the way `cleanup_finished_rooms` has none: cron runs it as the
-- role that owns the job, and a player able to call it could book a session.
revoke execute on function plan_next_challenge_session(timestamptz) from public;

-- Every five minutes, so a session that closes is followed within five minutes by a card
-- announcing the next one. The check is one indexed lookup when something is planned,
-- which is almost always.
select cron.schedule(
  'plan-next-challenge-session',
  '*/5 * * * *',
  $$ select plan_next_challenge_session(); $$
);
