-- The player profile — what a name opens when it is tapped.
--
-- The server knows what a player scored once, and nothing about who they are. Three
-- tables close that: lifetime counters per board, the history of who has held each
-- all-time board, and a receipts table that makes counting a run exactly-once.
--
-- No per-run rows. `player_totals` is six counters per player, `board_reigns` a handful
-- of rows per board per year, and `run_receipts` a uuid that is pruned after a month.

-- ─── Lifetime counters ───────────────────────────────────────────────────────
-- One row per player × board. Accuracy and Speed only: Trainee is unscored practice
-- with no board and no difficulty, and multiplayer submits nothing to the server.

create table player_totals (
  user_id    uuid not null references profiles (id) on delete cascade,
  mode       text not null check (mode in ('accuracy', 'speed')),
  difficulty text not null check (difficulty in ('easy', 'hard', 'extreme')),
  runs       int    not null default 0,
  hits       int    not null default 0,
  -- The one column with no ceiling — everything else is bounded by runs.
  score_sum  bigint not null default 0,
  -- Sum over every hit of its accuracy / speed factor. Kept as a sum so a run is added
  -- without reading anything back, and divided by `hits` to be shown: the app renders
  -- round(100 * acc_sum / hits), the same formula the game over screen already uses for
  -- a single run. Two ways of computing one number is how the two come to disagree.
  acc_sum    double precision not null default 0,
  spd_sum    double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode, difficulty)
);

-- ─── Run receipts ────────────────────────────────────────────────────────────
-- What makes `record_run` exactly-once. A counter cannot notice or repair a run added
-- twice — unlike `daily_scores`, where a repeated write is the same best score again —
-- so a response lost on the way back to a device that then retries would corrupt every
-- average on that board permanently.
--
-- Deliberately not per-run history: a uuid and a timestamp, nothing about the run.

create table run_receipts (
  run_id  uuid primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  at      timestamptz not null default now()
);

create index run_receipts_at_idx on run_receipts (at);

-- ─── Board reigns ────────────────────────────────────────────────────────────
-- One unbroken stretch of holding an all-time board's rank one. A player raising their
-- own record does not start a new reign — they were never not holding it.
--
-- All-time only. TODAY and THIS WEEK change hands daily and reset on a clock, so a list
-- of them would be noise rather than history.

create table board_reigns (
  id         bigserial primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  mode       text not null check (mode in ('accuracy', 'speed')),
  difficulty text not null check (difficulty in ('easy', 'hard', 'extreme')),
  -- What they hold it with, raised in place while the reign continues — the best they
  -- ever held it with rather than what they took it with.
  score      int not null,
  took_at    timestamptz not null,
  -- Null while they still hold it.
  lost_at    timestamptz
);

create index board_reigns_user_idx on board_reigns (user_id, took_at desc);

-- The invariant stated as a constraint: a board has at most one open reign. A bug that
-- opened a second would otherwise stay invisible until a profile showed two players
-- holding the same board.
create unique index board_reigns_one_open_idx
  on board_reigns (mode, difficulty) where lost_at is null;

-- ─── Keeping reigns current ──────────────────────────────────────────────────
-- Recomputed from the board rather than inferred from the write: whoever leads `scores`
-- now is who holds it now, and a function that reads that cannot drift from it.

create or replace function reconcile_board_reign(
  p_mode       text,
  p_difficulty text,
  p_at         timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_leader_id    uuid;
  v_leader_score int;
  v_open         board_reigns%rowtype;
begin
  select s.user_id, s.best_score into v_leader_id, v_leader_score
  from   scores s
  -- A player without a nickname is not on the board at all, so they cannot hold it
  -- either — the same rule `leaderboard`, `my_medals` and `past_winners` apply.
  join   profiles p on p.id = s.user_id and p.nickname is not null
  where  s.mode = p_mode and s.difficulty = p_difficulty and s.best_score > 0
  -- Ties go to whoever got there first, the tiebreak every board in the app uses. A tie
  -- must not take a board off the player who already held it.
  order  by s.best_score desc, s.updated_at asc
  limit  1;

  if v_leader_id is null then return; end if;

  select * into v_open
  from   board_reigns
  where  mode = p_mode and difficulty = p_difficulty and lost_at is null;

  if v_open.id is not null and v_open.user_id = v_leader_id then
    update board_reigns set score = greatest(score, v_leader_score) where id = v_open.id;
    return;
  end if;

  if v_open.id is not null then
    -- `greatest` because a score can arrive backdated — it is stamped with the moment
    -- the run ended, not the moment it was sent — and a reign must never end before it
    -- began.
    update board_reigns set lost_at = greatest(p_at, took_at) where id = v_open.id;
  end if;

  insert into board_reigns (user_id, mode, difficulty, score, took_at)
  values (v_leader_id, p_mode, p_difficulty, v_leader_score, p_at);
end;
$$;

revoke execute on function reconcile_board_reign(text, text, timestamptz) from public;

-- `new.updated_at`, never `now()`: that column is the moment the run ended, the rule
-- `score-submission.ts` already follows so a record that waited out a flight keeps the
-- position it was earned in. Stamping a reign with the write would date a champion's
-- reign to their next reconnection.
create or replace function scores_track_reign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform reconcile_board_reign(new.mode, new.difficulty, new.updated_at);
  return null;
end;
$$;

create trigger scores_reign
  after insert or update on scores
  for each row execute function scores_track_reign();

-- The case a trigger on `scores` alone cannot see: a player who already has scores but
-- no nickname is not on any board, and setting one puts them on all of them without a
-- single score being written. They join the board now, so the reign starts now — the
-- score's own timestamp would backdate a reign to before they were eligible to hold it.
create or replace function profiles_track_reign()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_board record;
begin
  for v_board in
    select distinct mode, difficulty from scores where user_id = new.id
  loop
    perform reconcile_board_reign(v_board.mode, v_board.difficulty, now());
  end loop;
  return null;
end;
$$;

create trigger profiles_reign
  after update of nickname on profiles
  for each row
  when (old.nickname is null and new.nickname is not null)
  execute function profiles_track_reign();

-- Every board's current leader starts an open reign at the moment their record was set.
-- One statement, and it is what stops the feature reading blank on day one for exactly
-- the players most likely to be tapped.
insert into board_reigns (user_id, mode, difficulty, score, took_at)
select distinct on (s.mode, s.difficulty)
  s.user_id, s.mode, s.difficulty, s.best_score, s.updated_at
from   scores s
join   profiles p on p.id = s.user_id and p.nickname is not null
where  s.best_score > 0
order  by s.mode, s.difficulty, s.best_score desc, s.updated_at asc;

-- ─── Recording a run ─────────────────────────────────────────────────────────
-- Not folded into the score submit: `submitScore` is called several times per run — on
-- every board record as it happens, again at game over, again from END RUN — because it
-- is an upsert of a best and repeating it is harmless. A counter incremented there would
-- report five runs for one.

create or replace function record_run(
  p_run_id     uuid,
  p_mode       text,
  p_difficulty text,
  p_score      int,
  p_hits       int,
  p_acc_sum    double precision,
  p_spd_sum    double precision
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'record_run: not authenticated';
  end if;
  if p_mode not in ('accuracy', 'speed') then
    raise exception 'record_run: unknown mode %', p_mode;
  end if;
  if p_difficulty not in ('easy', 'hard', 'extreme') then
    raise exception 'record_run: unknown difficulty %', p_difficulty;
  end if;
  -- Values no real run can produce. A broken or hostile client cannot be stopped from
  -- lying about one run; it can be stopped from writing a number that makes every
  -- average on that board meaningless forever. Each per-hit factor is bounded by 1 plus
  -- the speed bonus, so twice the hit count is a ceiling with room to spare.
  if p_score < 0 or p_hits < 0 or p_acc_sum < 0 or p_spd_sum < 0 then
    raise exception 'record_run: negative values';
  end if;
  if p_hits > 5000 or p_score > 1000000 then
    raise exception 'record_run: out of range';
  end if;
  if p_acc_sum > p_hits * 2 or p_spd_sum > p_hits * 2 then
    raise exception 'record_run: factor sums out of range';
  end if;

  insert into run_receipts (run_id, user_id) values (p_run_id, v_user)
  on conflict (run_id) do nothing;
  -- The run is already counted. A replay is a retry whose response was lost, and the
  -- honest answer to it is to do nothing and report success.
  if not found then return; end if;

  insert into player_totals (
    user_id, mode, difficulty, runs, hits, score_sum, acc_sum, spd_sum, updated_at
  )
  values (v_user, p_mode, p_difficulty, 1, p_hits, p_score, p_acc_sum, p_spd_sum, now())
  on conflict (user_id, mode, difficulty) do update set
    runs       = player_totals.runs + 1,
    hits       = player_totals.hits + excluded.hits,
    score_sum  = player_totals.score_sum + excluded.score_sum,
    acc_sum    = player_totals.acc_sum + excluded.acc_sum,
    spd_sum    = player_totals.spd_sum + excluded.spd_sum,
    updated_at = now();
end;
$$;

-- ─── Reading a profile ───────────────────────────────────────────────────────
-- One round trip. Four requests for one screen are four answers that can disagree, and
-- this one sits behind a tap that should feel instant.
--
-- The period bounds go up with the call for the same reason `my_medals` takes its own:
-- the app draws them on the Prague clock (lib/leaderboard-period.ts), and a second
-- definition in SQL is a second thing to keep in step.
--
-- The champion mark is deliberately absent. `useChampions` already knows both Extreme
-- all-time leaders and keeps them live off the board connection; asking again here would
-- let the modal contradict the row that opened it.

create or replace function player_profile(
  p_user_id    uuid,
  p_today      date,
  p_week_since date
) returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nickname', (
      select p.nickname::text from profiles p
      where  p.id = p_user_id and p.nickname is not null
    ),
    'totals', coalesce((
      select json_agg(json_build_object(
        'mode', t.mode, 'difficulty', t.difficulty,
        'runs', t.runs, 'hits', t.hits, 'scoreSum', t.score_sum,
        'accSum', t.acc_sum, 'spdSum', t.spd_sum
      ) order by t.mode, t.difficulty)
      from player_totals t where t.user_id = p_user_id
    ), '[]'::json),
    -- A zero is not a result: `scores` carries a row from the first submit, the same
    -- reason `my_medals` and `past_winners` both filter it out.
    'bests', coalesce((
      select json_agg(json_build_object(
        'mode', s.mode, 'difficulty', s.difficulty,
        'bestScore', s.best_score, 'hits', s.hits, 'achievedAt', s.updated_at
      ) order by s.mode, s.difficulty)
      from scores s where s.user_id = p_user_id and s.best_score > 0
    ), '[]'::json),
    'medals', coalesce((
      select json_agg(json_build_object(
        'mode', m.mode, 'difficulty', m.difficulty, 'period', m.period,
        'rank', m.rank, 'bestScore', m.best_score
      ))
      from my_medals(p_user_id, p_today, p_week_since) m
    ), '[]'::json),
    'reigns', coalesce((
      select json_agg(json_build_object(
        'mode', r.mode, 'difficulty', r.difficulty, 'score', r.score,
        'tookAt', r.took_at, 'lostAt', r.lost_at
      ) order by r.took_at desc)
      from board_reigns r where r.user_id = p_user_id
    ), '[]'::json)
  );
$$;

-- ─── Retiring receipts ───────────────────────────────────────────────────────
-- A replay older than a month is not a retry; it is a bug. Same schedule shape as
-- `cleanup_finished_rooms`, and like it, no client-facing grant — cron runs it as the
-- role that owns the job.

create or replace function cleanup_run_receipts()
returns void language sql security definer set search_path = public as $$
  delete from run_receipts where at < now() - interval '30 days';
$$;

revoke execute on function cleanup_run_receipts() from public;

select cron.schedule(
  'cleanup-run-receipts',
  '20 3 * * *', -- daily, beside the room cleanup and off the app's peak hours
  $$ select cleanup_run_receipts(); $$
);

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- A profile is public: every number in it is either already on a board or an aggregate
-- of runs that were. Nothing here is writable by a client — the counters go through
-- `record_run`, the reigns through their trigger, and the receipts through neither.

grant select on public.player_totals to anon, authenticated;
grant select on public.board_reigns  to anon, authenticated;

grant execute on function public.record_run(uuid, text, text, int, int, double precision, double precision) to authenticated;
grant execute on function public.player_profile(uuid, date, date) to anon, authenticated;

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table player_totals enable row level security;
alter table board_reigns  enable row level security;
alter table run_receipts  enable row level security;

create policy "public read" on player_totals for select using (true);
create policy "public read" on board_reigns  for select using (true);
-- No policy on run_receipts, and none is missing: nothing but the security-definer
-- functions above ever touches it.
