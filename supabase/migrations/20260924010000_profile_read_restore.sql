-- Three things a profile knew, put back.
--
-- `player_profile` is built with `create or replace`, so each migration that touches it
-- restates the whole function. `…_winnings.sql` restated it from a copy that predated
-- three of them, and silently dropped what they had added:
--
--   * `motto`        — the line the player writes about themselves (…_profile_motto)
--   * `achievements` — how many they hold                          (…_profile_achievements)
--   * `timeMs`       — how long each board has been played         (…_profile_time)
--
-- Nothing failed. The app reads all three as optional, because a device can be talking to
-- a server older than its own build — so a motto came back absent rather than wrong, and
-- was drawn as a player who had never written one. It was in the column the whole time.
--
-- This is the union of every version: winnings kept, the three restored. Whoever restates
-- this function next: start from *this* definition, not from the migration that first
-- added whatever you are adding.

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
    -- Gated on the nickname for the same reason the nickname itself is: a player with no
    -- name is on no board, cannot be tapped, and has no profile for a motto to appear on.
    'motto', (
      select p.motto from profiles p
      where  p.id = p_user_id and p.nickname is not null
    ),
    'achievements', (
      select count(distinct a.achievement_id) from achievements a where a.user_id = p_user_id
    ),
    'totals', coalesce((
      select json_agg(json_build_object(
        'mode', t.mode, 'difficulty', t.difficulty,
        'runs', t.runs, 'hits', t.hits, 'scoreSum', t.score_sum,
        'accSum', t.acc_sum, 'spdSum', t.spd_sum, 'timeMs', t.time_ms
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
    ), '[]'::json),
    'winnings', coalesce((
      select json_agg(json_build_object(
        'mode', w.mode, 'difficulty', w.difficulty,
        'daySum', w.day_sum, 'weekSum', w.week_sum
      ) order by w.mode, w.difficulty)
      from (
        select m.mode, m.difficulty,
               coalesce(sum(m.best_score) filter (where m.period = 'day'), 0)  as day_sum,
               coalesce(sum(m.best_score) filter (where m.period = 'week'), 0) as week_sum
        from   my_winnings(
                 p_user_id,
                 coalesce((select min(d.day) from daily_scores d), p_today),
                 p_today
               ) m
        group  by m.mode, m.difficulty
      ) w
    ), '[]'::json)
  );
$$;

-- Unchanged signature, so the existing grant still stands. Restated because a
-- `create or replace` that ever changes the argument list would silently leave the old
-- function — and its grant — in place beside the new one.
grant execute on function public.player_profile(uuid, date, date) to anon, authenticated;
