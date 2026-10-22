-- Who a private feature reaches, by name: the roles whose stack holds it, and the people
-- who end up with it — each saying whether that came from their role's stack or from an
-- override of their own.
--
-- The FEATURES list gives two counts per row, roles and people, and a count is where the
-- next question starts: *which* three people? Answering it meant opening every role, then
-- every person with overrides, and doing the resolve by eye. This is that resolve, for one
-- feature, written down once.
--
-- Not guarded, for the reason …_feature_flags.sql gives for every read beside it: a
-- `stable` function over tables every client can already select. It names people, but
-- only by the nickname their profile already shows on every board.
--
-- Scoped to the roled population, the way `feature_stats` counts it: somebody with no
-- role and no override reaches a private feature by no road at all, and asking
-- `has_feature` of the whole of `profiles` per visit would be a scan for nothing. A
-- hidden or public feature gets the same answer it would anyway — nobody, or everybody
-- the screen does not try to list — so the client asks only for private ones.
--
-- `via` is read in the resolve's own order: an override wins in either direction, so a
-- person who reaches the feature and has a row for it reached it by that row; anybody
-- else who reaches a private one reached it through the stack. The role is returned
-- either way, because "override, on top of TESTER" is a thing worth reading.
--
-- `jsonb` rather than two row sets, the way `admin_stats` returns one: the screen draws
-- both tables at once and they are one answer.
create or replace function feature_reach(p_key text)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', r.key,
               'label', r.label,
               'person_count', (select count(*)::int from profiles p where p.role = r.key)
             ) order by r.label)
        from roles r
        join role_features rf on rf.role_key = r.key and rf.feature_key = p_key
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'nickname', p.nickname::text,
               'role_label', r.label,
               'via', case when uf.granted is null then 'role' else 'override' end
             ) order by p.nickname)
        from profiles p
        left join roles r on r.key = p.role
        left join user_features uf on uf.user_id = p.id and uf.feature_key = p_key
       where (p.role is not null
              or exists (select 1 from user_features o where o.user_id = p.id))
         and has_feature(p.id, p_key)
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.feature_reach(text) to authenticated;
