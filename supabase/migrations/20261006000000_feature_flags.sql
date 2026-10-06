-- Who sees what, as rows rather than as a build.
--
-- …_profile_role.sql gave a profile a rung on a fixed ladder, and `constants/features.ts`
-- mapped each feature to the lowest rung that reached it. That mapping was a build-time
-- fact: handing one tester one extra screen meant promoting them to everything a
-- developer gets, or shipping a bundle. Both are the wrong size of move.
--
-- The ladder goes with it. A role created from the admin screen would need a rank, and a
-- rank between `developer` and `admin` means nothing to anybody. A role is now a name and
-- a stack of features, flat, with nothing inherited from anything.
--
-- A word of warning this schema has needed before: `admin` here is an account role and a
-- feature key, and has nothing to do with `rooms.admin_id`, where admin is the player who
-- created a multiplayer room. The two must never be read off each other.

-- ─── features: the keys, and what is editable about them ─────────────────────
-- Rows are created and removed by migration, never by the screen. A key means something
-- only because the client holds a guard for it, so a key arriving or leaving is a code
-- change either way; the screen edits `active` and `note`.
create table features (
  key        text primary key,
  active     boolean not null default true,
  note       text,
  created_at timestamptz not null default now(),

  -- The admin door cannot be shut from behind the admin door. Every write guard in this
  -- migration asks `has_feature(auth.uid(), 'admin')`, and that reads `active` — so
  -- deactivating this one key would lock every admin out of the only screen that could
  -- turn it back on. A constraint rather than a check in the RPC, because this one has
  -- to hold against a later migration too.
  constraint admin_feature_stays_active check (active or key <> 'admin')
);

-- ─── roles: a named stack ────────────────────────────────────────────────────
-- `label` is what the admin screen prints, and it is deliberately not translated: a row
-- cannot carry a Lingui message id, and the people who open this screen are the people
-- who write the catalog.
create table roles (
  key        text primary key,
  label      text not null,
  created_at timestamptz not null default now()
);

-- ─── role_features: the stack itself ─────────────────────────────────────────
-- Presence is the grant. No `granted` column, because a stack has no third state — the
-- tri-state belongs to overrides alone, below.
create table role_features (
  role_key    text not null references roles (key)    on delete cascade,
  feature_key text not null references features (key) on delete cascade,
  primary key (role_key, feature_key)
);

-- ─── user_features: one person's departures from it ──────────────────────────
-- `granted` is the whole point: true adds, false subtracts, no row inherits. A table
-- with presence-as-grant could only ever add, and "this developer should not see ADMIN"
-- would have no answer but a near-duplicate role — which is the thing roles-as-data is
-- meant to stop.
create table user_features (
  user_id     uuid    not null references profiles (id)   on delete cascade,
  feature_key text    not null references features (key)  on delete cascade,
  granted     boolean not null,
  primary key (user_id, feature_key)
);

-- ─── Seed: today's behaviour, exactly ────────────────────────────────────────
insert into features (key, active, note) values
  ('multiplayer', false,
   'Off while the intro is being fitted into a short phone. The waiting room, the shared run and the results are untouched — what is hidden is the way in and the How to Play chapter about it.'),
  ('arcade',      true,
   'A proof of concept: one way in, one way back, a depth instead of a score. Wants the people who can change it rather than the people who can report on it.'),
  ('dev',         true,
   'Every challenge ever written, playable on demand with no board kept.'),
  ('admin',       true,
   'This screen. Protected: cannot be switched off, and nobody can take it from themselves.');

insert into roles (key, label) values
  ('tester',    'TESTER'),
  ('developer', 'DEVELOPER'),
  ('admin',     'ADMIN');

-- `dev` was floored at tester, `arcade` at developer, `admin` at admin — and the floor
-- meant every rung above inherited it, so a floor becomes a row per rung at or above it.
insert into role_features (role_key, feature_key) values
  ('tester',    'dev'),
  ('developer', 'dev'),
  ('developer', 'arcade'),
  ('admin',     'dev'),
  ('admin',     'arcade'),
  ('admin',     'admin');

-- multiplayer is `nobody` today, which is `active = false` above. Its grants are seeded
-- anyway: the resolve intersects with `active`, so behaviour is identical either way,
-- and the old comment's "floored back at tester when there is something to report on
-- again" becomes one tap instead of four. That is the whole argument for the switch.
insert into role_features (role_key, feature_key) values
  ('tester',    'multiplayer'),
  ('developer', 'multiplayer'),
  ('admin',     'multiplayer');

-- ─── profiles.role becomes a foreign key ─────────────────────────────────────
-- The column keeps its name, its type and its values, so no profile row is touched.
-- Every existing value is one of the three the dropped constraint allowed, and all
-- three are seeded above, so nothing can fail the new one.
--
-- `restrict` rather than `set null`: `delete_role` refuses to drop a role anybody holds,
-- and this is what makes that refusal true even when the screen is wrong.
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_fkey
  foreign key (role) references roles (key) on delete restrict;

-- ─── Who may read ────────────────────────────────────────────────────────────
-- The same audience `profiles` already has, and named the way …_init.sql names them. A
-- role is public today and what it opens is not a secret either — the doctrine that this
-- decides what a player is *shown* is exactly the argument that none of it needs hiding.
--
-- No insert, update or delete to anybody. Every write is an RPC, below.
alter table features      enable row level security;
alter table roles         enable row level security;
alter table role_features enable row level security;
alter table user_features enable row level security;

create policy "public read" on features      for select using (true);
create policy "public read" on roles         for select using (true);
create policy "public read" on role_features for select using (true);
create policy "public read" on user_features for select using (true);

grant select on public.features      to anon, authenticated;
grant select on public.roles         to anon, authenticated;
grant select on public.role_features to anon, authenticated;
grant select on public.user_features to anon, authenticated;

-- ─── The resolve ─────────────────────────────────────────────────────────────
-- One function, read by the player path and by the admin screen alike. Written twice is
-- how a screen and an app come to disagree about why somebody can see something.
--
-- The `coalesce` *is* the tri-state: an override row wins outright in either direction,
-- and its absence falls through to the role's stack. `f.active` sits outside the whole
-- expression rather than inside either branch, so the master switch beats both.
--
-- A null `p_user_id` — which is what `my_features()` passes on a first launch, before
-- the anonymous sign-in — resolves to the empty set. The intro paints against this
-- answer and must not be handed an exception for asking early.
create or replace function effective_features(p_user_id uuid)
returns setof text language sql stable set search_path = public as $$
  select f.key
  from features f
  where f.active
    and coalesce(
      (select uf.granted
         from user_features uf
        where uf.user_id = p_user_id and uf.feature_key = f.key),
      exists (select 1
                from role_features rf
                join profiles p on p.role = rf.role_key
               where p.id = p_user_id and rf.feature_key = f.key)
    );
$$;

-- What the device asks once per launch.
create or replace function my_features()
returns setof text language sql stable set search_path = public as $$
  select * from effective_features(auth.uid());
$$;

-- What every write guard below asks. Note it reads `active`, which is why the `admin`
-- key is protected by a check constraint rather than by convention.
create or replace function has_feature(p_user_id uuid, p_key text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from effective_features(p_user_id) k where k = p_key);
$$;

grant execute on function public.effective_features(uuid) to anon, authenticated;
grant execute on function public.my_features()            to anon, authenticated;
grant execute on function public.has_feature(uuid, text)  to anon, authenticated;
