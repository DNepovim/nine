-- Sessions are a **queue**, and the server times them.
--
-- Until now an admin booked a session by typing its start and its end, and the cadence
-- the app actually runs on — open at noon, run a day, rest a day, open at the next noon —
-- lived in their head. One mistyped day was a gap or a clash, and moving one session
-- meant retyping every one after it. So the planner stops asking for dates. An admin adds
-- a challenge to the end of the queue and moves it up or down; where each one lands is
-- worked out here.
--
-- ─── Times are still stored ──────────────────────────────────────────────────
--
-- The queue is not a table and there is no position column: the order **is** `opens_at`
-- among the rows that have not opened yet. Every write re-packs those rows onto the
-- cadence, so `opens_at` and `closes_at` stay concrete instants — which is what the
-- start screen's card, the teaser, the summary and every index already read. Deriving the
-- times on read instead would have touched every one of those readers to save a column
-- of arithmetic nobody sees.
--
-- What the re-pack never touches is a row that has opened. A live session's start is a
-- fact players have acted on, and a past one is history.
--
-- ─── The slot ────────────────────────────────────────────────────────────────
--
-- A **slot** is the noon (Prague) a queued session opens on. The first is the first noon
-- at least **23 hours** after the live or last session's end; each one after it is two
-- calendar days on, so a session runs noon to noon and the day after it is quiet.
--
-- Twenty-three rather than twenty-four for the one reason it could be wrong: a session
-- runs twenty-four *literal* hours (as `…_auto_plan_session.sql` set out), so across a
-- daylight-saving night it closes at 11:00 or 13:00 by the wall. Twenty-four hours of rest
-- after a 13:00 close is 13:00 the next day, which would skip that noon and lose a day
-- twice a year. The hour of tolerance absorbs exactly that, and nothing larger: an
-- extension of more than an hour still pushes the queue to the noon after.
--
-- The **end** is `greatest(closes_at, opens_at + 24h)`, not `closes_at`, so a session that
-- ran short still rests the day its full length would have. Extending moves it forward,
-- and that is meant to push.
--
-- ─── The queue only moves forward on its own ─────────────────────────────────
--
-- The anchor can move **back**: closing early after an extension, or deleting a session
-- that opened and nobody played. Re-timing the queue from it then would pull every
-- teaser players have already seen a day or more earlier. So the re-pack never lays the
-- first slot before the queue's current first row. The one write that is *meant* to pull
-- is removing a queued session — the ones behind it close the gap — and it says so by
-- handing its own slot in as the floor.

create or replace function prague_noon_at_or_after(p_at timestamptz)
returns timestamptz language plpgsql immutable set search_path = public as $$
declare
  v_noon timestamptz :=
    (((p_at at time zone 'Europe/Prague')::date) + time '12:00') at time zone 'Europe/Prague';
begin
  if v_noon >= p_at then
    return v_noon;
  end if;
  return (((p_at at time zone 'Europe/Prague')::date + 1) + time '12:00')
         at time zone 'Europe/Prague';
end;
$$;

-- The first slot. `p_after` is the end of the live or last session, null with none ever
-- opened. An end long past is no reason to open in the past, so the answer falls forward
-- to the next noon to come — the same fallback `…_auto_plan_session.sql` had.
create or replace function challenge_queue_slot(p_after timestamptz, p_now timestamptz)
returns timestamptz language plpgsql immutable set search_path = public as $$
declare
  v_slot timestamptz;
begin
  if p_after is not null then
    v_slot := prague_noon_at_or_after(p_after + interval '23 hours');
    if v_slot >= p_now then
      return v_slot;
    end if;
  end if;
  return prague_noon_at_or_after(p_now);
end;
$$;

-- Lays every queued row onto the cadence, in the order the queue already has. Idempotent,
-- so calling it after a write that changed nothing is harmless — which is what lets every
-- write call it rather than each working out whether it has to.
--
-- Slot *k* is the first slot's **Prague date** plus 2k days at noon, rather than the first
-- slot plus 48k hours: two noons across a daylight-saving night are 47 or 49 hours apart,
-- and noon is what was asked for.
--
-- `p_floor` is the earliest the first slot may be; null is "where the queue already
-- starts", and `-infinity` is no floor at all. Two writes pass one: `cancel` hands on the
-- slot it frees, and `plan` says where the queue started *before* its own placeholder row
-- went in — read after, that placeholder would be the floor, and a session planned into
-- an empty queue would open a day late.
create or replace function repack_challenge_queue(
  p_now   timestamptz default now(),
  p_floor timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_slot  timestamptz;
  v_floor timestamptz;
  v_first date;
  v_row   record;
  v_k     int := 0;
  v_opens timestamptz;
begin
  v_slot := challenge_queue_slot(
    (select max(greatest(closes_at, opens_at + interval '24 hours'))
       from challenge_sessions where opens_at <= p_now),
    p_now
  );
  v_floor := coalesce(
    p_floor,
    (select min(opens_at) from challenge_sessions where opens_at > p_now)
  );
  if v_floor is not null and v_floor <> '-infinity'::timestamptz then
    v_slot := greatest(v_slot, prague_noon_at_or_after(v_floor));
  end if;
  v_first := (v_slot at time zone 'Europe/Prague')::date;
  for v_row in
    select id from challenge_sessions where opens_at > p_now order by opens_at, created_at
  loop
    v_opens := ((v_first + 2 * v_k) + time '12:00') at time zone 'Europe/Prague';
    update challenge_sessions
       set opens_at = v_opens, closes_at = v_opens + interval '24 hours'
     where id = v_row.id
       and (opens_at, closes_at) is distinct from (v_opens, v_opens + interval '24 hours');
    v_k := v_k + 1;
  end loop;
end;
$$;

-- From `anon` and `authenticated` by name as well as from `public`, the way
-- `…_admin_stats_people.sql` does: Supabase's default privileges can grant a new function
-- to those two directly, and a re-pack called with an early `p_now` would re-time every
-- session ever booked.
revoke execute on function repack_challenge_queue(timestamptz, timestamptz)
  from public, anon, authenticated;

-- One queue write at a time. Two SAVEs at once would each insert behind a queue that does
-- not yet hold the other's row, and each re-pack would lay its own onto the same slot; a
-- move interleaved with a plan could swap against a row that is mid-insert. A transaction
-- advisory lock, taken first by every write that re-packs, makes them queue up instead —
-- released on commit, so a write that raises holds nothing.
create or replace function lock_challenge_queue()
returns void language sql set search_path = public as $$
  select pg_advisory_xact_lock(hashtext('challenge_queue'));
$$;

revoke execute on function lock_challenge_queue() from public, anon, authenticated;

-- ─── The writes ──────────────────────────────────────────────────────────────
--
-- Planning and editing lose their span, and both are **dropped** first for the reason
-- `…_session_controls.sql` gives: a `create or replace` with fewer parameters adds an
-- overload beside the old arity rather than replacing it, and an old client would go on
-- booking spans through it. An admin on an old build gets an error from SAVE instead,
-- which is the honest answer.
--
-- The clash check leaves both. A single queue laid out a slot apart cannot overlap itself,
-- and the same challenge twice in a queue is two airings two days apart, which is fine.
-- `challenge_session_clashes` stays defined for its tests and anything that reads it.
drop function if exists plan_challenge_session(text, timestamptz, timestamptz, int, text);
drop function if exists edit_challenge_session(uuid, text, timestamptz, timestamptz, int, text);

-- To the end of the queue. The row goes in at a placeholder instant that sorts after
-- every queued row — a day past the last of them, or past now — and the re-pack puts it
-- on its slot. Working the slot out here would be a second copy of the re-pack's walk.
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

-- Re-points a booking at another challenge, and nothing else: there is no span to edit any
-- more, and a session that has closed is refused like a played one. The played guard keeps its message verbatim — whoever matches on it goes on
-- matching — and `teaser_minutes` and `extended_at` are left alone, since this no longer
-- touches the end they are about.
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

-- One place up (-1) or down (+1). The two rows swap times, which swaps their places in a
-- queue whose order is its times, and the re-pack after is a no-op unless the queue was
-- off the cadence to begin with. At either end there is no neighbour and nothing moves.
--
-- A row that has opened is refused rather than moved: an admin with the list up while a
-- session's noon passes is holding a row that is now live, and re-timing it would move a
-- window players are already in.
create or replace function move_challenge_session(p_id uuid, p_delta int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_opens  timestamptz;
  v_closes timestamptz;
  v_other  challenge_sessions%rowtype;
begin
  perform require_admin();
  perform lock_challenge_queue();
  if p_delta is null or p_delta not in (-1, 1) then
    raise exception 'move_challenge_session: delta must be -1 or 1';
  end if;
  select opens_at, closes_at into v_opens, v_closes from challenge_sessions where id = p_id;
  if not found then
    raise exception 'move_challenge_session: no such session';
  end if;
  if v_opens <= now() then
    raise exception 'that session is no longer in the queue';
  end if;
  if p_delta < 0 then
    select * into v_other from challenge_sessions
     where opens_at > now() and opens_at < v_opens
     order by opens_at desc limit 1;
  else
    select * into v_other from challenge_sessions
     where opens_at > v_opens
     order by opens_at asc limit 1;
  end if;
  if not found then
    return;
  end if;
  update challenge_sessions set opens_at = v_other.opens_at, closes_at = v_other.closes_at
   where id = p_id;
  update challenge_sessions set opens_at = v_opens, closes_at = v_closes
   where id = v_other.id;
  perform repack_challenge_queue();
end;
$$;

-- ─── The doors that already existed, now closing the gap behind them ─────────
--
-- Each is the shipped body with the lock at the top and the re-pack at the foot.
-- Cancelling a queued row closes the gap it leaves; extending past the first slot's rest
-- pushes the queue; closing early re-packs too, and by the floor above that never moves
-- anything earlier. Extend's refusal of a row not yet open no longer says "change its end
-- instead" — no end can be changed by hand any more.

create or replace function cancel_challenge_session(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_opens  timestamptz;
  v_closes timestamptz;
  v_played int;
begin
  perform require_admin();
  perform lock_challenge_queue();
  select opens_at, closes_at into v_opens, v_closes
    from challenge_sessions where id = p_id;
  if not found then
    raise exception 'cancel_challenge_session: no such session';
  end if;
  -- Verbatim from 20261012000000_session_scores.sql, and first, so that every refusal
  -- that already existed is unchanged in both its condition and its wording.
  select count(*) into v_played from session_scores where session_id = p_id;
  if v_played > 0 then
    raise exception 'cancel_challenge_session: % % already scored on it',
      v_played, case when v_played = 1 then 'player has' else 'players have' end;
  end if;
  if now() >= v_opens and now() < v_closes then
    raise exception 'that session is live — close it early rather than deleting it';
  end if;
  delete from challenge_sessions where id = p_id;
  -- A queued row's slot is handed on to the one behind it; a row that had opened leaves
  -- no slot in the queue, and the queue stays where it is.
  perform repack_challenge_queue(
    now(),
    case
      when v_opens > now() then
        least(v_opens, (select min(opens_at) from challenge_sessions where opens_at > now()))
    end
  );
end;
$$;

create or replace function close_challenge_session_early(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_opens  timestamptz;
  v_closes timestamptz;
begin
  perform require_admin();
  perform lock_challenge_queue();
  select opens_at, closes_at into v_opens, v_closes
    from challenge_sessions where id = p_id;
  if not found then
    raise exception 'close_challenge_session_early: no such session';
  end if;
  if now() < v_opens then
    raise exception 'that session has not opened yet — cancel it instead';
  end if;
  if now() >= v_closes then
    raise exception 'that session has already closed';
  end if;
  update challenge_sessions set closes_at = now() where id = p_id;
  perform repack_challenge_queue();
end;
$$;

-- The clash check goes: the only rows an extension could run into are queued ones, and
-- the re-pack moves them out of its way instead of refusing the extension.
create or replace function extend_challenge_session(p_id uuid, p_minutes int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_opens  timestamptz;
  v_closes timestamptz;
begin
  perform require_admin();
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'extend_challenge_session: minutes must be positive';
  end if;
  perform lock_challenge_queue();
  select opens_at, closes_at into v_opens, v_closes
    from challenge_sessions where id = p_id;
  if not found then
    raise exception 'extend_challenge_session: no such session';
  end if;
  if now() < v_opens then
    raise exception 'that session has not opened yet — it is still in the queue';
  end if;
  if now() >= v_closes then
    raise exception 'that session has already closed';
  end if;
  update challenge_sessions
     set closes_at = v_closes + make_interval(mins => p_minutes), extended_at = now()
   where id = p_id;
  perform repack_challenge_queue();
end;
$$;

-- ─── The session booked on its own ───────────────────────────────────────────
--
-- `…_plan_next_noon.sql` with two changes. It re-packs first, which is also what lays
-- sessions booked by hand before this migration onto the cadence within five minutes of
-- the push. And with nothing live or queued it books on the first slot rather than the
-- next noon, so a session booked on its own rests a day like any other. The pool, the
-- sixty days and the measure stand.
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

  -- In at a placeholder and onto its slot by the re-pack, the way `plan_challenge_session`
  -- does it, so the slot rule has one home. Nothing is queued here, so there is no floor.
  insert into challenge_sessions (mode_id, opens_at, closes_at, measure)
  values (v_mode, p_now + interval '1 day', p_now + interval '2 days', v_measure)
  returning id into v_id;
  perform repack_challenge_queue(p_now, '-infinity');
  return v_id;
end;
$$;

revoke execute on function plan_next_challenge_session(timestamptz)
  from public, anon, authenticated;

grant execute on function public.plan_challenge_session(text, text) to authenticated;
grant execute on function public.edit_challenge_session(uuid, text, text) to authenticated;
grant execute on function public.move_challenge_session(uuid, int) to authenticated;
