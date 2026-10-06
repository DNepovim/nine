-- The admin person search is case-sensitive, and the column it searches is not.
--
-- `profiles.nickname` is `citext`, so the unique index folds case: once somebody holds
-- `ACE_9`, nobody else can take `ace_9`. ...feature_flags.sql leaned on that — "`nickname`
-- is `citext unique`, so at most one row can ever answer" — and then wrote the lookup as
-- `where p.nickname = p_nickname`, with `p_nickname` declared `text`. The claim about the
-- index is true. The query does not inherit it.
--
-- `=` is resolved by argument type, and neither candidate matches `(citext, text)`
-- outright. `=(citext, citext)` would need `text` → `citext`, a cast citext registers as
-- ASSIGNMENT, which operator resolution does not consider; `=(text, text)` needs
-- `citext` → `text`, which is IMPLICIT. So the text operator wins and the comparison is
-- the ordinary byte-for-byte one:
--
--   'ACE'::citext = 'ace'        → true    -- unknown literal, resolved as citext
--   'ACE'::citext = 'ace'::text  → false   -- what the function body actually ran
--
-- The effect is one screen behaving as though a name were missing: an admin looking up a
-- player they had seen written down got no row back unless they reproduced the capitals,
-- while every other reader of `nickname` — the boards, the announcements, the profile —
-- was unaffected, because none of them compares one.
--
-- Casting the parameter rather than lowering both sides: `::citext` is what the column
-- already is, so the comparison becomes the one the unique index enforces, and the index
-- can still answer it. `lower(p.nickname) = lower(p_nickname)` would agree on the result
-- and scan the table to reach it.
--
-- Restated in full, `set search_path = public` included: `create or replace function`
-- drops every attribute the new declaration does not spell out.
create or replace function admin_find_person(p_nickname text)
returns table (id uuid, nickname text, role text, feature_count int, has_overrides boolean)
language sql stable set search_path = public as $$
  select p.id,
         p.nickname::text,
         p.role,
         (select count(*)::int from effective_features(p.id)),
         exists (select 1 from user_features uf where uf.user_id = p.id)
  from profiles p
  where p.nickname = p_nickname::citext;
$$;
