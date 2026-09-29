-- No emoji in a nickname.
--
-- The modal has always turned one down — its rule is an allowlist of letters, digits and
-- the underscore, and a picture is none of those — but the modal is the client, and a
-- player's own row is theirs to update through the API with whatever a hand-rolled
-- request cares to put in it. A name is the one string this app repeats everywhere: the
-- board, the announcement bar, a rival line, a profile header. Every one of those is a
-- fixed-height row sized for characters, and an emoji is taller than one.
--
-- Stated as a denylist rather than the client's allowlist on purpose. `[[:alpha:]]` is
-- whatever the database's ctype says it is, and on a C-locale database that is ASCII —
-- which would reject `Ján`, a name the client accepts and someone is actually called.
-- Naming the pictographs instead cannot misfire that way: the ranges mean the same thing
-- under every locale.
--
-- The ranges mirror `EMOJI_RANGES` in lib/nickname.ts character for character. Postgres
-- has no `\p{Extended_Pictographic}` for the client's regex to have been reused here.
--
-- `not valid` so the constraint guards writes from here on without the migration failing
-- on a legacy row it was too late to stop. An existing row is still checked the moment
-- anyone updates it, which is when it becomes ours again.
alter table profiles add constraint profiles_nickname_shape check (
  nickname is null
  or (
    char_length(nickname::text) between 3 and 16
    -- Arrows, misc symbols and dingbats; more arrows and stars; the variation selector
    -- that asks for the glyph before it in colour; the pictograph planes. Written as
    -- escapes rather than pasted in, so every character of this rule is one a reader
    -- can see.
    and nickname::text !~
      '[\u2190-\u27BF\u2B00-\u2BFF\uFE0F\U0001F000-\U0001FAFF]'
  )
) not valid;
