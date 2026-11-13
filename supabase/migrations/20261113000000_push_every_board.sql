-- Push on every board: a takeover in any period, and a live session's lead being passed.
--
-- `20261109040000_push_subscriptions.sql` owed one push, for the all-time board changing
-- hands. This widens the same outbox rather than starting another:
--
--   a takeover   now carries a `period` — day, week or ever — and the three triggers that
--                find one (the reign for `ever`, `daily_scores` for the other two) write
--                through one helper.
--   a passed     is the lead of a live session board changing hands. A session has no
--                period and no reign, so the row names the session instead.
--
-- Function first, schema second. The new `send-push` tolerates the old schema (a row with
-- no `period` reads as the all-time board, and no `passed` row exists yet). The old function
-- does not tolerate this one: it would send a `passed` row as a takeover, with a raw
-- challenge id in the text, and the row would already be marked sent.
--
-- The push triggers below are a side feature on the hottest write in the app, so each one
-- gives up quietly rather than fail the score write that fired it, and checks the cheap
-- gates (is the feature on, did anything change) before the leader queries.

-- ─── The outbox ──────────────────────────────────────────────────────────────

alter table push_outbox drop constraint push_outbox_kind_check;
alter table push_outbox
  add constraint push_outbox_kind_check check (kind in ('takeover', 'passed'));

alter table push_outbox add column period text;
alter table push_outbox
  add column session_id uuid references challenge_sessions (id) on delete cascade;

-- Everything owed so far was the all-time board.
update push_outbox set period = 'ever';

alter table push_outbox
  add constraint push_outbox_shape check (
    (kind = 'takeover' and period in ('day', 'week', 'ever') and session_id is null)
    or (kind = 'passed' and period is null and session_id is not null)
  );

-- The throttle, one per kind of row. A takeover is one per player, board, period and day,
-- so losing today's board and then the week's are two pushes while one board changing hands
-- back and forth is one. A passed is one per player per session: a session runs a day and a
-- lead that changes hands all afternoon should not ring all afternoon.
alter table push_outbox drop constraint push_outbox_user_id_mode_difficulty_day_key;

create unique index push_outbox_takeover_throttle
  on push_outbox (user_id, mode, difficulty, period, day) where kind = 'takeover';
create unique index push_outbox_passed_throttle
  on push_outbox (user_id, session_id) where kind = 'passed';

-- ─── What every push asks first ──────────────────────────────────────────────
-- Returns the taker's nickname when a push is owed at all, null when not. The checks the
-- all-time trigger made on its own are all here now:
--   - hiding the feature stops the pushes too, not only the asking — the people already
--     subscribed are exactly who the client gate cannot reach;
--   - nobody is told they lost to themselves;
--   - nothing to send to a player with no device on file;
--   - a taker with no nickname is on no board, so has taken nothing.
create or replace function push_taker_nickname(p_displaced uuid, p_taker uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_nickname text;
begin
  if exists (select 1 from features where key = 'push' and visibility = 'hidden') then
    return null;
  end if;
  if p_displaced is null or p_displaced = p_taker then return null; end if;
  if not exists (select 1 from push_subscriptions where user_id = p_displaced) then
    return null;
  end if;
  select nickname into v_nickname from profiles where id = p_taker;
  return v_nickname;
end;
$$;

revoke all on function public.push_taker_nickname(uuid, uuid) from public, anon, authenticated;

-- The gate every trigger asks first, before any query over a board: the feature is not
-- hidden. `push_taker_nickname` asks it again for the callers that come through it.
create or replace function push_is_on()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from features where key = 'push' and visibility = 'hidden');
$$;

revoke all on function public.push_is_on() from public, anon, authenticated;

create or replace function push_period_rank(p_period text)
returns int language sql immutable as $$
  select case p_period when 'day' then 1 when 'week' then 2 when 'ever' then 3 end;
$$;

-- One score can take the day, the week and the all-time board at once. It owes one push, for
-- the widest of them: a row of an equal or wider period already owed that day makes this one
-- redundant, and a wider one replaces any narrower row that has not gone out yet. Whichever
-- order the triggers fire in, the player is told once and told the biggest thing.
create or replace function owe_takeover_push(
  p_displaced  uuid,
  p_taker      uuid,
  p_mode       text,
  p_difficulty text,
  p_period     text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_nickname text := push_taker_nickname(p_displaced, p_taker);
  v_day      date := (now() at time zone 'Europe/Prague')::date;
begin
  if v_nickname is null then return; end if;

  if exists (
    select 1 from push_outbox
    where  user_id = p_displaced and kind = 'takeover'
      and  mode = p_mode and difficulty = p_difficulty and day = v_day
      and  push_period_rank(period) >= push_period_rank(p_period)
  ) then
    return;
  end if;

  delete from push_outbox
  where  user_id = p_displaced and kind = 'takeover'
    and  mode = p_mode and difficulty = p_difficulty and day = v_day
    and  sent_at is null
    and  push_period_rank(period) < push_period_rank(p_period);

  insert into push_outbox (user_id, kind, mode, difficulty, period, by_nickname, day)
  values (p_displaced, 'takeover', p_mode, p_difficulty, p_period, v_nickname, v_day)
  on conflict do nothing;
end;
$$;

revoke all on function public.owe_takeover_push(uuid, uuid, text, text, text)
  from public, anon, authenticated;

-- ─── Ever: a reign opening ───────────────────────────────────────────────────
-- `reconcile_board_reign` closes the open reign and inserts the next in one call, so the
-- insert is where both holders are known: the previous reign on the board is the newest
-- closed one, and its owner is who just lost it.
create or replace function board_reigns_owe_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_previous uuid;
begin
  if not push_is_on() then return null; end if;
  select user_id into v_previous
  from   board_reigns
  where  mode = new.mode and difficulty = new.difficulty
    and  lost_at is not null and id <> new.id
  order  by lost_at desc, id desc
  limit  1;

  -- Nobody held it before, or the board came back round to the same player: the helper
  -- refuses the second, and a null is refused too.
  perform owe_takeover_push(v_previous, new.user_id, new.mode, new.difficulty, 'ever');
  return null;
exception when others then
  raise warning 'board_reigns_owe_push: %', sqlerrm;
  return null;
end;
$$;

-- ─── Day and week: a daily score landing ─────────────────────────────────────
-- Who leads a window, with one player's figure supplied by the caller instead of read from
-- the table. That is the whole trick: ask it once with the writer's figure from before the
-- write and once with the figure from after, and the two answers are the leader before and
-- the leader after. An after-trigger cannot see the world as it was; this lets it say what
-- the world would have been.
--
-- The window is the one `leaderboard` reads: a day is that day's rows, a week is each
-- player's best single day since Monday (not a sum), and ties go to whoever got there first.
-- A player with no nickname is on no board.
create or replace function daily_window_leader(
  p_period     text,
  p_mode       text,
  p_difficulty text,
  p_day        date,
  p_user       uuid,
  p_score      int,
  p_at         timestamptz
) returns uuid language sql stable security definer set search_path = public as $$
  with bounds as (
    select case p_period when 'day' then p_day else date_trunc('week', p_day::timestamp)::date end as from_day
  ),
  figures as (
    select d.user_id, d.best_score, d.updated_at
    from   daily_scores d, bounds b
    where  d.mode = p_mode and d.difficulty = p_difficulty
      and  d.day between b.from_day and p_day
      -- The writer's own day is the one the caller speaks for; their other days stand.
      and  not (d.user_id = p_user and d.day = p_day)
    union all
    select p_user, p_score, p_at where p_score is not null
  ),
  best as (
    select distinct on (user_id) user_id, best_score, updated_at
    from   figures
    order  by user_id, best_score desc, updated_at asc
  )
  select f.user_id
  from   best f
  join   profiles p on p.id = f.user_id and p.nickname is not null
  where  f.best_score > 0
  order  by f.best_score desc, f.updated_at asc
  limit  1;
$$;

revoke all on function public.daily_window_leader(text, text, text, date, uuid, int, timestamptz)
  from public, anon, authenticated;

create or replace function daily_scores_owe_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_period text;
  v_before uuid;
  v_after  uuid;
begin
  if not push_is_on() then return null; end if;
  -- A write that changed nothing (the no-downgrade guard returns the old row) owes nothing.
  if tg_op = 'UPDATE' and new.best_score is not distinct from old.best_score then
    return null;
  end if;
  -- A score arriving late for a day that has passed is history, not news: nobody is told
  -- about a board that closed.
  if new.day <> (now() at time zone 'Europe/Prague')::date then return null; end if;

  foreach v_period in array array['day', 'week'] loop
    v_before := daily_window_leader(
      v_period, new.mode, new.difficulty, new.day, new.user_id,
      case when tg_op = 'UPDATE' then old.best_score end,
      case when tg_op = 'UPDATE' then old.updated_at end
    );
    v_after := daily_window_leader(
      v_period, new.mode, new.difficulty, new.day, new.user_id,
      new.best_score, new.updated_at
    );
    -- The lead changed hands to the writer. Anything else — they already led, they did not
    -- get there, or the write changed nothing — owes nothing.
    if v_after = new.user_id and v_before is distinct from new.user_id then
      perform owe_takeover_push(v_before, new.user_id, new.mode, new.difficulty, v_period);
    end if;
  end loop;
  return null;
exception when others then
  -- A notification is a nicety; the score it is about is not.
  raise warning 'daily_scores_owe_push: %', sqlerrm;
  return null;
end;
$$;

create trigger daily_scores_push
  after insert or update on daily_scores
  for each row execute function daily_scores_owe_push();

-- ─── A session board: the lead passed ────────────────────────────────────────
-- The same trick as above, ordered the way `session_board` orders: the session's own
-- measure, ties to the earlier. Kept as a copy of that order rather than a call to it,
-- because it has to rank a figure that is not in the table.
create or replace function session_leader(
  p_session uuid,
  p_measure text,
  p_user    uuid,
  p_score   int,
  p_hits    int,
  p_time    int,
  p_at      timestamptz
) returns uuid language sql stable security definer set search_path = public as $$
  with figures as (
    select s.user_id, s.best_score, s.hits, s.time_ms, s.updated_at
    from   session_scores s
    where  s.session_id = p_session and s.user_id <> p_user
    union all
    select p_user, p_score, p_hits, p_time, p_at where p_score is not null
  )
  select f.user_id
  from   figures f
  join   profiles p on p.id = f.user_id and p.nickname is not null
  order  by
    case when p_measure = 'time' then f.time_ms is null end asc,
    case when p_measure = 'time' then f.hits end desc,
    case when p_measure = 'time' then f.time_ms end asc nulls last,
    case when p_measure = 'hits' then f.hits end desc,
    case when p_measure = 'time' then null else f.best_score end desc,
    f.updated_at asc
  limit  1;
$$;

revoke all on function public.session_leader(uuid, text, uuid, int, int, int, timestamptz)
  from public, anon, authenticated;

create or replace function session_scores_owe_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_session  challenge_sessions%rowtype;
  v_before   uuid;
  v_after    uuid;
  v_nickname text;
begin
  if not push_is_on() then return null; end if;
  if tg_op = 'UPDATE' and new.best_score is not distinct from old.best_score
     and new.hits is not distinct from old.hits
     and new.time_ms is not distinct from old.time_ms then
    return null;
  end if;
  select * into v_session from challenge_sessions where id = new.session_id;
  -- Only while it is open. A score may still be sent for ten minutes after the close, and
  -- that is the standings being settled, not the lead being lost.
  if not found or now() < v_session.opens_at or now() >= v_session.closes_at then
    return null;
  end if;

  v_before := session_leader(
    new.session_id, v_session.measure, new.user_id,
    case when tg_op = 'UPDATE' then old.best_score end,
    case when tg_op = 'UPDATE' then old.hits end,
    case when tg_op = 'UPDATE' then old.time_ms end,
    case when tg_op = 'UPDATE' then old.updated_at end
  );
  v_after := session_leader(
    new.session_id, v_session.measure, new.user_id,
    new.best_score, new.hits, new.time_ms, new.updated_at
  );
  if v_after is distinct from new.user_id or v_before is not distinct from v_after
     or v_before is null then
    return null;
  end if;

  v_nickname := push_taker_nickname(v_before, new.user_id);
  if v_nickname is null then return null; end if;

  -- `mode` holds the challenge, as it does on a board row, and `difficulty` is empty: a
  -- session has the one rung it pinned and the message does not name it.
  insert into push_outbox (user_id, kind, mode, difficulty, session_id, by_nickname, day)
  values (v_before, 'passed', v_session.mode_id, '', new.session_id, v_nickname,
          (now() at time zone 'Europe/Prague')::date)
  on conflict do nothing;
  return null;
exception when others then
  raise warning 'session_scores_owe_push: %', sqlerrm;
  return null;
end;
$$;

create trigger session_scores_push
  after insert or update on session_scores
  for each row execute function session_scores_owe_push();

-- ─── Draining the outbox ─────────────────────────────────────────────────────
-- The returned table gained two columns, and Postgres will not replace a function whose
-- return type changed.
drop function if exists drain_push_outbox(int);

create or replace function drain_push_outbox(p_limit int)
returns table (
  outbox_id   bigint,
  kind        text,
  mode        text,
  difficulty  text,
  period      text,
  session_id  uuid,
  by_nickname text,
  endpoint    text,
  platform    text,
  p256dh      text,
  auth        text,
  locale      text
) language sql security definer set search_path = public as $$
  with claimed as (
    update push_outbox o
       set sent_at = now()
     where o.id in (
       select id from push_outbox where sent_at is null order by id limit p_limit
       for update skip locked
     )
    returning o.id, o.user_id, o.kind, o.mode, o.difficulty, o.period, o.session_id,
              o.by_nickname
  )
  select c.id, c.kind, c.mode, c.difficulty, c.period, c.session_id, c.by_nickname,
         s.endpoint, s.platform, s.p256dh, s.auth, s.locale
  from   claimed c
  join   push_subscriptions s on s.user_id = c.user_id;
$$;

revoke all on function public.drain_push_outbox(int) from public, anon, authenticated;
grant execute on function public.drain_push_outbox(int) to service_role;
