-- Nine leaderboard seed data
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING / DO UPDATE

do $$
declare
  u1  uuid := '5eed0000-0000-0000-0000-000000000001';
  u2  uuid := '5eed0000-0000-0000-0000-000000000002';
  u3  uuid := '5eed0000-0000-0000-0000-000000000003';
  u4  uuid := '5eed0000-0000-0000-0000-000000000004';
  u5  uuid := '5eed0000-0000-0000-0000-000000000005';
  u6  uuid := '5eed0000-0000-0000-0000-000000000006';
  u7  uuid := '5eed0000-0000-0000-0000-000000000007';
  u8  uuid := '5eed0000-0000-0000-0000-000000000008';
begin

  -- ── Auth users (anonymous) ──────────────────────────────────────────────────
  -- The handle_new_user trigger creates a profile row for each inserted user.
  insert into auth.users
    (id, instance_id, aud, role, is_anonymous, created_at, updated_at,
     last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     true, now() - interval '30 days', now(), now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', '', '', '', ''),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     true, now() - interval '25 days', now(), now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', '', '', '', ''),
    (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     true, now() - interval '20 days', now(), now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', '', '', '', ''),
    (u4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     true, now() - interval '15 days', now(), now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', '', '', '', ''),
    (u5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     true, now() - interval '10 days', now(), now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', '', '', '', ''),
    (u6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     true, now() - interval '7 days', now(), now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', '', '', '', ''),
    (u7, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     true, now() - interval '4 days', now(), now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', '', '', '', ''),
    (u8, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     true, now() - interval '2 days', now(), now(),
     '{"provider":"anonymous","providers":["anonymous"]}', '{}', '', '', '', '')
  on conflict (id) do nothing;

  -- ── Nicknames ───────────────────────────────────────────────────────────────
  update public.profiles set nickname = 'ACE_9'   where id = u1;
  update public.profiles set nickname = 'DOMINO'  where id = u2;
  update public.profiles set nickname = 'SPEEDY'  where id = u3;
  update public.profiles set nickname = 'BLAZE'   where id = u4;
  update public.profiles set nickname = 'NOVA'    where id = u5;
  update public.profiles set nickname = 'KIRO'    where id = u6;
  update public.profiles set nickname = 'PIXEL'   where id = u7;
  update public.profiles set nickname = 'VORTEX'  where id = u8;

  -- ── Mottoes ─────────────────────────────────────────────────────────────────
  -- Four of the eight, deliberately. A profile with no motto is the common case and
  -- has to be as easy to look at in development as one with a motto in it — including
  -- the longest one the column will take, which is where the line wraps.
  update public.profiles set motto = 'I dial faster than I think'                        where id = u1;
  update public.profiles set motto = 'Fifty characters is exactly this long, and no more' where id = u3;
  update public.profiles set motto = 'Here for the extreme boards'                       where id = u5;
  update public.profiles set motto = 'Still chasing that first gold'                     where id = u8;

  -- ── All-time best scores ────────────────────────────────────────────────────
  insert into public.scores (user_id, mode, difficulty, best_score, hits, updated_at) values
    -- accuracy / easy
    (u1, 'accuracy', 'easy', 312, 187, now() - interval '2 days'),
    (u2, 'accuracy', 'easy', 298, 174, now() - interval '3 days'),
    (u3, 'accuracy', 'easy', 271, 161, now() - interval '1 day'),
    (u4, 'accuracy', 'easy', 245, 148, now() - interval '4 days'),
    (u5, 'accuracy', 'easy', 218, 132, now() - interval '5 days'),
    (u6, 'accuracy', 'easy', 196, 119, now() - interval '6 days'),
    (u7, 'accuracy', 'easy', 174, 104, now() - interval '1 day'),
    (u8, 'accuracy', 'easy', 151, 91,  now() - interval '2 days'),
    -- accuracy / hard
    (u1, 'accuracy', 'hard', 267, 143, now() - interval '1 day'),
    (u2, 'accuracy', 'hard', 241, 129, now() - interval '2 days'),
    (u3, 'accuracy', 'hard', 218, 117, now() - interval '3 days'),
    (u4, 'accuracy', 'hard', 194, 104, now() - interval '4 days'),
    (u5, 'accuracy', 'hard', 172, 92,  now() - interval '5 days'),
    (u6, 'accuracy', 'hard', 148, 79,  now() - interval '3 days'),
    -- accuracy / extreme
    (u1, 'accuracy', 'extreme', 198, 97,  now() - interval '1 day'),
    (u2, 'accuracy', 'extreme', 174, 85,  now() - interval '2 days'),
    (u3, 'accuracy', 'extreme', 152, 74,  now() - interval '4 days'),
    (u4, 'accuracy', 'extreme', 131, 64,  now() - interval '5 days'),
    -- speed / easy
    (u1, 'speed', 'easy', 287, 163, now() - interval '1 day'),
    (u2, 'speed', 'easy', 264, 149, now() - interval '2 days'),
    (u3, 'speed', 'easy', 241, 136, now() - interval '3 days'),
    (u4, 'speed', 'easy', 219, 124, now() - interval '4 days'),
    (u5, 'speed', 'easy', 197, 111, now() - interval '5 days'),
    (u6, 'speed', 'easy', 176, 99,  now() - interval '6 days'),
    (u7, 'speed', 'easy', 158, 89,  now() - interval '2 days'),
    (u8, 'speed', 'easy', 137, 77,  now() - interval '1 day'),
    -- speed / hard
    (u1, 'speed', 'hard', 243, 124, now() - interval '2 days'),
    (u2, 'speed', 'hard', 218, 111, now() - interval '3 days'),
    (u3, 'speed', 'hard', 196, 100, now() - interval '4 days'),
    (u4, 'speed', 'hard', 174, 89,  now() - interval '5 days'),
    (u5, 'speed', 'hard', 152, 77,  now() - interval '6 days'),
    -- speed / extreme
    (u1, 'speed', 'extreme', 181, 84,  now() - interval '1 day'),
    (u2, 'speed', 'extreme', 159, 74,  now() - interval '2 days'),
    (u3, 'speed', 'extreme', 138, 64,  now() - interval '3 days'),
    (u4, 'speed', 'extreme', 118, 55,  now() - interval '4 days')
  on conflict (user_id, mode, difficulty)
    do update set best_score = excluded.best_score,
                  hits       = excluded.hits,
                  updated_at = excluded.updated_at;

  -- ── Daily scores (today + past 6 days for THIS WEEK tab) ───────────────────
  insert into public.daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at) values
    -- today
    (u3, 'accuracy', 'easy', current_date,     231, 138, now() - interval '2 hours'),
    (u1, 'accuracy', 'easy', current_date,     218, 131, now() - interval '4 hours'),
    (u7, 'accuracy', 'easy', current_date,     174, 104, now() - interval '1 hour'),
    (u2, 'accuracy', 'easy', current_date,     162, 97,  now() - interval '6 hours'),
    (u5, 'accuracy', 'easy', current_date,     143, 86,  now() - interval '3 hours'),
    (u1, 'speed',    'easy', current_date,     197, 112, now() - interval '5 hours'),
    (u2, 'speed',    'easy', current_date,     184, 104, now() - interval '2 hours'),
    (u3, 'speed',    'easy', current_date,     171, 97,  now() - interval '3 hours'),
    (u1, 'accuracy', 'hard', current_date,     198, 106, now() - interval '3 hours'),
    (u2, 'accuracy', 'hard', current_date,     174, 93,  now() - interval '5 hours'),
    -- yesterday
    (u1, 'accuracy', 'easy', current_date - 1, 298, 179, now() - interval '1 day'),
    (u2, 'accuracy', 'easy', current_date - 1, 271, 163, now() - interval '1 day'),
    (u4, 'accuracy', 'easy', current_date - 1, 218, 131, now() - interval '1 day'),
    (u1, 'speed',    'easy', current_date - 1, 264, 149, now() - interval '1 day'),
    (u3, 'speed',    'easy', current_date - 1, 219, 124, now() - interval '1 day'),
    -- 2 days ago
    (u1, 'accuracy', 'easy', current_date - 2, 312, 187, now() - interval '2 days'),
    (u2, 'accuracy', 'easy', current_date - 2, 254, 152, now() - interval '2 days'),
    (u6, 'accuracy', 'easy', current_date - 2, 196, 118, now() - interval '2 days'),
    (u8, 'speed',    'easy', current_date - 2, 137, 77,  now() - interval '2 days'),
    -- 3 days ago
    (u2, 'accuracy', 'easy', current_date - 3, 287, 172, now() - interval '3 days'),
    (u3, 'accuracy', 'easy', current_date - 3, 251, 150, now() - interval '3 days'),
    (u1, 'speed',    'hard', current_date - 3, 243, 124, now() - interval '3 days'),
    -- 4 days ago
    (u1, 'accuracy', 'easy', current_date - 4, 276, 165, now() - interval '4 days'),
    (u4, 'speed',    'easy', current_date - 4, 219, 124, now() - interval '4 days'),
    -- 5 days ago
    (u5, 'accuracy', 'easy', current_date - 5, 218, 131, now() - interval '5 days'),
    (u2, 'speed',    'hard', current_date - 5, 218, 111, now() - interval '5 days'),
    -- 6 days ago
    (u6, 'accuracy', 'easy', current_date - 6, 196, 118, now() - interval '6 days'),
    (u3, 'speed',    'easy', current_date - 6, 241, 136, now() - interval '6 days')
  on conflict (user_id, mode, difficulty, day)
    do update set best_score = excluded.best_score,
                  hits       = excluded.hits,
                  updated_at = excluded.updated_at;

  -- ── Lifetime counters ───────────────────────────────────────────────────────
  -- What the profile modal's RUNS / HITS / TIME / AVG ACC / AVG SPD are read from, and
  -- now also what every nickname in the app is coloured by — see lib/name-gradient.ts.
  -- Without these the seed has eight players whose averages are all null, which reads on
  -- screen as a board of grey names and a profile full of dashes.
  --
  -- `acc_sum` and `spd_sum` are sums over hits, never averages: each row is written as
  -- `hits × the factor this player plays at`, so their career average comes out at that
  -- factor exactly however the rows are combined. That is the same shape `record_run`
  -- accumulates, so nothing here is a special case the real writer could not produce.
  --
  -- The eight are spread deliberately rather than realistically. The pair is a two-axis
  -- design space, and a seed clustered in the middle of it would make every name the
  -- same colour and hide exactly what wants looking at:
  --
  --   ACE_9  94/91  vivid at both ends      DOMINO 96/42  exact and slow
  --   SPEEDY 51/104 quick and rough         BLAZE  68/66  unremarkable at both
  --   NOVA   44/38  thin                    KIRO   88/57  accuracy player
  --   PIXEL  33/29  nearly colourless       VORTEX 61/117 past the fast band
  --
  -- VORTEX is over 100 on purpose: `speedReward` pays above the fast band and
  -- `averagePercent` deliberately does not clamp, so a real player can exceed it and the
  -- colour has to stop at the hue rather than overshoot into something else.
  insert into public.player_totals
    (user_id, mode, difficulty, runs, hits, score_sum, acc_sum, spd_sum, time_ms) values
    (u1, 'accuracy', 'easy', 16, 187, 3184, 175.78, 170.17, 1520000),
    (u1, 'speed',    'easy',  9, 112, 1893, 105.28, 101.92,  855000),
    (u2, 'accuracy', 'easy', 15, 174, 2961, 167.04,  73.08, 1425000),
    (u2, 'speed',    'easy',  9, 104, 1768,  99.84,  43.68,  855000),
    (u3, 'accuracy', 'easy', 13, 161, 2737,  82.11, 167.44, 1235000),
    (u3, 'speed',    'easy',  8,  97, 1649,  49.47, 100.88,  760000),
    (u4, 'accuracy', 'easy', 12, 148, 2516, 100.64,  97.68, 1140000),
    (u4, 'speed',    'easy', 10, 124, 2108,  84.32,  81.84,  950000),
    (u5, 'accuracy', 'easy', 11, 132, 2244,  58.08,  50.16, 1045000),
    (u5, 'speed',    'easy',  7,  86, 1462,  37.84,  32.68,  665000),
    (u6, 'accuracy', 'easy', 10, 119, 2023, 104.72,  67.83,  950000),
    (u6, 'speed',    'easy', 10, 118, 2006, 103.84,  67.26,  950000),
    (u7, 'accuracy', 'easy',  9, 104, 1768,  34.32,  30.16,  855000),
    (u7, 'speed',    'easy',  6,  77, 1309,  25.41,  22.33,  570000),
    (u8, 'accuracy', 'easy',  8,  91, 1547,  55.51, 106.47,  760000),
    (u8, 'speed',    'easy',  6,  77, 1309,  46.97,  90.09,  570000)
  on conflict (user_id, mode, difficulty)
    do update set runs      = excluded.runs,
                  hits      = excluded.hits,
                  score_sum = excluded.score_sum,
                  acc_sum   = excluded.acc_sum,
                  spd_sum   = excluded.spd_sum,
                  time_ms   = excluded.time_ms;

end $$;
