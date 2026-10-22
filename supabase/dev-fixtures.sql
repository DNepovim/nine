-- Local dev fixtures: the state that has to be true for the app to be worth looking at,
-- but that no migration and no seed may contain.
--
-- Applied **after** a reset rather than during one, and that is the whole design. The
-- SQL tests assert the shipped defaults — `features.sql` pins `challenges` and
-- `multiplayer` to hidden, and needs a profile with no role at all to prove that a
-- roleless player reaches nothing — so putting any of this in `seed.sql` would make
-- `pnpm db:test` fail on its own fixtures. The seed is what the tests read; this is what
-- a person reads.
--
-- Re-runnable: every statement is an upsert, an idempotent update, or guarded by
-- `if not exists`.
--
-- **Never reaches production.** `supabase db push` applies migrations and does not run
-- this file, and the guard below refuses to do anything unless the database carries the
-- well-known local JWT secret — so even `supabase db reset --linked`, which would be a
-- catastrophe for other reasons, cannot flip a production feature switch from here.

-- Whether this is the local stack. The dev secret is fixed and public (it is in every
-- Supabase CLI install); production's is not, which is exactly what makes it a guard.
create or replace function public.is_local_stack() returns boolean
  language sql stable set search_path = public as $dev$
  select coalesce(current_setting('app.settings.jwt_secret', true), '')
       = 'super-secret-jwt-token-with-at-least-32-characters-long'
$dev$;

-- The trigger that names and promotes a real sign-in now lives in `seed.sql`, so it
-- survives a raw `supabase db reset` and not only `pnpm db:reset`. What is left here is
-- the catch-up for a profile that already existed when the trigger was installed, which
-- a trigger on insert can never reach.

do $dev$
declare
  u1 uuid := '5eed0000-0000-0000-0000-000000000001';
  u3 uuid := '5eed0000-0000-0000-0000-000000000003';
  u5 uuid := '5eed0000-0000-0000-0000-000000000005';
  live   uuid := '5e551011-0000-0000-0000-000000000001';
  teased uuid := '5e551011-0000-0000-0000-000000000002';
  n_admin int;
begin
  if not public.is_local_stack() then
    raise notice 'dev-fixtures: not the local stack — nothing applied';
    return;
  end if;

  -- ── Every feature private rather than hidden ───────────────────────────────
  -- The stack already grants these at all three rungs; only the switch is at hidden,
  -- because shipping them further is a decision for the admin screen rather than for a
  -- migration. Locally there is nobody to decide, and a door that cannot be opened is
  -- the same as no door.
  --
  -- Private, not public: an admin profile below reaches everything through its stack
  -- anyway, and making the lot public here would take away the one thing these fixtures
  -- exist to show — what an ordinary player sees.
  update public.features set visibility = 'private' where visibility = 'hidden';

  -- ── A profile that can open them ────────────────────────────────────────────
  -- Three of the eight, not all: `features.sql` is not the only reader that wants a
  -- roleless profile to look at, and an app where every name is an admin stops showing
  -- what an ordinary player sees.
  update public.profiles set role = 'admin'     where id = u1;
  update public.profiles set role = 'developer'  where id = u3;
  update public.profiles set role = 'tester'     where id = u5;

  -- And a name to go with it. The tests null nicknames as they run, and a session leader
  -- without one is not drawn as a leader at all — `open_sessions_with_leaders` joins the
  -- name and has nothing to print, so the top score silently loses the card to whoever
  -- is second with a name. That is how the fixture's own 2480 came to read as 1960.
  --
  -- `nickname` is unique, so a name already taken by somebody else is left alone rather
  -- than failing the whole file: the only cost is one unnamed leader, and the alternative
  -- is fixtures that refuse to apply because a test parked 'ACE_9' somewhere.
  update public.profiles p set nickname = v.name
    from (values (u1, 'ACE_9'), (u3, 'SPEEDY'), (u5, 'NOVA')) as v(id, name)
   where p.id = v.id
     and coalesce(p.nickname, '') <> v.name
     and not exists (
       select 1 from public.profiles o where o.nickname = v.name and o.id <> v.id);

  -- ── Something to actually see ───────────────────────────────────────────────
  -- One session live now and one teased for tomorrow, which is the pair that makes the
  -- intro card show both of its faces. Relative to `now()`, so the fixtures are never
  -- stale however long the stack has been up — a session pinned to a literal timestamp
  -- is a session that has expired by the time anybody looks at it.
  --
  -- Eight hours rather than a day: long enough to not shut mid-session, short enough
  -- that the countdown on the card reads as a clock rather than as a constant.
  insert into public.challenge_sessions (id, mode_id, opens_at, closes_at) values
    (live,   'challenge/four-keys', now() - interval '2 hours', now() + interval '6 hours'),
    (teased, 'challenge/four-keys', now() + interval '1 day',   now() + interval '2 days')
  on conflict (id) do update
    set opens_at = excluded.opens_at, closes_at = excluded.closes_at;

  -- A board on the live one, so the card has a leader to name and the modal is not drawn
  -- in its empty state. `do nothing` rather than `do update`: `session_scores` carries a
  -- no-downgrade trigger, and re-running this file must not look like a player posting
  -- a worse run.
  insert into public.session_scores
    (session_id, user_id, best_score, hits, difficulty, updated_at) values
    (live, u1, 2480, 19, 'hard', now() - interval '41 minutes'),
    (live, u3, 1960, 15, 'hard', now() - interval '26 minutes'),
    (live, u5,  830,  7, 'hard', now() - interval '9 minutes')
  on conflict (session_id, user_id) do nothing;

  -- ── Messages in every state the MESSAGES screen tells apart ─────────────────
  -- Without these the screen opens on *Nothing is waiting for an answer* and every chip,
  -- filter and button on it goes unseen. One row per state the screen draws differently:
  -- owed (two, one long enough to need opening), owed from a removed profile, answered
  -- and still in the post, answered and seen, answered and waiting for a build, and set
  -- aside.
  --
  -- Inserted with their stamps already in place: `stamp_feedback_answer` fires on an
  -- update of `answer` and not on an insert, so `answered_at` and `answer_seen_at` are
  -- taken as written. `do update` puts every state back on a re-run — a message answered
  -- or set aside while clicking around returns to what it is here. The update leaves
  -- `answer` equal to what is already there, so the trigger has nothing to restamp.
  insert into public.feedback
    (id, user_id, message, mode, difficulty, score, build, created_at,
     answer, answered_at, answer_seen_at, answer_needs_build, dismissed_at) values
    ('5eedfeed-0000-0000-0000-000000000001', u3,
     'The ring on the last target froze for a second when the next one appeared.',
     'speed', 'hard', 1840, '261020.0915', now() - interval '3 hours',
     null, null, null, null, null),
    ('5eedfeed-0000-0000-0000-000000000002', u5,
     E'Love the game! Two things though.\n\nFirst, on Extreme the fourth target sometimes '
     'lands right on top of the score, so I cannot read it. Second, could the swipe left '
     'gesture be a bit less sensitive? I keep triggering it when I mean to press a key '
     'near the edge of the dial, and it costs me the strike every time.',
     'accuracy', 'extreme', 3120, '261020.0915', now() - interval '1 day',
     null, null, null, null, null),
    ('5eedfeed-0000-0000-0000-000000000003', null,
     'How do I change my nickname?',
     'trainee', 'easy', 0, '261018.1200', now() - interval '2 days',
     null, null, null, null, null),
    ('5eedfeed-0000-0000-0000-000000000004', u1,
     'Speed on Easy feels slower than it used to.',
     'speed', 'easy', 960, '261017.0800', now() - interval '3 days',
     'It is the same clock as before — Easy gives each target about 21 seconds. Thanks for checking!',
     now() - interval '5 hours', null, null, null),
    ('5eedfeed-0000-0000-0000-000000000005', u3,
     'Is there a dark mode?',
     'accuracy', 'hard', 1410, '261015.1000', now() - interval '6 days',
     'Not yet, but it is on the list.',
     now() - interval '5 days', now() - interval '4 days', null, null),
    ('5eedfeed-0000-0000-0000-000000000006', u5,
     'The game over screen stays blank after a long run.',
     'speed', 'extreme', 2780, '261019.1400', now() - interval '2 days',
     'Thanks — fixed, it will be in the next update.',
     now() - interval '1 day', null, '261021.0900', null),
    ('5eedfeed-0000-0000-0000-000000000007', u1,
     'asdf',
     'trainee', 'easy', 0, '261016.0900', now() - interval '8 days',
     null, null, null, null, now() - interval '7 days')
  on conflict (id) do update
    set user_id            = excluded.user_id,
        message            = excluded.message,
        created_at         = excluded.created_at,
        answer             = excluded.answer,
        answered_at        = excluded.answered_at,
        answer_seen_at     = excluded.answer_seen_at,
        answer_needs_build = excluded.answer_needs_build,
        dismissed_at       = excluded.dismissed_at;

  -- ── The person at the keyboard, if they are already here ───────────────────
  -- The trigger in `seed.sql` catches a sign-in as it happens. This catches the other
  -- case: a device profile created before the trigger existed, or one whose nickname a
  -- test nulled out from under it. Seeded ids are excluded for the same reason the
  -- trigger excludes them — `features.sql` needs a profile with no role.
  update public.profiles
     set role     = coalesce(role, 'admin'),
         nickname = coalesce(nickname, public.dev_nickname(id))
   where id::text not like '5eed0000-%'
     and (role is null or nickname is null);

  select count(*) into n_admin from public.profiles where role is not null;

  raise notice 'dev-fixtures: % features reachable, % profiles with a role, 1 live session + 1 teaser, 7 messages',
    (select count(*) from public.features where visibility <> 'hidden'), n_admin;
  raise notice 'dev-fixtures: new sign-ins get a DEV_ nickname and admin automatically';
end
$dev$;
