-- Sessions run **twice a week**: Monday noon to Tuesday noon, Thursday noon to Friday noon
-- (Prague). The slot was "every second noon", which drifted across the calendar; it is now
-- a fixed pair of weekdays, so a week reads the same as the one before it and the two
-- quiet gaps — Tuesday noon to Thursday noon, Friday noon to Monday noon — are where the
-- vote for the next session runs (`next_vote_options` already answers for exactly that gap:
-- the next planned session, while none is live).
--
-- Only the arithmetic moves. The queue is still the rows that have not opened, ordered by
-- `opens_at`, and every write still re-packs them; what changes is where a slot lands and
-- that a session now closes at the *next day's noon by the wall clock* rather than 24
-- literal hours on, so it is noon to noon across a daylight-saving night too.
--
-- The 23-hour tolerance goes with it: it existed so a close at 13:00 after a clock change
-- still opened the next noon, and with a day or more of rest between sessions there is
-- nothing for it to absorb. The first slot is simply the first Monday or Thursday noon at
-- or after the end of the live or last session.

-- The first Monday-or-Thursday noon (Prague) at or after an instant.
create or replace function challenge_slot_at_or_after(p_at timestamptz)
returns timestamptz language plpgsql immutable set search_path = public as $$
declare
  v_date date := (p_at at time zone 'Europe/Prague')::date;
  v_noon timestamptz;
begin
  loop
    if extract(isodow from v_date) in (1, 4) then
      v_noon := (v_date + time '12:00') at time zone 'Europe/Prague';
      if v_noon >= p_at then
        return v_noon;
      end if;
    end if;
    v_date := v_date + 1;
  end loop;
end;
$$;

-- The first slot. `p_after` is the end of the live or last session, null with none ever
-- opened. An end long past is no reason to open in the past, so the answer falls forward
-- to the next slot to come.
create or replace function challenge_queue_slot(p_after timestamptz, p_now timestamptz)
returns timestamptz language plpgsql immutable set search_path = public as $$
declare
  v_slot timestamptz;
begin
  if p_after is not null then
    v_slot := challenge_slot_at_or_after(p_after);
    if v_slot >= p_now then
      return v_slot;
    end if;
  end if;
  return challenge_slot_at_or_after(p_now);
end;
$$;

-- Lays every queued row onto the slots, in the order the queue already has. Idempotent.
-- The body of `…_session_queue.sql` with the walk changed: each slot is the Prague date of
-- the one before plus three days (Monday to Thursday) or four (Thursday to Monday), at
-- noon, and a session closes at noon the day after it opens.
create or replace function repack_challenge_queue(
  p_now   timestamptz default now(),
  p_floor timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_slot   timestamptz;
  v_floor  timestamptz;
  v_date   date;
  v_row    record;
  v_opens  timestamptz;
  v_closes timestamptz;
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
    v_slot := greatest(v_slot, challenge_slot_at_or_after(v_floor));
  end if;
  v_date := (v_slot at time zone 'Europe/Prague')::date;
  for v_row in
    select id from challenge_sessions where opens_at > p_now order by opens_at, created_at
  loop
    v_opens  := (v_date + time '12:00') at time zone 'Europe/Prague';
    v_closes := ((v_date + 1) + time '12:00') at time zone 'Europe/Prague';
    update challenge_sessions
       set opens_at = v_opens, closes_at = v_closes
     where id = v_row.id
       and (opens_at, closes_at) is distinct from (v_opens, v_closes);
    v_date := v_date + case extract(isodow from v_date) when 1 then 3 else 4 end;
  end loop;
end;
$$;

revoke execute on function repack_challenge_queue(timestamptz, timestamptz)
  from public, anon, authenticated;

-- What was queued is laid onto the new slots now rather than at the next write.
do $$
begin
  perform lock_challenge_queue();
  perform repack_challenge_queue();
end;
$$;
