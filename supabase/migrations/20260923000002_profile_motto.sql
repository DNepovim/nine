-- The player's motto — one line they write about themselves, under their nickname.
--
-- Every other figure on a profile is something the player did: a score, a count, a
-- standing. This is the one thing they get to say. Fifty characters, because a motto is
-- a line and not a paragraph — long enough for a sentence, short enough that it cannot
-- push the medals off the first screenful of the modal.
--
-- On `profiles` rather than a table of its own: it is one nullable column about one
-- player, the same shape and the same lifecycle as their nickname, and it is read on
-- every profile open. A second table would be a second join for a single short string.

alter table profiles add column motto text;

-- The shape, stated where it cannot be talked out of. Null is a player with no motto;
-- an empty or blank one is not a third state, it is how a motto is removed, and the
-- client writes null for that.
--
-- No control characters: a motto is drawn as a single line beside a nickname, and a
-- newline in it would silently change the height of every profile card it appears on.
-- `{1,50}` counts characters, not bytes — the same unit `mottoLength` counts in
-- (lib/motto.ts), so an emoji costs one here and one there.
--
-- Content is not this constraint's business. It guards the shape of the column, which is
-- the part that can corrupt a screen; what a motto says is a question for a person.
alter table profiles add constraint profiles_motto_shape check (
  motto ~ '^[^[:cntrl:]]{1,50}$' and btrim(motto) <> ''
);

-- No new grant and no new policy. `profiles` already carries `grant select, insert,
-- update, delete ... to authenticated` with an `own all` row policy behind it, which is
-- exactly how the nickname beside it is written — a player may edit their own row and
-- no one else's, and a new column on that row inherits both.

-- ─── Reading a profile ───────────────────────────────────────────────────────
-- Everything but `motto` is the previous definition unchanged.
--
-- Gated on the nickname for the same reason the nickname itself is: a player with no
-- name is on no board, cannot be tapped, and has no profile for a motto to appear on.

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
    ), '[]'::json)
  );
$$;

grant execute on function public.player_profile(uuid, date, date) to anon, authenticated;
