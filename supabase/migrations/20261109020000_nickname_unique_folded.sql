-- A nickname is one name however it is cased or accented.
--
-- `profiles.nickname` is `citext unique`, which folds case and nothing else: `Ján` and
-- `Jan` were two names, so a player could take the name of another with one accent swapped
-- for its plain letter — two rows on a board that read the same at a glance. The rule is
-- now that a name is its letters with case and diacritics taken off.
--
-- A second unique index rather than a change to the column. The column stays `citext`, so
-- every comparison already written against it (`admin_find_person`, the profile reads)
-- keeps meaning what it meant; this only adds the stricter question at write time. The
-- client needs nothing: a clash is still a unique violation, which it already reads as
-- "taken".
--
-- `unaccent` is stable, not immutable, because its dictionary can be changed — and an
-- index expression must be immutable. The wrapper pins the one dictionary the app means
-- and says so, the standard way round it. `search_path` is set on it so it resolves the
-- extension the same way from every caller.

create extension if not exists unaccent with schema extensions;

create or replace function public.nickname_key(p_nickname text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_nickname))
$$;

-- Names already held that the new rule calls one. The index cannot be built over them, and
-- picking which of two players keeps a name is not the migration's decision — it stops
-- here and says who, so somebody can.
do $$
declare
  clash text;
begin
  select string_agg(names, '; ')
    into clash
    from (
      select string_agg(nickname::text, ', ' order by nickname::text) as names
        from profiles
       where nickname is not null
       group by public.nickname_key(nickname::text)
      having count(*) > 1
    ) clashes;
  if clash is not null then
    raise exception 'nicknames that are one name once case and accents are folded: %', clash;
  end if;
end
$$;

create unique index profiles_nickname_folded_key
  on profiles (public.nickname_key(nickname::text))
  where nickname is not null;
