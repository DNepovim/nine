-- What players made of each challenge, for the challenge lab: every **rating** of every
-- session of it, as one count and one plain average.
--
-- Per challenge rather than per session, because the question an admin asks of a rating
-- is "should this come back", and a challenge comes back as a whole. Plain rather than
-- weighted towards the latest airing: there are a handful of airings per challenge, and a
-- weighting nobody can see is a figure nobody can check.
--
-- Totals only, never who said what. `session_ratings` keeps every row from the client on
-- purpose, and an aggregate is the most it gives up — to an admin, and to nobody else.
-- The lab is open to testers too; for them this refuses, and the screen carries on
-- without the line.
create or replace function challenge_ratings()
returns table (mode_id text, ratings int, average numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return query
    select s.mode_id, count(*)::int, round(avg(r.rating), 1)
    from session_ratings r
    join challenge_sessions s on s.id = r.session_id
    group by s.mode_id;
end;
$$;

revoke all on function public.challenge_ratings() from public, anon;
grant execute on function public.challenge_ratings() to authenticated;
