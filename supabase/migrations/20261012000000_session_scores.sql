-- The standings of one session, and the only standings a challenge has.
--
-- A **session board** is not a **board**. A board is one mode × difficulty pairing with
-- a day, a week and an ever on it, a medal, a reign and a place in the podium; it lives
-- in `scores` and `daily_scores` and every one of those systems reasons about it. A
-- session board is one row per player per session and none of that: a session *is* its
-- own window, which is exactly why it needs none of the three periods, and a challenge
-- aired twice is two contests rather than one board that forgot.
--
-- Keeping it in its own table is what lets medals, reigns, winnings and the recap carry
-- on knowing nothing about challenges. `scores.mode` keeps its
-- `check (mode in ('accuracy','speed'))` untouched.

create table session_scores (
  session_id uuid not null references challenge_sessions (id) on delete cascade,
  user_id    uuid not null references profiles (id)           on delete cascade,
  best_score int  not null,
  hits       int  not null,
  -- The rung the challenge pinned, as the client resolved it. Stored rather than looked
  -- up because a mode is a value in the bundle and the server has never heard of one —
  -- and the fortune this feeds is weighted by difficulty, so the weight has to be a
  -- fact about the row rather than a question the server cannot answer.
  difficulty text not null,
  -- The moment the run ended, not the moment it was sent: it is what the board sorts
  -- ties by, so a score that waited out a flight keeps the position it was earned in.
  updated_at timestamptz not null,

  primary key (session_id, user_id)
);

-- Ranked reads, and the tie-break the ranking uses.
create index session_scores_board_idx
  on session_scores (session_id, best_score desc, updated_at asc);

-- A worse score never replaces a better one. The same function `scores` and
-- `daily_scores` have used since …_init.sql — it reads `new.best_score < old.best_score`
-- and nothing else, so it fits here without a second copy.
create trigger session_scores_no_downgrade
  before update on session_scores
  for each row execute function prevent_score_downgrade();

-- ─── Who may read ────────────────────────────────────────────────────────────
-- Everybody, like `challenge_sessions` above it: standings are what the start screen is
-- about to put in front of players. Every write is the RPC below.
alter table session_scores enable row level security;

create policy "public read" on session_scores for select using (true);

grant select on public.session_scores to anon, authenticated;

-- ─── Cancelling a session that people have played ────────────────────────────
-- The foreign key above is `on delete cascade`, which is the right shape for the data:
-- standings cannot outlive the session they belong to. But phase one made CANCEL
-- SESSION unconditional, and from here on the rows underneath are scores people played
-- for — so the one door an admin reaches through learns to refuse.
--
-- `create or replace` of the phase-one function: the grant already made stands. The
-- message says how many players, the way `delete_role` says how many people hold a
-- role, because a constraint name is not something to show to a person.
--
-- A session nobody has played is still free to cancel. That is the trade: cleaning up a
-- mistake beats preserving one, and a session with no scores is only ever a mistake.
create or replace function cancel_challenge_session(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_played int;
begin
  perform require_admin();
  select count(*) into v_played from session_scores where session_id = p_id;
  if v_played > 0 then
    raise exception 'cancel_challenge_session: % % already scored on it',
      v_played, case when v_played = 1 then 'player has' else 'players have' end;
  end if;
  delete from challenge_sessions where id = p_id;
end;
$$;

-- ─── The write ───────────────────────────────────────────────────────────────
-- An RPC rather than an upsert under a policy, because the window has to be the
-- server's promise. A client that believed a session was still open — a stale read, a
-- clock an hour out, a tab left open overnight — would otherwise post into a contest
-- that had already been settled.
--
-- The grace is what stops the clock robbing a player who started in time. A run cannot
-- last ten minutes, so anything arriving inside it began before the close; anything
-- later did not. Opening is not graced in the same way: a run started before a session
-- opens was not a run of that session at all.
create or replace function submit_session_score(
  p_session_id uuid,
  p_score      int,
  p_hits       int,
  p_difficulty text,
  p_achieved_at timestamptz
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_opens  timestamptz;
  v_closes timestamptz;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  select opens_at, closes_at into v_opens, v_closes
    from challenge_sessions where id = p_session_id;
  if not found then
    raise exception 'submit_session_score: no such session';
  end if;

  if now() < v_opens then
    raise exception 'submit_session_score: that session has not opened';
  end if;
  if now() >= v_closes + interval '10 minutes' then
    raise exception 'submit_session_score: that session has closed';
  end if;

  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (p_session_id, v_caller, p_score, p_hits, p_difficulty, p_achieved_at)
  on conflict (session_id, user_id) do update
    set best_score = excluded.best_score,
        hits       = excluded.hits,
        difficulty = excluded.difficulty,
        updated_at = excluded.updated_at;
  -- The no-downgrade trigger above silently keeps the better row, so a worse run is a
  -- successful write that changed nothing. That is deliberate: the client has nothing
  -- to do about it and nothing to tell the player.
end;
$$;

-- ─── The two reads ───────────────────────────────────────────────────────────
-- One session's standings, shaped like the rows `leaderboard` returns so the panel that
-- draws a board can draw this without learning a second shape.
create or replace function session_board(p_session_id uuid)
returns table (
  rank        bigint,
  user_id     uuid,
  nickname    text,
  best_score  int,
  hits        int,
  achieved_at timestamptz,
  avg_acc     int,
  avg_spd     int
) language sql stable security definer set search_path = public as $$
  select
    rank() over (order by s.best_score desc, s.updated_at asc)::bigint,
    s.user_id,
    p.nickname::text,
    s.best_score,
    s.hits,
    s.updated_at,
    f.avg_acc,
    f.avg_spd
  from session_scores s
  join profiles p on p.id = s.user_id
  -- `left join` for the reason `leaderboard` uses one: a player the counters have never
  -- seen still belongs on the standings, with their name simply drawn uncoloured.
  left join lateral player_factors(s.user_id) f on true
  -- The same rule every board keeps: a player with no nickname has nothing to publish
  -- under. Their score is still stored, and still theirs the moment they pick one.
  where s.session_id = p_session_id and p.nickname is not null
  order by s.best_score desc, s.updated_at asc;
$$;

-- Every session whose close is still ahead, with whoever leads it. One round trip for
-- the card on the start screen: which challenge, when, and who is ahead.
--
-- Everything still ahead rather than only what is open now — the card shows a teaser
-- the day before a session opens, and *which* sessions are worth drawing is a Prague-day
-- question the client already owns (see `cardSession`). Answering it here would be the
-- second place that rule lives.
create or replace function open_sessions_with_leaders()
returns table (
  id            uuid,
  mode_id       text,
  opens_at      timestamptz,
  closes_at     timestamptz,
  leader_name   text,
  leader_score  int
) language sql stable security definer set search_path = public as $$
  select
    s.id, s.mode_id, s.opens_at, s.closes_at,
    lead_row.nickname::text,
    lead_row.best_score
  from challenge_sessions s
  left join lateral (
    select p.nickname, b.best_score
    from session_scores b
    join profiles p on p.id = b.user_id
    where b.session_id = s.id and p.nickname is not null
    order by b.best_score desc, b.updated_at asc
    limit 1
  ) lead_row on true
  where s.closes_at > now()
  order by s.opens_at asc;
$$;

grant execute on function public.submit_session_score(uuid, int, int, text, timestamptz)
  to authenticated;
grant execute on function public.session_board(uuid)              to anon, authenticated;
grant execute on function public.open_sessions_with_leaders()     to anon, authenticated;
