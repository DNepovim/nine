-- A **rating**: one player's 1–9 answer to "how was this one?" for one session they
-- played, asked once on the intro straight after that session's summary.
--
-- Per **session**, not per challenge, for the reason the standings are: a challenge aired
-- twice is two contests, and an opinion of the first airing is not an opinion of the
-- second. Rolling sessions up to the challenge they ran is a query over this table, not a
-- shape it has to have.
--
-- Nothing in the app reads it yet. It is written here and read with SQL, which is why
-- there is no select policy at all: one player's opinion is nobody else's business until
-- a screen that shows an aggregate decides what it may say.
--
-- Not the **fortune**, which is "never a rating" — that one is points, this one is a
-- player's view of a contest, and it pays nothing and orders nothing.

create table session_ratings (
  session_id uuid     not null references challenge_sessions (id) on delete cascade,
  user_id    uuid     not null references profiles (id)           on delete cascade,
  rating     smallint not null check (rating between 1 and 9),
  rated_at   timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table session_ratings enable row level security;

-- The only way in. Refuses a session still open, and anybody without a score on it — the
-- dialog is only ever offered to somebody who was told its summary, and being told one
-- *is* having a `session_scores` row, so a rating from anybody else is a rating of a
-- contest they never entered. A second call overwrites the first: one row per player per
-- session, and the latest answer is the answer.
create or replace function rate_session(p_session uuid, p_rating int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'rate_session: not signed in';
  end if;
  if p_rating is null or p_rating not between 1 and 9 then
    raise exception 'rate_session: a rating is 1 to 9, got %', p_rating;
  end if;
  if not exists (
    select 1 from session_scores where session_id = p_session and user_id = auth.uid()
  ) then
    raise exception 'rate_session: no score on that session';
  end if;
  -- And only once it has closed: the question is asked after the summary, and a summary is
  -- only ever told about a contest that is over.
  if not exists (
    select 1 from challenge_sessions where id = p_session and closes_at <= now()
  ) then
    raise exception 'rate_session: that session has not closed';
  end if;
  insert into session_ratings (session_id, user_id, rating)
  values (p_session, auth.uid(), p_rating)
  on conflict (session_id, user_id)
  do update set rating = excluded.rating, rated_at = now();
end;
$$;

revoke all on function public.rate_session(uuid, int) from public, anon;
grant execute on function public.rate_session(uuid, int) to authenticated;

-- The feature, hidden: the `nobody` floor while it is off the app. Seeded into the three
-- stacks the challenge lab and Czech sit in, so making it private is the whole of turning
-- it on for testers.
insert into features (key, note, visibility) values
  ('ratings',
   'The dialog after a session''s summary that asks the player to rate the challenge 1 to 9. Needs `challenges` too: without it no summary is ever told, so nothing is ever asked.',
   'hidden');

insert into role_features (role_key, feature_key) values
  ('tester',    'ratings'),
  ('developer', 'ratings'),
  ('admin',     'ratings');
