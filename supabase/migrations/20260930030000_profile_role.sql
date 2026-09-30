-- What a player is allowed to be shown.
--
-- Until now a feature was either shipped or it was not: `constants/features.ts` held one
-- build-time switch, and flipping it opened the feature to every player at once. There
-- was no way to put unfinished work in front of a handful of people on real devices and
-- leave it hidden from everyone else.
--
-- Null is the ordinary player, the default, and all but a few rows. The three named
-- values are a ladder — tester, then developer, then admin — and the app reads them that
-- way: a flag names the lowest role that may see it and every role above inherits it.
-- The ladder lives in lib/role.ts; this column only stores which rung.
--
-- `text` with a `check ... in (...)` rather than an enum, because that is what every
-- closed set in this schema already is — `mode`, `difficulty`, `rooms.status` — and a
-- lone `create type ... as enum` would be a second way of saying the same thing.
--
-- A word of warning about this one, because the schema already uses it for something
-- else: `admin` here is an *account* role and has nothing to do with `rooms.admin_id` or
-- `room_players`, where admin means the player who created a multiplayer room. The two
-- must never be read off each other.
--
-- What this is not: a permission. The gate it feeds is drawn in the client, out of a
-- column every client can read, and it decides what a player is *shown* rather than what
-- a player may do. Hiding an unfinished screen is exactly what it is for. Anything that
-- must not be reached needs a check in the function that does the reaching, not a flag.

alter table profiles add column role text
  check (role in ('tester', 'developer', 'admin'));

-- ─── Who may write it ────────────────────────────────────────────────────────
-- Nobody with a client. `profiles` carries `grant select, insert, update, delete ... to
-- authenticated` behind an `own all` policy on `auth.uid() = id` (…_init.sql), and a new
-- column inherits both — so left alone, the column above is one API call away from any
-- player promoting themselves to admin. The grants have to name columns instead.
--
-- Update covers the two writes a client actually makes: the nickname
-- (hooks/use-supabase-auth.ts) and the motto (lib/leaderboard.ts). Nothing else.
revoke update on public.profiles from authenticated;
grant  update (nickname, motto) on public.profiles to authenticated;

-- Insert as well, and not for symmetry: `delete` is granted too, so a player can drop
-- their own row and file a replacement. A table-level insert grant would let them name a
-- role on the way in, which is the same hole through a different door. (The delete grant
-- itself is older than this migration and stays as it is.)
revoke insert on public.profiles from authenticated;
grant  insert (id, nickname, motto) on public.profiles to authenticated;

-- `create_room` and `join_room` also insert into `profiles` — both are `security
-- definer` and run as the owner, so neither is reached by a grant on `authenticated`.
--
-- The standing consequence, which is the point rather than a snag: a column added to
-- `profiles` from here on is not client-writable until it is named above. A write that
-- comes back `permission denied for table profiles` after a new column lands is this
-- migration asking whether that column was meant to be the player's to set.

-- No change to `select`: a profile is public, and the role rides along with the nickname
-- the app already reads once per launch. Who holds a role is not a secret — what it
-- opens is not one either.
--
-- No change to `player_profile`, deliberately. A role is not a fact a player looks at on
-- a profile, and that function has been broken once already by a restatement from a
-- stale copy — see …_profile_read_restore.sql.
