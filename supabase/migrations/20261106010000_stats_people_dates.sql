-- The dates behind the analytics lists: when each player joined, when they named themselves,
-- and when they last played.
--
-- A tile opens the players its figure is made of (`admin_stats_people`); until now a row
-- carried a name and a count, so "who joined this week" could not say on which day. The
-- days go out as bare Prague dates — the same clock the window is cut on — so the app
-- prints them without a time zone to get wrong.
--
-- **`profiles.named_at`** is new: the database kept `created_at` and nothing for the moment
-- a nickname was set, and a profile is made nameless on first open and named later. It is
-- stamped by a trigger, from now on. Profiles named before this migration stay null — the
-- date was never kept, and a guess would read as fact — and the screen shows a dash.

alter table profiles add column named_at timestamptz;

create or replace function profiles_stamp_named_at()
returns trigger language plpgsql as $$
begin
  if new.nickname is null then
    new.named_at := null;
  elsif tg_op = 'INSERT' or old.nickname is null then
    new.named_at := now();
  else
    -- Renaming is not naming: the date a profile first got its nickname stands, and nobody
    -- can write a date of their own over it.
    new.named_at := old.named_at;
  end if;
  return new;
end;
$$;

create trigger profiles_named_at
  before insert or update on profiles
  for each row execute function profiles_stamp_named_at();

-- The return type changes, so the function is dropped and made again. Internal, as before:
-- not granted to anybody; `admin_stats` and `admin_stats_people` check `admin` themselves.
drop function if exists admin_stats_rows(date, date);

create function admin_stats_rows(p_from date, p_to date)
returns table (
  user_id        uuid,
  nickname       text,
  joined         boolean,
  runs           bigint,
  hits           bigint,
  elapsed_ms     bigint,
  joined_on      date,
  named_on       date,
  last_played_on date
)
language sql
stable
security definer
set search_path = public
as $$
  with admins as (
    select p.id
    from   profiles p
    where  (p.role is not null
            or exists (select 1 from user_features uf where uf.user_id = p.id))
      and  has_feature(p.id, 'admin')
  ),
  played as (
    select r.user_id,
           count(*)                       as runs,
           coalesce(sum(r.hits), 0)       as hits,
           coalesce(sum(r.elapsed_ms), 0) as elapsed_ms,
           (max(r.at) at time zone 'Europe/Prague')::date as last_on
    from   run_receipts r
    where  (r.at at time zone 'Europe/Prague')::date between p_from and p_to
      and  r.user_id not in (select id from admins)
    group  by r.user_id
  )
  select p.id,
         p.nickname,
         (p.created_at at time zone 'Europe/Prague')::date between p_from and p_to,
         coalesce(r.runs, 0),
         coalesce(r.hits, 0),
         coalesce(r.elapsed_ms, 0)::bigint,
         (p.created_at at time zone 'Europe/Prague')::date,
         (p.named_at at time zone 'Europe/Prague')::date,
         r.last_on
  from   profiles p
  left   join played r on r.user_id = p.id
  where  r.user_id is not null
     or  (p.created_at at time zone 'Europe/Prague')::date between p_from and p_to;
$$;

revoke all on function public.admin_stats_rows(date, date) from public, anon, authenticated;

create or replace function admin_stats_people(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_stats_people: not an admin';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id',        w.user_id,
             'nickname',       w.nickname,
             'joined',         w.joined,
             'runs',           w.runs,
             'hits',           w.hits,
             'elapsed_ms',     w.elapsed_ms,
             'joined_on',      w.joined_on,
             'named_on',       w.named_on,
             'last_played_on', w.last_played_on
           )), '[]'::jsonb)
    from admin_stats_rows(p_from, p_to) w
  );
end;
$$;

revoke all on function public.admin_stats_people(date, date) from public;
grant execute on function public.admin_stats_people(date, date) to authenticated;
