-- Nine leaderboard schema — Phase 2 init
-- Run once against a fresh Supabase project.

-- citext: case-insensitive text for nickname uniqueness
create extension if not exists citext;

-- ─── Tables ────────────────────────────────────────────────────────────────

create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   citext unique,
  created_at timestamptz not null default now()
);

-- All-time best score per player × mode × difficulty
create table scores (
  user_id    uuid not null references profiles (id) on delete cascade,
  mode       text not null check (mode in ('accuracy', 'speed')),
  difficulty text not null check (difficulty in ('easy', 'hard', 'extreme')),
  best_score int  not null default 0,
  hits       int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode, difficulty)
);

-- Per-day best score — backs the TODAY and THIS WEEK leaderboard tabs
create table daily_scores (
  user_id    uuid not null references profiles (id) on delete cascade,
  mode       text not null check (mode in ('accuracy', 'speed')),
  difficulty text not null check (difficulty in ('easy', 'hard', 'extreme')),
  day        date not null default current_date,
  best_score int  not null default 0,
  hits       int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode, difficulty, day)
);

-- ─── Score downgrade guards ─────────────────────────────────────────────────
-- Upsert can overwrite with a lower score if the client sends stale data.
-- These triggers silently keep the existing row when the incoming score is worse.

create or replace function prevent_score_downgrade()
returns trigger language plpgsql as $$
begin
  if new.best_score < old.best_score then return old; end if;
  return new;
end;
$$;

create trigger scores_no_downgrade
  before update on scores
  for each row execute function prevent_score_downgrade();

create trigger daily_scores_no_downgrade
  before update on daily_scores
  for each row execute function prevent_score_downgrade();

-- ─── Auto-create profile on signup ──────────────────────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- RLS policies control which rows are visible; grants control whether the role
-- can touch the table at all. Both are required.

grant select                          on public.profiles     to anon;
grant select, insert, update, delete  on public.profiles     to authenticated;

grant select                          on public.scores       to anon;
grant select, insert, update, delete  on public.scores       to authenticated;

grant select                          on public.daily_scores to anon;
grant select, insert, update, delete  on public.daily_scores to authenticated;

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table profiles     enable row level security;
alter table scores       enable row level security;
alter table daily_scores enable row level security;

create policy "public read"  on profiles     for select using (true);
create policy "own all"      on profiles     for all    using (auth.uid() = id);

create policy "public read"  on scores       for select using (true);
create policy "own all"      on scores       for all    using (auth.uid() = user_id);

create policy "public read"  on daily_scores for select using (true);
create policy "own all"      on daily_scores for all    using (auth.uid() = user_id);

-- ─── Leaderboard RPC ─────────────────────────────────────────────────────────
-- p_since = null → FOREVER (reads scores table)
-- p_since = date → TODAY or THIS WEEK (aggregates daily_scores in window)

create or replace function leaderboard(
  p_mode       text,
  p_difficulty text,
  p_limit      int  default 5,
  p_since      date default null
) returns table (
  rank       bigint,
  user_id    uuid,
  nickname   text,
  best_score int,
  hits       int
) language sql stable security definer as $$
  select
    rank() over (order by s.best_score desc, s.updated_at asc)::bigint,
    s.user_id,
    p.nickname::text,
    s.best_score,
    s.hits
  from (
    select user_id, best_score, hits, updated_at
    from   scores
    where  mode = p_mode and difficulty = p_difficulty and p_since is null

    union all

    select
      user_id,
      max(best_score)                                           as best_score,
      (array_agg(hits order by best_score desc))[1]            as hits,
      max(updated_at)                                           as updated_at
    from   daily_scores
    where  mode = p_mode and difficulty = p_difficulty
      and  p_since is not null and day >= p_since
    group  by user_id
  ) s
  join profiles p on p.id = s.user_id
  where p.nickname is not null
  order by s.best_score desc, s.updated_at asc
  limit p_limit;
$$;

-- ─── My-rank RPC ─────────────────────────────────────────────────────────────

create or replace function my_rank(
  p_user_id    uuid,
  p_mode       text,
  p_difficulty text,
  p_since      date default null
) returns table (
  rank       bigint,
  total      bigint,
  best_score int,
  hits       int
) language sql stable security definer as $$
  with board as (
    select user_id, max(best_score) as best_score
    from (
      select user_id, best_score from scores
      where  mode = p_mode and difficulty = p_difficulty and p_since is null

      union all

      select user_id, max(best_score) as best_score
      from   daily_scores
      where  mode = p_mode and difficulty = p_difficulty
        and  p_since is not null and day >= p_since
      group  by user_id
    ) raw
    join profiles p on p.id = raw.user_id
    where p.nickname is not null
    group by user_id
  )
  select
    (select count(*) + 1 from board where best_score > coalesce((select best_score from board where user_id = p_user_id), -1))::bigint as rank,
    (select count(*) from board)::bigint as total,
    coalesce((select best_score from board where user_id = p_user_id), 0)::int as best_score,
    coalesce((select hits from scores where user_id = p_user_id and mode = p_mode and difficulty = p_difficulty), 0)::int as hits;
$$;

grant execute on function public.leaderboard(text, text, int, date) to anon, authenticated;
grant execute on function public.my_rank(uuid, text, text, date)    to anon, authenticated;
