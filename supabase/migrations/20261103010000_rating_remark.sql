-- A **rating** gets words, and the lab gets a page per challenge to read them on.
--
-- A **remark** is the written half of a rating: free text on the same row as the figure,
-- one per player per session, and allowed without a figure — a player who has something
-- to say and no number for it can still say it. It is asked on the rating dialog's second
-- step and read by an admin on the challenge's page in the lab, and by nobody else.
--
-- **Not feedback.** That word, and "message", already mean what a player sends through
-- TELL US — the `feedback` table, the MESSAGES screen, an answer owed. A remark is never
-- answered and never reaches that screen; two things under one word on two admin screens
-- is how one of them gets answered by mistake.
--
-- ─── The row ─────────────────────────────────────────────────────────────────
--
-- `rating` stops being required, because a words-only row has none. What is still
-- required is that a row says *something*: the second check below. Every shipped row has
-- a figure, so both checks hold the moment this lands.
--
-- 500 characters, not the 800 a message gets: a remark is a line about one session, and
-- the page lists all of a challenge's at once.

alter table session_ratings alter column rating drop not null;

alter table session_ratings
  add column remark text,
  add constraint remark_length
    check (remark is null or char_length(remark) between 1 and 500),
  add constraint says_something
    check (rating is not null or remark is not null);

-- `rate_session` is unchanged. A key still writes 1 to 9, and its upsert sets `rating` and
-- `rated_at` only, so a remark sent first survives a figure sent after it.

-- The words, onto the same row. The three guards `rate_session` has, in its order and
-- with its wording, so a caller matching on one matches on both: signed in, scored on
-- it, closed. Trimmed here as well as on the client, so a remark of spaces is refused by
-- the server's own promise rather than the screen's.
--
-- An upsert that touches `remark` and nothing else, which is the other half of the
-- promise above: the figure sent a moment earlier, possibly still in flight, is never
-- overwritten by the words.
create or replace function remark_session(p_session uuid, p_remark text)
returns void language plpgsql security definer set search_path = public as $$
declare
  -- Every kind of whitespace, as the client's `trim()` strips, not only spaces.
  v_remark text := btrim(p_remark, E' \t\r\n');
begin
  if auth.uid() is null then
    raise exception 'remark_session: not signed in';
  end if;
  if v_remark is null or v_remark = '' then
    raise exception 'remark_session: a remark has to say something';
  end if;
  if char_length(v_remark) > 500 then
    raise exception 'remark_session: a remark is at most 500 characters';
  end if;
  if not exists (
    select 1 from session_scores where session_id = p_session and user_id = auth.uid()
  ) then
    raise exception 'remark_session: no score on that session';
  end if;
  if not exists (
    select 1 from challenge_sessions where id = p_session and closes_at <= now()
  ) then
    raise exception 'remark_session: that session has not closed';
  end if;
  insert into session_ratings (session_id, user_id, remark)
  values (p_session, auth.uid(), v_remark)
  on conflict (session_id, user_id)
  do update set remark = excluded.remark;
end;
$$;

revoke all on function public.remark_session(uuid, text) from public, anon;
grant execute on function public.remark_session(uuid, text) to authenticated;

-- ─── The lab's reads ─────────────────────────────────────────────────────────

-- Figures only. A words-only row has no number to average, and counting it would print
-- "RATED 6 · 3 RATINGS" over two numbers — or, for a challenge with nothing but remarks,
-- a row of nought ratings and a null average the lab would have to explain.
create or replace function challenge_ratings()
returns table (mode_id text, ratings int, average numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return query
    select s.mode_id, count(*)::int, round(avg(r.rating), 1)
    from session_ratings r
    join challenge_sessions s on s.id = r.session_id
    where r.rating is not null
    group by s.mode_id;
end;
$$;

-- Every remark on one challenge, newest session first, with the figure beside it if
-- there was one. Admin only, like the figures: these are opinions players gave to the
-- people who make the game, not to each other.
--
-- **Never who wrote it.** `…_challenge_ratings.sql` promised totals only, "never who said
-- what", and a remark is said by somebody: the page reads what was said and which session
-- it was about, and nothing that names the player. The row still holds the user — it has
-- to, to be one per player — but no read hands it out.
create or replace function challenge_remarks(p_mode_id text)
returns table (
  opens_at timestamptz,
  rating   smallint,
  remark   text
) language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return query
    select s.opens_at, r.rating, r.remark
    from session_ratings r
    join challenge_sessions s on s.id = r.session_id
    where s.mode_id = p_mode_id and r.remark is not null
    order by s.opens_at desc, r.rated_at desc;
end;
$$;

revoke all on function public.challenge_remarks(text) from public, anon;
grant execute on function public.challenge_remarks(text) to authenticated;

-- One line per session of a challenge that has closed, newest first: when, how many came,
-- and what won it. Closed, not merely opened: a live session's rank 1 is a leader, not a
-- winner, and a log that printed it as one would read a running contest as settled.
--
-- The winner is `session_board`'s rank 1 rather than `max(best_score)`, because a session
-- board is not ordered by score on a race or on NO SLIP — a race's winner is the fastest
-- time, and the highest score on it may well have come second. The three figures go back
-- as they are and the client prints the one the measure names, with `sessionFigure`, as
-- every other surface that prints a settled place does.
--
-- Open to any signed-in caller: when a session ran and its standings are already public
-- reads, and the lab's testers see this half of the page.
create or replace function challenge_session_log(p_mode_id text)
returns table (
  id         uuid,
  opens_at   timestamptz,
  closes_at  timestamptz,
  measure    text,
  players    int,
  best_score int,
  hits       int,
  time_ms    int
) language sql stable security definer set search_path = public as $$
  select
    s.id, s.opens_at, s.closes_at, s.measure,
    -- The players the winner is drawn from: `session_board` keeps a player with no
    -- nickname off the standings, and a count that included them could print NOBODY
    -- PLAYED beside 1 PLAYER.
    (select count(*)::int from session_scores sc
       join profiles p on p.id = sc.user_id
      where sc.session_id = s.id and p.nickname is not null),
    w.best_score, w.hits, w.time_ms
  from challenge_sessions s
  left join lateral (
    select b.best_score, b.hits, b.time_ms
    from session_board(s.id) b
    where b.rank = 1
    limit 1
  ) w on true
  where s.mode_id = p_mode_id and s.closes_at <= now()
  order by s.opens_at desc;
$$;

revoke all on function public.challenge_session_log(text) from public, anon;
grant execute on function public.challenge_session_log(text) to authenticated;
