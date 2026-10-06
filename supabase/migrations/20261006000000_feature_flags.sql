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

-- ─── The lockout guard ───────────────────────────────────────────────────────
-- This system edits its own access, through four doors: a role change, an override, an
-- edit to the stack of the role you hold, and deactivating the `admin` feature. The
-- fourth is shut by the check constraint on `features`; this closes the other three at
-- once, called at the end of every write below.
--
-- Deliberately not `stable`. It is called after the write it is judging and has to see
-- it. A `stable` guard reading the pre-write world would pass every change it exists to
-- refuse, and would do it silently.
create or replace function guard_admin_floor(p_actor uuid)
returns void language plpgsql set search_path = public as $$
begin
  if not has_feature(p_actor, 'admin') then
    raise exception 'that change would take admin away from you';
  end if;

  -- Scoped to the roled population — the handful of rows that could possibly answer.
  if not exists (
    select 1 from profiles p
     where (p.role is not null
            or exists (select 1 from user_features uf where uf.user_id = p.id))
       and has_feature(p.id, 'admin')
  ) then
    raise exception 'that change would leave nobody holding admin';
  end if;
end;
$$;

-- The opening line of every write. A function rather than six copies of four lines, and
-- it asks `has_feature(…, 'admin')` rather than `role = 'admin'` — which is what the
-- version of set_user_role this replaces asked. A custom role granting `admin` has to
-- open the buttons as well as the door, or roles-as-data stops halfway.
create or replace function require_admin()
returns uuid language plpgsql stable set search_path = public as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;
  if not has_feature(v_caller, 'admin') then
    raise exception 'caller is not an admin';
  end if;
  return v_caller;
end;
$$;

-- ─── People ──────────────────────────────────────────────────────────────────
-- Replaces the version in …_set_user_role.sql: any role key the `roles` table holds,
-- rather than three names written into the function body.
create or replace function set_user_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
begin
  if p_role is not null and not exists (select 1 from roles where key = p_role) then
    raise exception 'set_user_role: unknown role %', p_role;
  end if;
  update profiles set role = p_role where id = p_user_id;
  perform guard_admin_floor(v_caller);
end;
$$;

-- `p_granted` null deletes the override row, which is how a feature goes back to
-- inheriting — the third state, and the usual one.
create or replace function set_user_feature(p_user_id uuid, p_key text, p_granted boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
begin
  if p_granted is null then
    delete from user_features where user_id = p_user_id and feature_key = p_key;
  else
    insert into user_features (user_id, feature_key, granted)
    values (p_user_id, p_key, p_granted)
    on conflict (user_id, feature_key) do update set granted = excluded.granted;
  end if;
  perform guard_admin_floor(v_caller);
end;
$$;

create or replace function reset_user_features(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
begin
  delete from user_features where user_id = p_user_id;
  perform guard_admin_floor(v_caller);
end;
$$;

-- ─── Roles ───────────────────────────────────────────────────────────────────
create or replace function create_role(p_key text, p_label text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  insert into roles (key, label) values (p_key, p_label);
end;
$$;

create or replace function rename_role(p_key text, p_label text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update roles set label = p_label where key = p_key;
end;
$$;

-- The foreign key on profiles.role is `restrict`, so the database would refuse this
-- anyway. The count is here so the screen can say *why* rather than show a constraint
-- name to somebody holding a phone.
create or replace function delete_role(p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
  v_held   int;
begin
  select count(*) into v_held from profiles where role = p_key;
  if v_held > 0 then
    raise exception 'delete_role: still held by % %',
      v_held, case when v_held = 1 then 'person' else 'people' end;
  end if;
  delete from roles where key = p_key;
  perform guard_admin_floor(v_caller);
end;
$$;

create or replace function set_role_feature(p_role text, p_key text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
begin
  if p_on then
    insert into role_features (role_key, feature_key) values (p_role, p_key)
    on conflict do nothing;
  else
    delete from role_features where role_key = p_role and feature_key = p_key;
  end if;
  perform guard_admin_floor(v_caller);
end;
$$;

-- ─── Features ────────────────────────────────────────────────────────────────
-- The master switch and the note; nothing else. Rows are not created or deleted here —
-- a key without a guard in the client means nothing, so keys arrive by migration.
create or replace function set_feature(p_key text, p_active boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
begin
  update features set active = p_active, note = p_note where key = p_key;
  perform guard_admin_floor(v_caller);
end;
$$;

grant execute on function public.set_user_role(uuid, text)             to authenticated;
grant execute on function public.set_user_feature(uuid, text, boolean) to authenticated;
grant execute on function public.reset_user_features(uuid)             to authenticated;
grant execute on function public.create_role(text, text)               to authenticated;
grant execute on function public.rename_role(text, text)               to authenticated;
grant execute on function public.delete_role(text)                     to authenticated;
grant execute on function public.set_role_feature(text, text, boolean) to authenticated;
grant execute on function public.set_feature(text, boolean, text)      to authenticated;

-- ─── What the admin screen reads ─────────────────────────────────────────────
-- Not guarded, and guarding them would be the mistake: these are `stable` functions over
-- tables every client can already select, and a guard would suggest the counts are
-- secret while the rows they count are not. The guards belong on the writes, which is
-- where …_profile_role.sql put them.

-- Everybody the screen has anything to say about. `role is not null` was the whole list
-- before overrides existed; a person carrying overrides and no role is exactly the
-- person somebody went looking for, so they belong here too.
create or replace function admin_people()
returns table (id uuid, nickname text, role text, feature_count int, has_overrides boolean)
language sql stable set search_path = public as $$
  select p.id,
         p.nickname::text,
         p.role,
         (select count(*)::int from effective_features(p.id)),
         exists (select 1 from user_features uf where uf.user_id = p.id)
  from profiles p
  where p.role is not null
     or exists (select 1 from user_features uf where uf.user_id = p.id)
  order by p.role nulls last, p.nickname;
$$;

-- `nickname` is `citext unique`, so at most one row can ever answer.
create or replace function admin_find_person(p_nickname text)
returns table (id uuid, nickname text, role text, feature_count int, has_overrides boolean)
language sql stable set search_path = public as $$
  select p.id,
         p.nickname::text,
         p.role,
         (select count(*)::int from effective_features(p.id)),
         exists (select 1 from user_features uf where uf.user_id = p.id)
  from profiles p
  where p.nickname = p_nickname;
$$;

-- One row per feature, with everything the person screen needs to say where the answer
-- came from: the override if there is one, what the role says, and whether the feature
-- is switched on at all.
create or replace function person_features(p_user_id uuid)
returns table (key text, override boolean, in_role_stack boolean, active boolean)
language sql stable set search_path = public as $$
  select f.key,
         (select uf.granted from user_features uf
           where uf.user_id = p_user_id and uf.feature_key = f.key),
         exists (select 1 from role_features rf
                   join profiles p on p.role = rf.role_key
                  where p.id = p_user_id and rf.feature_key = f.key),
         f.active
  from features f
  order by f.key;
$$;

create or replace function role_stats()
returns table (key text, label text, feature_count int, person_count int)
language sql stable set search_path = public as $$
  select r.key,
         r.label,
         (select count(*)::int from role_features rf where rf.role_key = r.key),
         (select count(*)::int from profiles p where p.role = r.key)
  from roles r
  order by r.label;
$$;

create or replace function role_feature_keys(p_role text)
returns setof text language sql stable set search_path = public as $$
  select feature_key from role_features where role_key = p_role order by feature_key;
$$;

-- `person_count` is after resolution — people who actually end up with the feature,
-- overrides included. That is the number somebody about to flip a master switch wants,
-- and it is not the same as the number of people whose role grants it.
--
-- Scoped to the roled population, the same way guard_admin_floor is. A profile with no
-- role and no overrides resolves to nothing, so excluding it changes no answer — and
-- including it would mean a `has_feature` call per profile per feature, over a table
-- that grows with every player who ever opened the app.
create or replace function feature_stats()
returns table (key text, active boolean, note text, role_count int, person_count int)
language sql stable set search_path = public as $$
  select f.key,
         f.active,
         f.note,
         (select count(*)::int from role_features rf where rf.feature_key = f.key),
         (select count(*)::int
            from profiles p
           where (p.role is not null
                  or exists (select 1 from user_features uf where uf.user_id = p.id))
             and has_feature(p.id, f.key))
  from features f
  order by f.key;
$$;

grant execute on function public.admin_people()          to authenticated;
grant execute on function public.admin_find_person(text) to authenticated;
grant execute on function public.person_features(uuid)   to authenticated;
grant execute on function public.role_stats()            to authenticated;
grant execute on function public.role_feature_keys(text) to authenticated;
grant execute on function public.feature_stats()         to authenticated;
