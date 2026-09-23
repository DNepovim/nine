-- The language the player was reading the game in when they wrote.
--
-- Answers are written by hand, and until now there was nothing in the row to say which
-- language to write one in. The app speaks English and Czech; a Czech player getting an
-- English reply is a worse reply than no reply, and guessing from the message text only
-- works while the message is long enough to guess from.
--
-- Deliberately not checked against a list of languages. `mode` and `difficulty` are
-- constrained because the database reasons about them; this is a note to a human, and a
-- constraint here would mean a build that ships a third language has its messages
-- rejected until a migration catches up. Losing a report to protect a hint is a bad
-- trade. The length cap is only there to keep the column a tag rather than a field.

alter table feedback
  add column locale text check (locale is null or length(locale) between 2 and 10);

comment on column feedback.locale is
  'The app language this message was written in (''en'', ''cs''). Write the answer in it. Null for rows from before this column existed.';
