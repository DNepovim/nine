-- The day a player joined, for the line under their name on the profile.
--
-- Until now the profile drew a constant — the day profiles shipped — for everybody, so a
-- player who joined yesterday read "joined a month ago" while the analytics, which reads
-- `profiles.created_at`, said yesterday. This is that same column, on the same Prague
-- clock `admin_stats_rows` counts a join on, so the two can no longer disagree.
--
-- Its own function beside `player_last_run`, for the reason that one gave. Gated on the
-- nickname like the rest of the profile.
create or replace function player_joined_on(p_user_id uuid)
returns date language sql stable security definer set search_path = public as $$
  select (p.created_at at time zone 'Europe/Prague')::date
  from   profiles p
  where  p.id = p_user_id and p.nickname is not null;
$$;

grant execute on function public.player_joined_on(uuid) to anon, authenticated;
