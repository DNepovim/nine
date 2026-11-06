-- Only someone who played the last challenge may vote on the next one.
--
-- "The last challenge" is the latest session that has opened — the live one while there is
-- one, else the one that closed most recently — and "played" is a row on its board, the
-- same fact `session_scores` already keeps. Everyone still sees the options and the counts;
-- `can_vote` says whether the caller may take part, and `vote_next` refuses when they may
-- not, so the answer is the server's and not the dialog's.
--
-- Votes already cast are left standing.

drop function if exists public.next_vote_options();

create or replace function next_vote_options()
returns table (session_id uuid, mode_id text, votes int, mine boolean, can_vote boolean)
language sql stable security definer set search_path = public as $$
  with pair as (
    select id, mode_id, opens_at from challenge_sessions
     where opens_at > now()
     order by opens_at, created_at
     limit 2
  ),
  last_opened as (
    select id from challenge_sessions
     where opens_at <= now()
     order by opens_at desc, created_at desc
     limit 1
  )
  select p.id, p.mode_id,
         (select count(*)::int from next_votes v where v.session_id = p.id),
         exists (
           select 1 from next_votes v where v.session_id = p.id and v.user_id = auth.uid()
         ),
         exists (
           select 1 from session_scores s
            where s.session_id = (select id from last_opened) and s.user_id = auth.uid()
         )
    from pair p
   where (select count(*) from pair) = 2
   order by p.opens_at;
$$;

revoke all on function public.next_vote_options() from public, anon;
grant execute on function public.next_vote_options() to authenticated;

create or replace function vote_next(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'vote_next: not signed in';
  end if;
  perform lock_challenge_queue();
  if not exists (select 1 from next_vote_options() o where o.session_id = p_session) then
    raise exception 'vote_next: that session is not up for a vote';
  end if;
  if not exists (
    select 1 from next_vote_options() o where o.session_id = p_session and o.can_vote
  ) then
    raise exception 'vote_next: only players of the last challenge may vote';
  end if;
  insert into next_votes (user_id, session_id)
  values (auth.uid(), p_session)
  on conflict (user_id)
  do update set session_id = excluded.session_id, voted_at = now();
  perform settle_next_vote();
end;
$$;

revoke all on function public.vote_next(uuid) from public, anon;
grant execute on function public.vote_next(uuid) to authenticated;
