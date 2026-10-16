-- A session's window stops being fixed at the moment it was booked.
--
-- Three things were true of `challenge_sessions` and all three were wrong:
--
--   1. How far ahead a session announces itself was not a figure at all. The card
--      appeared at midnight Prague the day before, for every session, because that is
--      what `teaserOpensAt` was written to do. There was nothing to set.
--   2. A live session could have its challenge, its start and its end rewritten by the
--      same form that plans one that has not begun.
--   3. `cancel_challenge_session` deleted the row, in any state, with players' scores
--      behind it — taking a session board, its settled places, and points already
--      counted toward a fortune.
--
-- So: one general figure with a per-session override over it, two acts a live window
-- actually allows, and two guards over the two that were too broad.
--
-- ─── The word, before it gets used ───────────────────────────────────────────
--
-- The figure is the **teaser** — in minutes, how long before it opens a session shows
-- its coming-soon face. The word is `teaserOpensAt`'s already; this makes its length a
-- number. Deliberately NOT a "lead": `leader_name`, `leader_score` and the `lead_row`
-- alias in `open_sessions_with_leaders` below already mean the top player on a session
-- board, and a `lead` beside a `leader` is one letter of difference carrying two
-- unrelated ideas.
--
-- And **closing early** is not **cancelling**. Cancel is spoken for — it is the delete
-- below, and that is the right act for a booking nobody has played. Closing early shuts
-- a live window *now* and keeps everything behind it, which is why it is built from the
-- column it moves rather than given a word of its own to drift on.

-- ─── Settings ────────────────────────────────────────────────────────────────

-- One general figure today, and a table rather than a column because the second one
-- should not need a migration of its own shape. Keyed by text the way `features` is, for
-- the same reason: the row is the record of a decision somebody made, and it carries who
-- made it and when.
--
-- Public read. A lead time is configuration rather than a secret — the same answer
-- `challenge_sessions` gives, and for the same reason: the start screen is about to read
-- it, and a player who can see a session can see when it was going to be announced.
-- `int_value` is floored at nought for the same reason `teaser_minutes` is, and leaving
-- it off would have been the worse half of the pair: a negative general figure makes
-- `teaserOpensAt` compute `opensAt + X`, and a teaser must satisfy both `now < opensAt`
-- and `now >= teaserOpensAt` — which can then never both hold. Every teaser in the app
-- stops appearing, with nothing raised and nothing logged. That is the same silent,
-- app-wide failure the third `coalesce` arm below exists to prevent, and it was left open
-- on this side until a review pointed at it.
--
-- Not a column type a future non-negative setting would fight: a figure that genuinely
-- wants to go below nought gets its own column rather than this one losing its floor.
create table settings (
  key        text primary key,
  int_value  int not null check (int_value >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);

alter table settings enable row level security;
create policy "public read" on settings for select using (true);
grant select on public.settings to anon, authenticated;

-- 2160 minutes is thirty-six hours, and it is not a round number by accident: it is
-- exactly what the app does today. The teaser opens at midnight Prague the day before,
-- and `defaultSpan` hands out noon-to-noon — so for the span an admin is actually given,
-- today's effective lead is thirty-six hours. Seeding it means nothing moves on the day
-- this lands; the figure only matters once somebody changes it.
insert into settings (key, int_value) values ('teaser_minutes', 2160);

create or replace function set_setting(p_key text, p_int int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
begin
  -- Named here as well as in the constraint, the way `set_feature` names an unknown
  -- visibility: the constraint is what makes it true against any caller, and this is what
  -- puts a sentence rather than a constraint name in front of somebody holding a phone.
  if p_int is null or p_int < 0 then
    raise exception 'set_setting: % cannot be negative', p_key;
  end if;
  update settings
     set int_value = p_int, updated_at = now(), updated_by = v_caller
   where key = p_key;
  if not found then
    raise exception 'set_setting: no such setting %', p_key;
  end if;
end;
$$;

-- ─── The session's own two columns ───────────────────────────────────────────

-- `teaser_minutes` null means "use the general figure", and null is the usual answer —
-- a session says otherwise only when somebody typed something into its own field.
--
-- Zero is legal, and means no teaser at all: the card appears when the session opens and
-- not a moment before. A floor would be this schema holding a second opinion about
-- something the admin can already see the effect of on the start screen.
alter table challenge_sessions
  add column teaser_minutes int,
  add column extended_at    timestamptz;

alter table challenge_sessions
  add constraint teaser_minutes_not_negative
  check (teaser_minutes is null or teaser_minutes >= 0);

comment on column challenge_sessions.teaser_minutes is
  'How many minutes before it opens this session announces itself, or null for the general figure in settings. Zero means no teaser at all.';
comment on column challenge_sessions.extended_at is
  'When this session was last given more time, or null. The intro says so for the rest of the window.';

-- ─── What a live window allows ───────────────────────────────────────────────

-- Shut it now, and keep everything behind it.
--
-- `session_scores` is not touched, and that is the whole point rather than an omission:
-- a session board is kept forever and reset by nothing, and a place on one is settled
-- the moment its window shuts. Shutting a window early is still shutting it, so the
-- standings settle exactly as a natural close would have left them.
create or replace function close_challenge_session_early(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_opens  timestamptz;
  v_closes timestamptz;
begin
  perform require_admin();
  select opens_at, closes_at into v_opens, v_closes
    from challenge_sessions where id = p_id;
  if not found then
    raise exception 'close_challenge_session_early: no such session';
  end if;
  -- Half-open, matching `spanStatus` and `isOpenMode`: live from the instant it opens,
  -- over from the instant it closes.
  if now() < v_opens then
    raise exception 'that session has not opened yet — cancel it instead';
  end if;
  if now() >= v_closes then
    raise exception 'that session has already closed';
  end if;
  update challenge_sessions set closes_at = now() where id = p_id;
end;
$$;

-- More time, and nothing else about it changed.
--
-- The clash check is the part worth reading. `closes_at` now has three doors into it —
-- plan, edit and this — and the overlap rule guards the first two. An extend that
-- skipped it would make two overlapping sessions of one challenge creatable by a route
-- the rule never sees, which is the same hole from a direction nobody would think to
-- check.
create or replace function extend_challenge_session(p_id uuid, p_minutes int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_mode   text;
  v_opens  timestamptz;
  v_closes timestamptz;
  v_until  timestamptz;
begin
  perform require_admin();
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'extend_challenge_session: minutes must be positive';
  end if;
  select mode_id, opens_at, closes_at into v_mode, v_opens, v_closes
    from challenge_sessions where id = p_id;
  if not found then
    raise exception 'extend_challenge_session: no such session';
  end if;
  if now() < v_opens then
    raise exception 'that session has not opened yet — change its end instead';
  end if;
  if now() >= v_closes then
    raise exception 'that session has already closed';
  end if;
  v_until := v_closes + make_interval(mins => p_minutes);
  if challenge_session_clashes(v_mode, v_opens, v_until, p_id) then
    raise exception 'that challenge is already booked for part of that time';
  end if;
  update challenge_sessions
     set closes_at = v_until, extended_at = now()
   where id = p_id;
end;
$$;

-- ─── The two guards that were too broad ──────────────────────────────────────

-- A played session's span joins its challenge in what this form may not change.
--
-- The guard is about **scores, not liveness**, which is the shape this file already had:
-- `20261013010000_edit_session_guard.sql` refused a challenge change once anybody had
-- scored, and this widens the same condition to the span. A session with a board is a
-- contest people have run in, and moving the window retrospectively changes what they
-- were playing; a live session nobody has touched is just a booking, and correcting one a
-- minute after it opened is the ordinary reason to open this form.
--
-- Deliberately *not* keyed on live, which was the first draft. supabase/tests/
-- session_scores.sql asserts both halves of the older rule — an unplayed session is still
-- re-pointable, a played one is not — and keying on liveness broke them both for a case
-- nobody had asked about.
--
-- `cancel` below is the asymmetry worth knowing: it refuses a live session even with an
-- empty board, because deleting one takes the card out from under a player who may be
-- looking at it this second. Editing an untouched booking corrects it; deleting it makes
-- it vanish.
-- Both of these gain `p_teaser_minutes`, and both are **dropped** first rather than
-- replaced. A Postgres function is identified by its name *and* its argument types, so a
-- `create or replace` with one more parameter adds an overload and leaves the old arity
-- sitting beside it — which the client would go on calling, silently never setting a
-- teaser. The grants go with the drop, hence the regrant at the foot.
drop function if exists plan_challenge_session(text, timestamptz, timestamptz);
drop function if exists edit_challenge_session(uuid, text, timestamptz, timestamptz);

create or replace function plan_challenge_session(
  p_mode_id        text,
  p_opens_at       timestamptz,
  p_closes_at      timestamptz,
  p_teaser_minutes int default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
  v_id     uuid;
begin
  if challenge_session_clashes(p_mode_id, p_opens_at, p_closes_at) then
    raise exception 'that challenge is already booked for part of that time';
  end if;
  insert into challenge_sessions (mode_id, opens_at, closes_at, teaser_minutes, created_by)
  values (p_mode_id, p_opens_at, p_closes_at, p_teaser_minutes, v_caller)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function edit_challenge_session(
  p_id             uuid,
  p_mode_id        text,
  p_opens_at       timestamptz,
  p_closes_at      timestamptz,
  p_teaser_minutes int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_was    text;
  v_opens  timestamptz;
  v_closes timestamptz;
  v_played int;
begin
  perform require_admin();
  select mode_id, opens_at, closes_at into v_was, v_opens, v_closes
    from challenge_sessions where id = p_id;
  if not found then
    raise exception 'edit_challenge_session: no such session';
  end if;
  select count(*) into v_played from session_scores where session_id = p_id;
  -- The challenge, with the message this guard has carried since it was written: whoever
  -- matches on it should go on matching.
  if v_played > 0 and v_was is distinct from p_mode_id then
    raise exception
      'edit_challenge_session: % % already scored on it, so it cannot change challenge',
      v_played, case when v_played = 1 then 'player has' else 'players have' end;
  end if;
  -- The span, which is new. EXTEND is the one way a played window still moves, and it
  -- only ever adds time to the end.
  if v_played > 0
     and (p_opens_at is distinct from v_opens or p_closes_at is distinct from v_closes) then
    raise exception
      'edit_challenge_session: % % already scored on it, so its window cannot be moved — use EXTEND',
      v_played, case when v_played = 1 then 'player has' else 'players have' end;
  end if;
  if challenge_session_clashes(p_mode_id, p_opens_at, p_closes_at, p_id) then
    raise exception 'that challenge is already booked for part of that time';
  end if;
  -- `extended_at` is cleared when the end is rewritten by hand, and that is not tidiness:
  -- the mark is what the card reads to tell players this window was given more time, so a
  -- session extended and then edited back to its original end would go on saying so for a
  -- window that was not. Only reachable while nobody has scored — which is exactly when
  -- an admin is still correcting a booking.
  update challenge_sessions
     set mode_id        = p_mode_id,
         opens_at       = p_opens_at,
         closes_at      = p_closes_at,
         teaser_minutes = p_teaser_minutes,
         extended_at    = case
                            when p_closes_at is distinct from v_closes then null
                            else extended_at
                          end
   where id = p_id;
end;
$$;

-- Deleting a booking stays available, and one more case joins what it refuses.
--
-- **The score guard is not new.** `20261012000000_session_scores.sql` added it the day
-- session boards arrived, with the message asserted in supabase/tests/session_scores.sql,
-- and it is reproduced verbatim below rather than reworded — changing a shipped error
-- string buys nothing and breaks whoever was matching on it. The only thing this
-- migration adds here is the **live** guard: a session nobody has played *yet* is one
-- somebody may be playing this second, and that case used to delete.
--
-- The score check stays in front of the live one, which keeps every refusal that already
-- existed saying exactly what it already said. The one new message belongs to the one
-- newly refused case: a live session with an empty board.
create or replace function cancel_challenge_session(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_opens  timestamptz;
  v_closes timestamptz;
  v_played int;
begin
  perform require_admin();
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
end;
$$;

-- ─── What the start screen reads ─────────────────────────────────────────────

-- Two more columns on the card's read, and a change of signature — so the same
-- drop-then-create `20261014000000_session_leader_factors.sql` needed, and the regrant at
-- the foot that goes with it.
--
-- The teaser arrives **resolved**: the session's own figure if it has one, the general
-- one if it does not. Doing the coalesce here rather than on the client is newly the
-- right answer. The old rule needed a Prague day boundary and so had to live in `lib/`,
-- beside the one place that already owns day boundaries; minutes before an instant is
-- plain arithmetic, and resolving it here means the client makes one read rather than
-- two and nothing downstream has an opinion about what a missing figure means.
drop function if exists open_sessions_with_leaders();

create or replace function open_sessions_with_leaders()
returns table (
  id             uuid,
  mode_id        text,
  opens_at       timestamptz,
  closes_at      timestamptz,
  teaser_minutes int,
  extended_at    timestamptz,
  leader_name    text,
  leader_score   int,
  leader_acc     int,
  leader_spd     int
) language sql stable security definer set search_path = public as $$
  select
    s.id, s.mode_id, s.opens_at, s.closes_at,
    -- Three arms, and the third is not belt-and-braces. The client types this `number`
    -- and multiplies it, so a null arriving there becomes `null * 60_000` — which is
    -- nought in JavaScript, not an error. Every teaser would switch off at once, nothing
    -- would raise, and nothing would be logged: a silent, app-wide change of behaviour
    -- caused by one missing row. `verify` found exactly that by deleting the row.
    --
    -- So the literal repeats the seed above rather than sharing a constant with it, and
    -- the duplication is the point: the seed is what the figure *starts* as and may be
    -- changed from, and this is what the resolve falls back to when the row is not there
    -- to be read. They are two facts that happen to be the same number today.
    --
    -- Here rather than on the client, which is the whole of review focus #4: one opinion
    -- about a missing figure, in the one place that already resolves it.
    coalesce(
      s.teaser_minutes,
      (select int_value from settings where key = 'teaser_minutes'),
      2160
    ),
    s.extended_at,
    lead_row.nickname::text,
    lead_row.best_score,
    lead_row.avg_acc,
    lead_row.avg_spd
  from challenge_sessions s
  left join lateral (
    select p.nickname, b.best_score, f.avg_acc, f.avg_spd
    from session_scores b
    join profiles p on p.id = b.user_id
    -- `left join` for the reason `session_board` uses one: a player the counters have
    -- never seen still leads the session, with their name simply drawn uncoloured.
    left join lateral player_factors(b.user_id) f on true
    where b.session_id = s.id and p.nickname is not null
    order by b.best_score desc, b.updated_at asc
    limit 1
  ) lead_row on true
  where s.closes_at > now()
  order by s.opens_at asc;
$$;

grant execute on function public.open_sessions_with_leaders() to anon, authenticated;
grant execute on function public.set_setting(text, int) to authenticated;
grant execute on function public.close_challenge_session_early(uuid) to authenticated;
grant execute on function public.extend_challenge_session(uuid, int) to authenticated;
grant execute on function public.plan_challenge_session(text, timestamptz, timestamptz, int)
  to authenticated;
grant execute on function public.edit_challenge_session(uuid, text, timestamptz, timestamptz, int)
  to authenticated;
