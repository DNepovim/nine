-- A nickname is three to ten characters, down from sixteen.
--
-- Ten is what every row that carries a name is already sized for: the announcement bar cuts
-- a rival's name to ten, and the summary podium sets one in type half as large again as a
-- row's. Sixteen was a limit nothing was drawn for.
--
-- The same check as `profiles_nickname_shape` with the one number changed, and `not valid`
-- for the reason that one was: it guards writes from here on without the migration failing
-- on a name of eleven to sixteen characters somebody already holds. Such a name keeps
-- working until its owner next updates the row, which is when it is checked and has to be
-- shortened. The emoji ranges mirror `EMOJI_RANGES` in lib/nickname.ts, as before.

alter table profiles drop constraint profiles_nickname_shape;

alter table profiles add constraint profiles_nickname_shape check (
  nickname is null
  or (
    char_length(nickname::text) between 3 and 10
    and nickname::text !~
      '[←-➿⬀-⯿️\U0001F000-\U0001FAFF]'
  )
) not valid;
