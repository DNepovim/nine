# Feature flags in the database — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every decision about who sees which feature out of `constants/features.ts` and into four database tables an admin edits from the phone, and rebuild the admin screen around them.

**Architecture:** Code keeps only the feature keys it has guards for. `roles` are rows carrying a stack of features; `user_features` holds per-person overrides in either direction; `features.active` is a master switch. One SQL function, `effective_features(user)`, resolves all three and is the only place the rules are written. Writes go through `security definer` RPCs guarded by `has_feature(auth.uid(), 'admin')`.

**Tech Stack:** Postgres 17 (Supabase), TypeScript, Expo / React Native, NativeWind v5, Lingui v6, Vitest (node environment), psql for the SQL tests.

**Spec:** `docs/superpowers/specs/2026-10-06-feature-flags-in-the-database-design.md`

## Global Constraints

- **Never deploy to production.** Not at any point in this plan, under any phrasing short of the user typing the deploy command themselves.
- **Path alias:** `@/*` maps to the repo root. Never use relative `../` imports.
- **Every player-visible string goes through Lingui** and must be extracted. `pnpm i18n:verify` is the first step of `pnpm check`; an unextracted string renders its generated id in a production build. Czech translations are part of each task, not a follow-up.
- **Role labels are the exception** — they are database rows and cannot carry a Lingui message id. Plain English, as `ROLE_LABEL` already is.
- **Styling:** `className` for static styles; the `style` prop only for values computed at runtime. Follow the mono / tracking / `text-dim` / `text-primary` idiom of the file being edited.
- **Buttons the player can press use `<TrackedPressable id="…">`**, and every id must first exist in the `ButtonId` union in `constants/buttons.ts`.
- **Comments explain why, not what.** This repo's files carry long prose comments about the reasoning; match that density when editing them.
- **`pnpm check` must be green before every commit** (`i18n:verify`, `i18n:compile`, eslint, prettier, tsc, knip, vitest). One pre-existing failure is expected and is not yours: `.claude/worktrees/arcade-siege/machines/siege.test.ts` cannot resolve `@/constants/siege`. Ignore that one file; everything else must pass.
- **Feature keys this build has guards for, and the only legal members of `Flag`:** `multiplayer`, `arcade`, `dev`, `admin`.
- **Protected key:** `admin`. Cannot be deactivated, cannot be removed from the caller's own reach, cannot be left with nobody holding it.

## Review Focus

Five things the spec implies, that are easy to get wrong, and that no task's happy path would catch. Each has a test pinned to the task that owns the code.

1. **A new `Set` identity on every render will loop the analytics effect.** `app/(tabs)/index.tsx:577` runs `setAdminOptOut(…)` in an effect keyed on the auth value; if the feature set is rebuilt per render, that effect never settles. Pinned to Task 5.
2. **`my_features()` before sign-in.** `auth.uid()` is null on the first launch, and `effective_features(null)` must return the empty set rather than raise — the intro paints before auth settles and must not see an error. Pinned to Task 2.
3. **A person with overrides but no role disappears from the PEOPLE list.** Today's query is `.not('role', 'is', null)`. Overrides make that wrong, and the person it loses is exactly the one somebody went looking for. Pinned to Task 3.
4. **The last admin loses admin by the override route, not the role route.** `set_user_feature(me, 'admin', false)` and `reset_user_features(me)` both bypass a guard that only watches `set_user_role`. Pinned to Task 3.
5. **Keys that exist on one side only.** A server key this build has no guard for must be dropped on the way in, not crash; a build key with no database row must still render as off. Pinned to Task 4.

---

## File Structure

**Created**

| Path                                                              | Responsibility                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `supabase/migrations/20261006000000_feature_flags.sql`            | The whole schema change: tables, functions, seed, FK swap, RPCs       |
| `supabase/tests/features.sql`                                     | Assertions over the resolve and the guards                            |
| `scripts/db-test.js`                                              | Runs the local stack's psql against `supabase/tests/*.sql`            |
| `lib/features.ts`                                                 | Pure: key filtering, the override cycle, the source of a row's answer |
| `lib/features.test.ts`                                            | Its tests                                                             |
| `lib/admin/people.ts`                                             | People reads and the three person-scoped writes                       |
| `lib/admin/roles.ts`                                              | Role reads and the four role writes                                   |
| `lib/admin/features.ts`                                           | Feature reads and the one feature write                               |
| `components/overlays/admin-people.tsx`                            | PEOPLE tab: search and list                                           |
| `components/overlays/admin-person.tsx`                            | One person: role picker, override rows, reset                         |
| `components/overlays/admin-roles.tsx`                             | ROLES tab: list and the new-role field                                |
| `components/overlays/admin-role.tsx`                              | One role: rename, delete, stack toggles                               |
| `components/overlays/admin-features.tsx`                          | FEATURES tab: master switches and notes                               |
| `docs/superpowers/plans/2026-10-06-feature-flags-verification.md` | What to walk on a device                                              |

**Modified**

| Path                                    | Change                                              |
| --------------------------------------- | --------------------------------------------------- |
| `constants/features.ts`                 | The floor map becomes a list of keys                |
| `constants/buttons.ts`                  | New `ButtonId` members for every new button         |
| `hooks/use-flags.tsx`                   | `FlagsProvider` takes a set of features, not a role |
| `hooks/use-supabase-auth.ts`            | Stops selecting `role`, calls `my_features()`       |
| `app/(tabs)/index.tsx`                  | Provider wiring and the analytics opt-out           |
| `dev/gallery.tsx`                       | Two `<FlagsProvider role="admin">` call sites       |
| `components/overlays/admin-overlay.tsx` | Becomes the three-tab hub                           |
| `package.json`                          | `db:test` script                                    |
| `CLAUDE.md`                             | The **role** and **flag** domain-language entries   |

**Deleted**

| Path                 | Why                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `lib/role.ts`        | `ROLE_RANK`, `Floor`, `holds`, `parseRole`, `ROLES` all describe a ladder that no longer exists |
| `lib/role.test.ts`   | Tests of the above                                                                              |
| `lib/admin-roles.ts` | Superseded by `lib/admin/`                                                                      |

---

## Task 1: The tables, the seed, and the SQL test harness

**Files:**

- Create: `supabase/migrations/20261006000000_feature_flags.sql`
- Create: `supabase/tests/features.sql`
- Create: `scripts/db-test.js`
- Modify: `package.json`

**Interfaces:**

- Consumes: nothing.
- Produces: tables `features(key text pk, active boolean, note text, created_at timestamptz)`, `roles(key text pk, label text, created_at timestamptz)`, `role_features(role_key text, feature_key text)`, `user_features(user_id uuid, feature_key text, granted boolean)`. A `pnpm db:test` script that runs every `.sql` file in `supabase/tests/` against the local stack and fails on the first failed assertion.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/features.sql`. Assertions only — `do $$ … $$` blocks that raise on a bad answer. Start with the seed reproducing today's floors exactly, which is the property that makes this deployable.

```sql
-- Assertions over the feature tables, the resolve and the write guards.
-- Run with `pnpm db:test`, which resets the local database first.
--
-- Plain `assert` rather than pgTAP: this repo carries no SQL test dependency and one
-- assertion that raises is all a failing test has to do.

do $$
begin
  -- ── The seed reproduces today's floors ──────────────────────────────────────
  -- `dev` was floored at tester, so all three roles reach it.
  assert (select count(*) from role_features where feature_key = 'dev') = 3,
    'dev should be in all three stacks';
  -- `arcade` was floored at developer.
  assert exists (select 1 from role_features where role_key = 'developer' and feature_key = 'arcade'),
    'developer should hold arcade';
  assert exists (select 1 from role_features where role_key = 'admin' and feature_key = 'arcade'),
    'admin should hold arcade';
  assert not exists (select 1 from role_features where role_key = 'tester' and feature_key = 'arcade'),
    'tester should not hold arcade';
  -- `admin` was floored at admin, and only admin.
  assert (select count(*) from role_features where feature_key = 'admin') = 1,
    'only one stack should hold admin';

  -- `multiplayer` is seeded into every stack but switched off, so flipping `active`
  -- restores the tester floor in one move rather than four.
  assert (select count(*) from role_features where feature_key = 'multiplayer') = 3,
    'multiplayer should be seeded into every stack';
  assert (select active from features where key = 'multiplayer') = false,
    'multiplayer should be inactive';

  -- ── The protected key ───────────────────────────────────────────────────────
  begin
    update features set active = false where key = 'admin';
    assert false, 'deactivating admin should have been refused';
  exception when check_violation then null;
  end;

  raise notice 'features.sql: tables and seed OK';
end;
$$;
```

- [ ] **Step 2: Write the test runner, then run it to verify it fails**

Create `scripts/db-test.js`:

```js
#!/usr/bin/env node

// Runs every assertion file in supabase/tests/ against the local Supabase stack.
//
// Not part of `pnpm check`: it needs Docker and a running `supabase start`, and a gate
// that cannot run on a laptop without one is a gate people learn to skip. It is still
// the only automated test the resolve has — the rules live in SQL on purpose, and
// mirroring them in TypeScript to reach Vitest would create the second copy the design
// exists to avoid.

const { execFileSync } = require('node:child_process')
const { readdirSync } = require('node:fs')
const { join } = require('node:path')

const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIR = 'supabase/tests'

execFileSync('pnpm', ['exec', 'supabase', 'db', 'reset'], { stdio: 'inherit' })

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()

for (const name of files) {
  console.log(`\n── ${name} ──`)
  execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-f', join(DIR, name)], {
    stdio: 'inherit',
  })
}

console.log(`\n${files.length} SQL test file(s) passed.`)
```

Add to `package.json` scripts, directly after `db:status`:

```json
"db:test": "node scripts/db-test.js",
```

Run: `pnpm db:test`
Expected: FAIL — `relation "role_features" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261006000000_feature_flags.sql`. This step is the tables, the seed and the foreign-key swap only; the functions and RPCs are Tasks 2 and 3 appending to this same file.

```sql
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
-- The same audience `profiles` already has. A role is public today and what it opens is
-- not a secret either — the doctrine that this decides what a player is *shown* is
-- exactly the argument that none of it needs hiding.
--
-- No insert, update or delete to anybody. Every write is an RPC, below.
alter table features      enable row level security;
alter table roles         enable row level security;
alter table role_features enable row level security;
alter table user_features enable row level security;

create policy "features readable"      on features      for select using (true);
create policy "roles readable"         on roles         for select using (true);
create policy "role_features readable" on role_features for select using (true);
create policy "user_features readable" on user_features for select using (true);

grant select on features, roles, role_features, user_features to anon, authenticated;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm db:test`
Expected: PASS, printing `features.sql: tables and seed OK`.

- [ ] **Step 5: Run the static checks**

Run: `pnpm check`
Expected: PASS apart from the known `arcade-siege` worktree failure. (`scripts/db-test.js` is reached from a package script, so knip will not call it unused; if prettier complains, run `pnpm format`.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261006000000_feature_flags.sql supabase/tests/features.sql scripts/db-test.js package.json
git commit -F - <<'EOF'
feat(features): hold roles, stacks and overrides in the database

Four tables seeded to reproduce today's floors exactly, so the deploy
changes nothing for any player: dev to all three stacks, arcade to
developer and admin, admin to admin alone. multiplayer is seeded into
every stack but switched off — the resolve intersects with `active`, so
behaviour is identical and putting it back is one tap.

profiles.role keeps its name and its values and becomes a foreign key.

Also adds `pnpm db:test`, which is the only automated test the SQL in
this feature can have: Vitest runs in node against TypeScript, and
mirroring the resolve there to reach it would create a second copy of
the rules.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 2: The resolve

**Files:**

- Modify: `supabase/migrations/20261006000000_feature_flags.sql` (append)
- Modify: `supabase/tests/features.sql` (append)

**Interfaces:**

- Consumes: the four tables from Task 1.
- Produces: `effective_features(p_user_id uuid) returns setof text`, `my_features() returns setof text`, `has_feature(p_user_id uuid, p_key text) returns boolean`.

- [ ] **Step 1: Write the failing test**

Append to `supabase/tests/features.sql`. This covers the tri-state in both directions, the master switch beating both, and **Review Focus item 2** — a null caller.

```sql
do $$
declare
  v_plain uuid;
  v_test  uuid;
begin
  -- Two profiles from the seed: one with no role, one made a tester here.
  select id into v_plain from profiles order by id limit 1;
  select id into v_test  from profiles order by id offset 1 limit 1;
  update profiles set role = 'tester' where id = v_test;

  -- ── No role, no overrides: nothing ──────────────────────────────────────────
  assert not exists (select 1 from effective_features(v_plain)),
    'a profile with no role should reach nothing';

  -- ── A role gives its stack, minus whatever is inactive ──────────────────────
  assert (select array_agg(k order by k) from effective_features(v_test) k) = array['dev'],
    'tester should reach dev and only dev (multiplayer is inactive)';

  -- ── An override adds ────────────────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'arcade', true);
  assert has_feature(v_test, 'arcade'), 'a true override should add a feature';

  -- ── An override subtracts ───────────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'dev', false);
  assert not has_feature(v_test, 'dev'),
    'a false override should take away a feature the role gives';

  -- ── The master switch beats both ────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'multiplayer', true);
  assert not has_feature(v_test, 'multiplayer'),
    'an inactive feature should not be reachable even by a true override';

  -- ── Removing the override row returns the role's answer ─────────────────────
  delete from user_features where user_id = v_test and feature_key = 'dev';
  assert has_feature(v_test, 'dev'), 'deleting an override should fall back to the role';

  -- ── Review Focus 2: no caller at all ────────────────────────────────────────
  -- `my_features()` runs on the first launch, before the anonymous sign-in has
  -- happened, so `auth.uid()` is null. The intro paints against this answer and must
  -- get an empty set rather than an exception.
  assert not exists (select 1 from effective_features(null)),
    'a null user should reach nothing, not raise';

  -- Leave the fixture as it was found, so later blocks start from the seed.
  delete from user_features where user_id = v_test;
  update profiles set role = null where id = v_test;

  raise notice 'features.sql: resolve OK';
end;
$$;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm db:test`
Expected: FAIL — `function effective_features(uuid) does not exist`.

- [ ] **Step 3: Append the functions to the migration**

```sql
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm db:test`
Expected: PASS, printing both `tables and seed OK` and `resolve OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261006000000_feature_flags.sql supabase/tests/features.sql
git commit -F - <<'EOF'
feat(features): resolve a person's features in one SQL function

effective_features(user) is the only place the rules are written. The
coalesce is the tri-state — an override wins either way, its absence
falls through to the role's stack — and `active` sits outside both, so
the master switch beats them.

A null caller resolves to the empty set rather than raising: my_features()
is asked on a first launch, before the anonymous sign-in, and the intro
paints against the answer.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 3: The write RPCs, the lockout guards, and the screen's reads

**Files:**

- Modify: `supabase/migrations/20261006000000_feature_flags.sql` (append)
- Modify: `supabase/tests/features.sql` (append)

**Interfaces:**

- Consumes: `effective_features`, `has_feature` from Task 2.
- Produces, all `security definer` and admin-guarded:
  `set_user_role(p_user_id uuid, p_role text)`, `set_user_feature(p_user_id uuid, p_key text, p_granted boolean)`, `reset_user_features(p_user_id uuid)`, `create_role(p_key text, p_label text)`, `rename_role(p_key text, p_label text)`, `delete_role(p_key text)`, `set_role_feature(p_role text, p_key text, p_on boolean)`, `set_feature(p_key text, p_active boolean, p_note text)`.
- Produces, `stable` and unguarded:
  `admin_people() returns table(id uuid, nickname text, role text, feature_count int, has_overrides boolean)`, `admin_find_person(p_nickname text)` with the same row type, `person_features(p_user_id uuid) returns table(key text, override boolean, in_role_stack boolean, active boolean)`, `role_stats() returns table(key text, label text, feature_count int, person_count int)`, `role_feature_keys(p_role text) returns setof text`, `feature_stats() returns table(key text, active boolean, note text, role_count int, person_count int)`.

- [ ] **Step 1: Write the failing test**

Append to `supabase/tests/features.sql`. This covers **Review Focus items 3 and 4**.

```sql
do $$
declare
  v_admin uuid;
  v_other uuid;
begin
  select id into v_admin from profiles order by id limit 1;
  select id into v_other from profiles order by id offset 1 limit 1;
  update profiles set role = 'admin' where id = v_admin;

  -- The RPCs read auth.uid(). Impersonate by setting the request claim the way
  -- PostgREST does, so `security definer` functions see a caller.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- ── An ordinary write works ─────────────────────────────────────────────────
  perform set_user_role(v_other, 'tester');
  assert (select role from profiles where id = v_other) = 'tester',
    'an admin should be able to set a role';

  perform set_user_feature(v_other, 'arcade', true);
  assert has_feature(v_other, 'arcade'), 'an admin should be able to grant a feature';

  perform reset_user_features(v_other);
  assert not has_feature(v_other, 'arcade'), 'reset should drop every override';

  -- ── Review Focus 4: the override route out of admin ─────────────────────────
  -- A guard watching only set_user_role would let both of these through.
  begin
    perform set_user_feature(v_admin, 'admin', false);
    assert false, 'overriding your own admin off should have been refused';
  exception when others then
    assert sqlerrm like '%take admin away from you%', 'wrong error: ' || sqlerrm;
  end;

  -- Resetting is fine while admin comes from the role: the overrides go, the role
  -- still answers.
  perform set_user_feature(v_admin, 'arcade', true);
  perform reset_user_features(v_admin);
  assert has_feature(v_admin, 'admin'), 'reset should not have touched a role-given admin';

  -- Now make admin come from an override instead, and reset must refuse. The override
  -- is granted BEFORE the role is taken away — the other order would leave the caller
  -- without admin between the two statements, and `require_admin` would refuse the
  -- grant itself rather than the thing under test.
  perform set_user_feature(v_admin, 'admin', true);
  update profiles set role = 'tester' where id = v_admin;
  begin
    perform reset_user_features(v_admin);
    assert false, 'resetting away your only source of admin should have been refused';
  exception when others then
    assert sqlerrm like '%take admin away from you%', 'wrong error: ' || sqlerrm;
  end;
  update profiles set role = 'admin' where id = v_admin;
  delete from user_features where user_id = v_admin;

  -- ── Editing your own role's stack ───────────────────────────────────────────
  begin
    perform set_role_feature('admin', 'admin', false);
    assert false, 'taking admin out of your own stack should have been refused';
  exception when others then
    assert sqlerrm like '%take admin away from you%', 'wrong error: ' || sqlerrm;
  end;

  -- ── A role somebody holds cannot be deleted ─────────────────────────────────
  begin
    perform delete_role('tester');
    assert false, 'deleting a held role should have been refused';
  exception when others then
    assert sqlerrm like '%still held by 1 person%', 'wrong error: ' || sqlerrm;
  end;

  -- ── Roles can be made, renamed and dropped ──────────────────────────────────
  perform create_role('streamer', 'STREAMER');
  perform rename_role('streamer', 'STREAMERS');
  assert (select label from roles where key = 'streamer') = 'STREAMERS', 'rename failed';
  perform set_role_feature('streamer', 'arcade', true);
  perform delete_role('streamer');
  assert not exists (select 1 from roles where key = 'streamer'), 'delete failed';
  assert not exists (select 1 from role_features where role_key = 'streamer'),
    'deleting a role should cascade its stack';

  -- ── A non-admin is refused ──────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  begin
    perform set_user_role(v_admin, null);
    assert false, 'a non-admin should not be able to write a role';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- ── Review Focus 3: overrides without a role still appear ───────────────────
  perform set_user_role(v_other, null);
  perform set_user_feature(v_other, 'arcade', true);
  assert exists (select 1 from admin_people() p where p.id = v_other),
    'a person with overrides but no role must still be listed';
  assert (select p.has_overrides from admin_people() p where p.id = v_other),
    'that person should be marked as carrying overrides';
  assert (select p.feature_count from admin_people() p where p.id = v_other) = 1,
    'feature_count should be what they actually reach';

  perform reset_user_features(v_other);
  update profiles set role = null where id = v_admin;

  raise notice 'features.sql: writes and guards OK';
end;
$$;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm db:test`
Expected: FAIL — `function set_user_feature(uuid, text, boolean) does not exist`.

- [ ] **Step 3: Append the guard and the write RPCs**

```sql
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

grant execute on function public.set_user_role(uuid, text)               to authenticated;
grant execute on function public.set_user_feature(uuid, text, boolean)   to authenticated;
grant execute on function public.reset_user_features(uuid)               to authenticated;
grant execute on function public.create_role(text, text)                 to authenticated;
grant execute on function public.rename_role(text, text)                 to authenticated;
grant execute on function public.delete_role(text)                       to authenticated;
grant execute on function public.set_role_feature(text, text, boolean)   to authenticated;
grant execute on function public.set_feature(text, boolean, text)        to authenticated;
```

- [ ] **Step 4: Append the screen's read RPCs**

```sql
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

grant execute on function public.admin_people()             to authenticated;
grant execute on function public.admin_find_person(text)    to authenticated;
grant execute on function public.person_features(uuid)      to authenticated;
grant execute on function public.role_stats()               to authenticated;
grant execute on function public.role_feature_keys(text)    to authenticated;
grant execute on function public.feature_stats()            to authenticated;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm db:test`
Expected: PASS, printing all three notices.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261006000000_feature_flags.sql supabase/tests/features.sql
git commit -F - <<'EOF'
feat(features): guard every write, and read the screen in one call each

Writes are security-definer RPCs asking has_feature(caller, 'admin')
rather than role = 'admin' — a custom role granting admin has to open
the buttons as well as the door.

guard_admin_floor runs at the end of each one and closes three of the
four routes out of admin: the role change, the override, and editing the
stack of the role you hold. The fourth is the check constraint. It is
deliberately not `stable`, because it has to see the write it is judging.

The read RPCs are unguarded on purpose: they are stable functions over
tables every client can already select.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 4: The pure client core

**Files:**

- Create: `lib/features.ts`
- Create: `lib/features.test.ts`

**Interfaces:**

- Consumes: `Flag` from `@/constants/features` — still the old object-shaped `FLAGS` at this point, and `keyof typeof FLAGS` gives the same four keys either way, so this task compiles before Task 5 and after it.
- Produces: `knownFeatures(keys: readonly string[]): Set<Flag>`, `type Override = boolean | null`, `cycleOverride(current: Override): Override`, `type FeatureSource`, `sourceOf(row): FeatureSource`.

- [ ] **Step 1: Write the failing test**

Create `lib/features.test.ts`. This is **Review Focus item 5**.

```ts
import { describe, expect, it } from 'vitest'

import { cycleOverride, knownFeatures, sourceOf } from './features'

describe('knownFeatures', () => {
  it('keeps the keys this build has guards for', () => {
    expect(knownFeatures(['arcade', 'dev'])).toStrictEqual(new Set(['arcade', 'dev']))
  })

  it('drops a key the server knows and this build does not', () => {
    // A device older than the server. Dropping is the safe direction: an unknown key
    // can open nothing here, because nothing here asks about it.
    expect(knownFeatures(['arcade', 'siege'])).toStrictEqual(new Set(['arcade']))
  })

  it('reads an empty answer as nothing rather than everything', () => {
    expect(knownFeatures([])).toStrictEqual(new Set())
  })
})

describe('cycleOverride', () => {
  it('goes inherit, on, off, and back', () => {
    expect(cycleOverride(null)).toBe(true)
    expect(cycleOverride(true)).toBe(false)
    expect(cycleOverride(false)).toBeNull()
  })
})

describe('sourceOf', () => {
  it('says a feature nobody can reach is off for everyone', () => {
    // The master switch beats both, so it is reported before either.
    expect(sourceOf({ override: true, inRoleStack: true, active: false })).toBe(
      'inactive',
    )
  })

  it('names the role when there is no override', () => {
    expect(sourceOf({ override: null, inRoleStack: true, active: true })).toBe('role-on')
    expect(sourceOf({ override: null, inRoleStack: false, active: true })).toBe(
      'role-off',
    )
  })

  it('names the override when there is one, either way round', () => {
    expect(sourceOf({ override: true, inRoleStack: false, active: true })).toBe(
      'override-on',
    )
    expect(sourceOf({ override: false, inRoleStack: true, active: true })).toBe(
      'override-off',
    )
  })

  it('still calls it an override when it agrees with the role', () => {
    // Worth saying: a row that agrees with the role today will stop agreeing the moment
    // somebody edits the stack, and the screen should have warned that it was pinned.
    expect(sourceOf({ override: true, inRoleStack: true, active: true })).toBe(
      'override-on',
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/features.test.ts`
Expected: FAIL — `Failed to resolve import "./features"`.

- [ ] **Step 3: Write the implementation**

Create `lib/features.ts`:

```ts
import { FLAGS, type Flag } from '@/constants/features'

// The pure half of the feature system: what the device does with the answer the server
// gives it, and what the admin screen does with one row of that answer. Everything that
// decides *which* features a person reaches lives in SQL — see the migration — because
// a second copy of those rules is how a screen and an app come to disagree.

const KNOWN: ReadonlySet<string> = new Set(Object.keys(FLAGS))

// What `my_features()` hands back, filtered to what this build can act on.
//
// A key the server knows and this build does not is dropped rather than carried. The
// drop is the safe direction and it is not merely defensive: a device can be older than
// the server for weeks, and an unknown key opens nothing here, because nothing here
// asks about it. This is `parseRole`'s instinct, which the ladder took with it.
export function knownFeatures(keys: readonly string[]): Set<Flag> {
  return new Set(keys.filter((key): key is Flag => KNOWN.has(key)))
}

// One person's override of one feature. Null is the third state and the usual one —
// no row, so whatever the role says.
export type Override = boolean | null

// What a tap on a feature row does. Three states, so the cycle has to pass through all
// of them: inherit, force on, force off, back to inherit.
export function cycleOverride(current: Override): Override {
  if (current === null) return true
  if (current) return false
  return null
}

// Where a row's answer came from, which is the thing that makes the person screen
// debuggable rather than merely editable.
export type FeatureSource =
  'inactive' | 'role-on' | 'role-off' | 'override-on' | 'override-off'

export function sourceOf({
  override,
  inRoleStack,
  active,
}: {
  override: Override
  inRoleStack: boolean
  active: boolean
}): FeatureSource {
  // Reported before either of the others because it beats both: an inactive feature is
  // unreachable however the stack and the override are set, and a screen that showed
  // "on, from role" for something nobody can see would be lying.
  if (!active) return 'inactive'
  if (override === null) return inRoleStack ? 'role-on' : 'role-off'
  return override ? 'override-on' : 'override-off'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/features.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/features.ts lib/features.test.ts
git commit -F - <<'EOF'
feat(features): add the pure half of the client feature system

Key filtering on the way in, the three-state override cycle, and where a
row's answer came from. Nothing here decides which features a person
reaches — that is one SQL function — but a key the server knows and this
build does not is dropped here, which is parseRole's instinct kept after
the ladder took parseRole with it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 5: Flip the client over

This task is atomic by nature: `FLAGS` changing shape breaks every consumer at once, so they move together or not at all.

**Files:**

- Modify: `constants/features.ts`
- Modify: `hooks/use-flags.tsx`
- Modify: `hooks/use-supabase-auth.ts`
- Modify: `app/(tabs)/index.tsx:567-579`, `:1310`
- Modify: `dev/gallery.tsx:231`, `:725`
- Modify: `lib/features.ts`, `lib/features.test.ts` (one function added, with its tests)
- Delete: `lib/role.ts`, `lib/role.test.ts`

**Interfaces:**

- Consumes: `knownFeatures` from Task 4; `my_features()` from Task 2.
- Produces: `FLAGS: readonly Flag[]`, `type Flag`, `FlagsProvider({ features: ReadonlySet<Flag> })`, `useFlag(flag: Flag): boolean`, and `useSupabaseAuth()` returning `features: ReadonlySet<Flag>` in place of `role`.

- [ ] **Step 1: Write the failing test**

This is **Review Focus item 1** — the set identity. `FlagsProvider` cannot be rendered in a test here (Vitest runs `environment: 'node'` and this repo has no component tests), so the test pins the thing that actually bites instead: that the auth hook's feature set keeps its identity when the keys have not changed.

Extract that comparison into a pure helper so it is testable at all. Add to `lib/features.ts`:

```ts
// Returns `previous` when the new keys spell the same set, so consumers can depend on
// the value without re-running. React effects key on identity, not contents, and the
// analytics opt-out in app/(tabs)/index.tsx runs in one of them — a set rebuilt on every
// render would leave that effect never settling.
export function sameFeatures(
  previous: ReadonlySet<Flag>,
  next: ReadonlySet<Flag>,
): boolean {
  if (previous.size !== next.size) return false
  for (const key of next) if (!previous.has(key)) return false
  return true
}
```

Then the test, appended to `lib/features.test.ts`:

```ts
describe('sameFeatures', () => {
  it('sees two spellings of the same set as the same', () => {
    expect(sameFeatures(new Set(['dev', 'arcade']), new Set(['arcade', 'dev']))).toBe(
      true,
    )
  })

  it('sees a different size as different', () => {
    expect(sameFeatures(new Set(['dev']), new Set(['dev', 'arcade']))).toBe(false)
  })

  it('sees the same size with a different member as different', () => {
    expect(sameFeatures(new Set(['dev']), new Set(['arcade']))).toBe(false)
  })

  it('sees two empty sets as the same, which is the common case', () => {
    // All but a handful of players resolve to nothing, so this is the comparison that
    // runs on nearly every launch.
    expect(sameFeatures(new Set(), new Set())).toBe(true)
  })
})
```

Update the import line at the top of `lib/features.test.ts` to include `sameFeatures`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/features.test.ts`
Expected: FAIL — `sameFeatures is not a function`.

- [ ] **Step 3: Add `sameFeatures`, then run the test to verify it passes**

Add the function above to `lib/features.ts`.

Run: `pnpm vitest run lib/features.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 4: Rewrite `constants/features.ts`**

Keep the per-feature prose; it explains what each feature _is_, which is still a code fact. Drop every sentence about floors — that is a database row now.

```ts
// One entry per part of the app that is not for everyone yet, kept here rather than in
// the screen that happens to own the button — a feature reaches the player through more
// than one door, and a flag that lives behind one of them gets flipped while the others
// stay open.
//
// This list is the whole of what the code knows. *Who* reaches each one — which roles
// exist, what each role's stack holds, what one person has had added or taken away, and
// whether the feature is switched on at all — is rows in the database, edited from the
// admin screen. See the …_feature_flags.sql migration, and `effective_features`, which
// is the one place the rules are written.
//
// A key here with no row in `features` resolves to off; a row there with no key here is
// shown on the admin screen as not in this build. Both are worth seeing and neither is
// an error — a device can be older than the server, and a migration can outlive a guard.
export const FLAGS = [
  // Playing with friends: the ALONE / WITH FRIENDS tabs on the intro, and the chapter of
  // How to Play that explains them.
  'multiplayer',
  // Arcade: the pill on the intro, the screen behind it, and the chapter of How to Play
  // that explains it. Without the feature the pill is still there, still wearing SOON,
  // still unpressable — the teaser was already a promise to players, and taking it away
  // to build behind it would be answering a promise with an absence.
  'arcade',
  // The DEV link on the intro, and the screen behind it: every challenge ever written,
  // playable on demand with no board kept for it.
  'dev',
  // The ADMIN link on the intro, and the screen behind it. Protected in the database:
  // it cannot be switched off, and nobody can take it from themselves — this is not a
  // feature being tried out, it is the door that decides who sees the others.
  'admin',
] as const

export type Flag = (typeof FLAGS)[number]
```

`lib/features.ts` must change its `KNOWN` line to match the new shape:

```ts
const KNOWN: ReadonlySet<string> = new Set(FLAGS)
```

- [ ] **Step 5: Rewrite `hooks/use-flags.tsx`**

```tsx
import { createContext, use, useMemo, type ReactNode } from 'react'

import { type Flag } from '@/constants/features'

type FlagsState = {
  can: (flag: Flag) => boolean
}

// A default rather than a hook that throws without a provider, and for a concrete
// reason: dev/gallery.tsx renders the intro and the guide outside the app's own tree, to
// be looked at. A screen gallery must not crash on a screen it exists to show. The
// gallery hands those entries a provider of its own so nothing is hidden from it.
const FlagsContext = createContext<FlagsState>({ can: () => false })

// What the player holding the phone may be shown. Fed the set resolved by the server —
// see `my_features()`, asked once per launch in hooks/use-supabase-auth.ts.
//
// `can` answers false while the set is still unknown, which it is until auth settles. A
// tester therefore watches the intro paint without their extra doors and gain them a
// moment later. That is the right way round: holding the intro on a server answer would
// cost every player a wait so that a handful avoid a flicker, and a player who reaches
// nothing — which is all but a handful — never sees anything change at all.
export function FlagsProvider({
  features,
  children,
}: {
  features: ReadonlySet<Flag>
  children: ReactNode
}) {
  const value = useMemo(() => ({ can: (flag: Flag) => features.has(flag) }), [features])
  return <FlagsContext value={value}>{children}</FlagsContext>
}

export function useFlag(flag: Flag): boolean {
  return use(FlagsContext).can(flag)
}
```

- [ ] **Step 6: Rewrite the role half of `hooks/use-supabase-auth.ts`**

Replace the `role` import, state, type field, read and return. The profile select loses `role`; `my_features()` runs alongside it.

```ts
import { type Flag } from '@/constants/features'
import { knownFeatures, sameFeatures } from '@/lib/features'
```

In `AuthState`, replace the `role` field:

```ts
// What this player may be shown — the empty set for all but a handful. Resolved on the
// server by `effective_features`, which is the only place the rules are written;
// handed on to FlagsProvider, which is what reads it.
//
// Once per launch is the whole story of when a change takes effect: an admin editing a
// stack moves everybody, and each device picks it up on its next start.
//
// Referentially stable while the keys do not change — see `sameFeatures`. The analytics
// opt-out below keys an effect on this value, and a set rebuilt per render would leave
// that effect never settling.
features: ReadonlySet<Flag>
```

The state and the read:

```ts
const EMPTY_FEATURES: ReadonlySet<Flag> = new Set()

// …inside the hook:
const [features, setFeatures] = useState<ReadonlySet<Flag>>(EMPTY_FEATURES)
```

Inside the `if (uid !== null)` branch, the select drops `role` and a second request runs
in parallel with it:

```ts
// The profile read and the feature read are one round trip's worth of waiting
// rather than two, and they are about different things: one asks whether this
// session still names a real row, the other asks what that person may be shown.
const [profile, featureRows] = await Promise.all([
  supabase.from('profiles').select('nickname').eq('id', uid).maybeSingle(),
  supabase.rpc('my_features'),
])
const { data, error } = profile

if (error === null && data === null) {
  await supabase.auth.signOut({ scope: 'local' })
  uid = null
} else {
  nick = typeof data?.nickname === 'string' ? data.nickname : null
  // A failed feature read is an ordinary player, not an error worth a screen:
  // the doors it would have opened are all unfinished work, and showing none of
  // them is the right answer to not knowing.
  held = knownFeatures(
    Array.isArray(featureRows.data) ? (featureRows.data as string[]) : [],
  )
}
```

Declare `held` as `let held: ReadonlySet<Flag> = EMPTY_FEATURES` at the top of the effect, in place of the old `let held: Role | null = null`.

The commit of state keeps the identity stable:

```ts
if (uid !== null) {
  setUserId(uid)
  setNickname(nick)
  // Keep the previous set when the keys have not changed, so consumers keying an
  // effect on this value are not re-run by a new object that says the same thing.
  setFeatures((current) => (sameFeatures(current, held) ? current : held))
}
```

And the return: `return { userId, nickname, features, isReady, updateNickname }`.

- [ ] **Step 7: Update `app/(tabs)/index.tsx`**

At line 565, destructure `features` instead of `role`. At 571-579, the comment and the call:

```tsx
// Analytics reuses the identity the boards already rank — the anonymous Supabase user
// id — so an event can be read next to the score it produced. Re-runs when the
// nickname lands or changes, which just refreshes the person's properties.
//
// The opt-out runs first: whoever reaches the `admin` feature is kept out of the data
// entirely rather than filtered out of it afterwards, and ordering this ahead of
// `identify` is what keeps an admin's own playing from ever becoming a person in the
// project in the first place. The question is the feature rather than the role,
// because a custom role granting `admin` opens the same screen.
useEffect(() => {
  if (userId === null) return
  setAdminOptOut(features.has('admin'))
  identify(userId, nickname)
}, [userId, nickname, features])
```

At line 1310:

```tsx
    <FlagsProvider features={features}>
```

- [ ] **Step 8: Update `dev/gallery.tsx`**

Both call sites. The comments say "admin" and must stop — admin is no longer a synonym for everything, and with `multiplayer` inactive it is not even close.

Add `import { FLAGS } from '@/constants/features'` and a module-level constant:

```tsx
// Every door open. The gallery exists to put a screen in front of you; one that hid the
// With friends tabs because the desk it runs on reaches nothing would be a gallery with
// a hole in it. This used to say `role="admin"`, which stopped being the same thing the
// moment a feature could be switched off for everybody — `multiplayer` is, and an admin
// does not reach it.
const EVERY_FEATURE = new Set(FLAGS)
```

Replace both `<FlagsProvider role="admin">` with `<FlagsProvider features={EVERY_FEATURE}>`, and both surrounding comments with a pointer to `EVERY_FEATURE`.

- [ ] **Step 9: Delete the ladder**

```bash
git rm lib/role.ts lib/role.test.ts
```

`lib/admin-roles.ts` still imports from it and will not compile. That is expected and Task 6 replaces the file; to keep this task's commit green, change its two imports to local types for now:

```ts
// Temporary: lib/admin/ replaces this file in the next commit.
type Role = string
const parseRole = (value: unknown): string | null =>
  typeof value === 'string' ? value : null
```

- [ ] **Step 10: Verify**

Run: `pnpm check`
Expected: PASS apart from the known `arcade-siege` worktree failure. Specifically confirm `knip` reports no unused export — `FLAGS` is now an array consumed by `lib/features.ts` and `dev/gallery.tsx`.

Run: `grep -rn "parseRole\|ROLE_RANK\|holds(" app components hooks lib modes dev`
Expected: no hits outside the temporary shim in `lib/admin-roles.ts`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(features): read the resolved feature set instead of a role

constants/features.ts is the list of keys the code has guards for and
nothing else. FlagsProvider takes the set the server resolved;
useSupabaseAuth asks my_features() alongside the profile read rather
than selecting a column.

The set is referentially stable while its keys are, because the
analytics opt-out keys an effect on it.

lib/role.ts is deleted. ROLE_RANK, Floor, holds and parseRole all
described a ladder that no longer exists, and the gallery's
`role="admin"` with it — admin stopped meaning "everything" the moment a
feature could be switched off for everybody.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 6: The admin data layer

**Files:**

- Create: `lib/admin/people.ts`, `lib/admin/roles.ts`, `lib/admin/features.ts`
- Delete: `lib/admin-roles.ts`
- Modify: `components/overlays/admin-overlay.tsx` (imports only, to keep it compiling)

**Interfaces:**

- Consumes: every RPC from Task 3; `Override` from `@/lib/features`.
- Produces the types and functions listed in each step below. Later tasks import exactly these names.

There are no tests in this task. This repo has no Supabase mocking and no precedent for testing these wrappers — `lib/admin-roles.ts` has none either. The RPCs they call are covered by `supabase/tests/features.sql`; what is left here is argument passing, and `tsc` is what checks it.

- [ ] **Step 1: Write `lib/admin/people.ts`**

```ts
import { noteRequest } from '@/lib/connectivity'
import { type Override } from '@/lib/features'
import { supabase } from '@/lib/supabase'

// The people half of the admin screen. Reads go through the `admin_people` family
// rather than a select on `profiles`, because the screen wants counts the table cannot
// give it — how many features somebody actually reaches, after their role, their
// overrides and the master switches have all been applied.

export type AdminPerson = {
  id: string
  nickname: string | null
  role: string | null
  featureCount: number
  hasOverrides: boolean
}

type PersonRow = {
  id: string
  nickname: string | null
  role: string | null
  feature_count: number
  has_overrides: boolean
}

const toPerson = (row: PersonRow): AdminPerson => ({
  id: row.id,
  nickname: row.nickname,
  role: row.role,
  featureCount: row.feature_count,
  hasOverrides: row.has_overrides,
})

// Everybody the screen has anything to say about: a role, overrides, or both. The old
// version of this asked for `role is not null`, which was the whole list until a person
// could differ from their role without holding one.
export async function listAdminPeople(): Promise<{
  rows: AdminPerson[]
  error: string | null
}> {
  const res = await supabase.rpc('admin_people')
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return { rows: ((res.data as PersonRow[] | null) ?? []).map(toPerson), error: null }
}

// Null means nobody is registered under that name, not that the request failed — the
// search box reads `error` for that. `nickname` is `citext unique`, so at most one row
// can ever answer.
export async function findPersonByNickname(nickname: string): Promise<{
  row: AdminPerson | null
  error: string | null
}> {
  const res = await supabase.rpc('admin_find_person', { p_nickname: nickname })
  noteRequest(res.error)
  if (res.error) return { row: null, error: res.error.message }
  const rows = (res.data as PersonRow[] | null) ?? []
  return { row: rows.length === 0 ? null : toPerson(rows[0]), error: null }
}

// One row per feature, with everything the person screen needs to say where the answer
// came from rather than only what it is.
export type PersonFeature = {
  key: string
  override: Override
  inRoleStack: boolean
  active: boolean
}

type PersonFeatureRow = {
  key: string
  override: boolean | null
  in_role_stack: boolean
  active: boolean
}

export async function loadPersonFeatures(userId: string): Promise<{
  rows: PersonFeature[]
  error: string | null
}> {
  const res = await supabase.rpc('person_features', { p_user_id: userId })
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as PersonFeatureRow[] | null) ?? []).map((row) => ({
      key: row.key,
      override: row.override,
      inRoleStack: row.in_role_stack,
      active: row.active,
    })),
    error: null,
  }
}

// Setting a role, or taking it away with `null`. Through the RPC rather than an update —
// `profiles.role` is not in the authenticated grant at all, and the function is what
// checks the caller reaches `admin` before writing, which a client-side check never
// could. It also refuses to leave the caller, or everybody, without admin.
export async function setUserRole(
  userId: string,
  role: string | null,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// `granted` null deletes the override, which is how a feature goes back to inheriting.
export async function setUserFeature(
  userId: string,
  key: string,
  granted: Override,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_user_feature', {
    p_user_id: userId,
    p_key: key,
    p_granted: granted,
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

export async function resetUserFeatures(
  userId: string,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('reset_user_features', { p_user_id: userId })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
```

- [ ] **Step 2: Write `lib/admin/roles.ts`**

```ts
import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// The roles half. A role is a name and a stack of features, flat — nothing inherits from
// anything, so a role's stack is exactly the rows `role_feature_keys` returns.

export type AdminRole = {
  key: string
  label: string
  featureCount: number
  personCount: number
}

type RoleRow = {
  key: string
  label: string
  feature_count: number
  person_count: number
}

export async function listRoles(): Promise<{
  rows: AdminRole[]
  error: string | null
}> {
  const res = await supabase.rpc('role_stats')
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as RoleRow[] | null) ?? []).map((row) => ({
      key: row.key,
      label: row.label,
      featureCount: row.feature_count,
      personCount: row.person_count,
    })),
    error: null,
  }
}

export async function loadRoleFeatures(
  roleKey: string,
): Promise<{ keys: string[]; error: string | null }> {
  const res = await supabase.rpc('role_feature_keys', { p_role: roleKey })
  noteRequest(res.error)
  if (res.error) return { keys: [], error: res.error.message }
  return { keys: (res.data as string[] | null) ?? [], error: null }
}

export async function createRole(
  key: string,
  label: string,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('create_role', { p_key: key, p_label: label })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

export async function renameRole(
  key: string,
  label: string,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('rename_role', { p_key: key, p_label: label })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

// Refused while anybody holds it. The error says how many, because a constraint name is
// not something to show to somebody holding a phone.
export async function deleteRole(key: string): Promise<{ error: string | null }> {
  const res = await supabase.rpc('delete_role', { p_key: key })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}

export async function setRoleFeature(
  roleKey: string,
  featureKey: string,
  on: boolean,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_role_feature', {
    p_role: roleKey,
    p_key: featureKey,
    p_on: on,
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
```

- [ ] **Step 3: Write `lib/admin/features.ts`**

```ts
import { FLAGS } from '@/constants/features'
import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// The features half. Rows are created and removed by migration, never here — a key means
// something only because the client holds a guard for it. What this edits is the master
// switch and the note beside it.

export type AdminFeature = {
  key: string
  active: boolean
  note: string | null
  roleCount: number
  // After resolution: people who actually end up with it, overrides included. That is
  // the number somebody about to flip the switch wants.
  personCount: number
  // Whether this build has a guard for the key. False is a row the database holds and
  // the code no longer does — left behind by a migration, or a device older than the
  // server. Worth showing rather than hiding: unseen configuration is how it goes stale.
  inBuild: boolean
}

type FeatureRow = {
  key: string
  active: boolean
  note: string | null
  role_count: number
  person_count: number
}

const BUILT: ReadonlySet<string> = new Set(FLAGS)

export async function listFeatures(): Promise<{
  rows: AdminFeature[]
  error: string | null
}> {
  const res = await supabase.rpc('feature_stats')
  noteRequest(res.error)
  if (res.error) return { rows: [], error: res.error.message }
  return {
    rows: ((res.data as FeatureRow[] | null) ?? []).map((row) => ({
      key: row.key,
      active: row.active,
      note: row.note,
      roleCount: row.role_count,
      personCount: row.person_count,
      inBuild: BUILT.has(row.key),
    })),
    error: null,
  }
}

export async function setFeature(
  key: string,
  active: boolean,
  note: string | null,
): Promise<{ error: string | null }> {
  const res = await supabase.rpc('set_feature', {
    p_key: key,
    p_active: active,
    p_note: note,
  })
  noteRequest(res.error)
  return { error: res.error?.message ?? null }
}
```

- [ ] **Step 4: Delete the old file and point the screen at the new one**

```bash
git rm lib/admin-roles.ts
```

`components/overlays/admin-overlay.tsx` is rebuilt in Task 7. This edit is only enough to keep the tree compiling in between, so make exactly these four changes and nothing else.

Replace the import block at the top (lines 12-19 today):

```tsx
import { ScreenLayer } from '@/components/screen'
import {
  findPersonByNickname,
  listAdminPeople,
  setUserRole,
  type AdminPerson,
} from '@/lib/admin/people'
import { cn } from '@/lib/cn'
```

Delete the `ROLE_LABEL` and `PICKER_OPTIONS` consts — both named the three roles that are rows now, and `ROLES` came from the deleted `lib/role.ts`. Replace them with a list read from the database once, which is the shape Task 7 keeps:

```tsx
// Three names written into the file was the old ladder showing. Task 7 reads these from
// `role_stats()`; until then the screen keeps working on the three the migration seeds.
const PICKER_OPTIONS: readonly (string | null)[] = [null, 'tester', 'developer', 'admin']
```

In `RolePicker`, change the prop types from `Role | null` to `string | null` and the label expression from `ROLE_LABEL[option]` to `option.toUpperCase()`:

```tsx
function RolePicker({
  current,
  busy,
  onPick,
}: {
  current: string | null
  busy: boolean
  onPick: (role: string | null) => void
}) {
```

```tsx
{
  option === null ? 'NONE' : option.toUpperCase()
}
```

Then replace every remaining `RoledProfile` with `AdminPerson`, every `listRoledProfiles` with `listAdminPeople`, every `findProfileByNickname` with `findPersonByNickname`, and the `handlePick` signature's `role: Role | null` with `role: string | null`.

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: PASS apart from the known `arcade-siege` worktree failure.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -F - <<'EOF'
refactor(admin): split the admin data layer by the three objects it has

lib/admin-roles.ts becomes lib/admin/{people,roles,features}.ts. Reads go
through the RPCs from the migration rather than selects, because the
screen wants counts no table can give it — how many features somebody
actually reaches once their role, their overrides and the master
switches have been applied.

The people list stops asking for `role is not null`: that was the whole
list until a person could differ from their role without holding one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 7: The hub and the PEOPLE tab

**Files:**

- Modify: `components/overlays/admin-overlay.tsx`
- Create: `components/overlays/admin-people.tsx`
- Modify: `constants/buttons.ts`

**Interfaces:**

- Consumes: `listAdminPeople`, `findPersonByNickname`, `AdminPerson` from `@/lib/admin/people`.
- Produces: `AdminOverlay({ onClose })` rendering a three-pill tab bar over one of three panes; `AdminPeople({ onOpenPerson })` where `onOpenPerson: (person: AdminPerson) => void`.

- [ ] **Step 1: Add the button ids**

In `constants/buttons.ts`, in the `// ── Dev and admin ──` block at line 133, replace `'admin.row'` / `'admin.set_role'` and add the rest:

```ts
  | 'admin.tab'
  | 'admin.find'
  | 'admin.person'
  | 'admin.person_role'
  | 'admin.person_feature'
  | 'admin.person_reset'
  | 'admin.role'
  | 'admin.role_new'
  | 'admin.role_rename'
  | 'admin.role_delete'
  | 'admin.role_feature'
  | 'admin.feature_active'
  | 'admin.back'
  | 'admin.done'
```

- [ ] **Step 2: Write the hub**

Rewrite `components/overlays/admin-overlay.tsx` as the shell. Keep `ScreenLayer`, the title, and the DONE button; everything between them becomes the tab bar and one pane.

```tsx
import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { AdminFeatures } from '@/components/overlays/admin-features'
import { AdminPeople } from '@/components/overlays/admin-people'
import { AdminPerson } from '@/components/overlays/admin-person'
import { AdminRole } from '@/components/overlays/admin-role'
import { AdminRoles } from '@/components/overlays/admin-roles'
import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { type AdminPerson as Person } from '@/lib/admin/people'
import { type AdminRole as Role } from '@/lib/admin/roles'
import { cn } from '@/lib/cn'

// Three objects now — people, roles, features — so three tabs. Pills rather than a new
// shared control: the role picker on the person screen is already this shape, and a
// second way of drawing the same affordance is a second thing to keep in step.
//
// The detail screens are state here rather than panes of their own, because both are
// reached from a list and both go back to it: holding the open person or role on the hub
// is what makes a single BACK work for either.
type Tab = 'people' | 'roles' | 'features'

const TABS: readonly Tab[] = ['people', 'roles', 'features']

const TAB_LABEL: Record<Tab, string> = {
  people: 'PEOPLE',
  roles: 'ROLES',
  features: 'FEATURES',
}

export function AdminOverlay({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('people')
  const [person, setPerson] = useState<Person | null>(null)
  const [role, setRole] = useState<Role | null>(null)

  // One place rather than three: every list is a snapshot, and an edit on a detail
  // screen has to be able to tell the list behind it to read again.
  const [epoch, setEpoch] = useState(0)
  const refresh = () => {
    setEpoch((n) => n + 1)
  }

  if (person !== null) {
    return (
      <AdminPerson
        person={person}
        onChanged={refresh}
        onBack={() => {
          setPerson(null)
        }}
        onClose={onClose}
      />
    )
  }

  if (role !== null) {
    return (
      <AdminRole
        role={role}
        onChanged={refresh}
        onBack={() => {
          setRole(null)
        }}
        onClose={onClose}
      />
    )
  }

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <Text
        selectable={false}
        className="mb-1 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        <Trans>ADMIN</Trans>
      </Text>
      <Text
        selectable={false}
        className="mb-4 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Trans>WHO SEES WHAT</Trans>
      </Text>

      <View className="mb-4 flex-row gap-1.5">
        {TABS.map((option) => {
          const active = option === tab
          return (
            <TrackedPressable
              key={option}
              id="admin.tab"
              onPress={() => {
                setTab(option)
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5',
                active ? 'border-strong bg-strong' : 'border-dim/30',
              )}
            >
              <Text
                selectable={false}
                className={cn(
                  'font-mono text-[10px] font-black tracking-[1px]',
                  active ? 'text-on-strong' : 'text-dim',
                )}
              >
                {TAB_LABEL[option]}
              </Text>
            </TrackedPressable>
          )
        })}
      </View>

      {tab === 'people' && <AdminPeople epoch={epoch} onOpenPerson={setPerson} />}
      {tab === 'roles' && (
        <AdminRoles epoch={epoch} onOpenRole={setRole} onChanged={refresh} />
      )}
      {tab === 'features' && <AdminFeatures epoch={epoch} onChanged={refresh} />}

      <TrackedPressable
        id="admin.done"
        onPress={onClose}
        className="mt-4 items-center self-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </TrackedPressable>
    </ScreenLayer>
  )
}
```

Tab labels are plain strings, not `<Trans>` — they name the three database objects and
sit beside role labels that cannot be translated either. Translating one half of a row
of pills would read worse than translating neither.

- [ ] **Step 3: Write the PEOPLE pane**

Create `components/overlays/admin-people.tsx`. The search box and its error handling are
lifted from the current `admin-overlay.tsx:131-220` unchanged in behaviour; what is new
is that a row is a link to a detail screen rather than a role picker in place.

```tsx
import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import {
  findPersonByNickname,
  listAdminPeople,
  type AdminPerson,
} from '@/lib/admin/people'
import { cn } from '@/lib/cn'

function PersonRow({ person, onPress }: { person: AdminPerson; onPress: () => void }) {
  return (
    <TrackedPressable
      id="admin.person"
      onPress={onPress}
      className="flex-row items-center justify-between py-2.5"
    >
      <Text
        selectable={false}
        className="flex-1 font-mono text-[12px] font-black tracking-[0.5px] text-primary"
      >
        {person.nickname ?? <Trans>(no nickname)</Trans>}
      </Text>
      <Text
        selectable={false}
        className="w-24 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        {person.role ?? ''}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        {/* The count is features in effect, and the star marks somebody whose count is
            not their role's — the one thing a list of people can usefully say about an
            override without opening anybody. */}
        {person.featureCount}
        {person.hasOverrides ? ' ✦' : '  '}
      </Text>
    </TrackedPressable>
  )
}

export function AdminPeople({
  epoch,
  onOpenPerson,
}: {
  epoch: number
  onOpenPerson: (person: AdminPerson) => void
}) {
  const [rows, setRows] = useState<AdminPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<AdminPerson | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const res = await listAdminPeople()
      setRows(res.rows)
      setListError(res.error)
      setLoading(false)
    })()
  }, [epoch])

  const handleSearch = async () => {
    const trimmed = query.trim()
    if (trimmed === '') return
    setSearching(true)
    setSearchError(null)
    setSearchResult(null)
    const res = await findPersonByNickname(trimmed)
    setSearching(false)
    if (res.error !== null) {
      setSearchError(res.error)
    } else if (res.row === null) {
      setSearchError('No profile with that nickname.')
    } else {
      setSearchResult(res.row)
    }
  }

  return (
    <View className="flex-1">
      <View className="mb-2 flex-row gap-2">
        <TextInput
          value={query}
          onChangeText={(next) => {
            setQuery(next)
            setSearchError(null)
          }}
          placeholder="nickname"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            void handleSearch()
          }}
          className="flex-1 rounded-lg border border-dim/30 bg-background px-3 py-2 font-mono font-bold tracking-[1px] text-primary"
        />
        <TrackedPressable
          id="admin.find"
          onPress={() => {
            void handleSearch()
          }}
          disabled={searching || query.trim() === ''}
          className={cn(
            'items-center justify-center rounded-lg bg-strong px-4',
            (searching || query.trim() === '') && 'opacity-40',
          )}
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[1px] text-on-strong"
          >
            <Trans>FIND</Trans>
          </Text>
        </TrackedPressable>
      </View>

      {searching && <ActivityIndicator className="my-2" />}
      {searchError !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
        >
          {searchError}
        </Text>
      )}
      {searchResult !== null && (
        <View className="mb-4 rounded-xl border border-dim/20 px-3">
          <PersonRow
            person={searchResult}
            onPress={() => {
              onOpenPerson(searchResult)
            }}
          />
        </View>
      )}

      <Text
        selectable={false}
        className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Trans>EVERYONE WITH A ROLE OR AN OVERRIDE</Trans>
      </Text>
      {loading ? (
        <ActivityIndicator className="my-4" />
      ) : listError !== null ? (
        <Text selectable={false} className="font-mono text-[11px] font-bold text-red-500">
          {listError}
        </Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => (
            <PersonRow
              person={item}
              onPress={() => {
                onOpenPerson(item)
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text
              selectable={false}
              className="font-mono text-[12px] font-medium text-dim"
            >
              <Trans>Nobody holds a role yet.</Trans>
            </Text>
          }
        />
      )}
    </View>
  )
}
```

- [ ] **Step 4: Verify**

Tasks 8-10 fill in four of the five components this hub imports; until then `tsc` fails
on the missing modules. The hub and its panes are one compilation unit, so create all
four now with their real signatures and an empty body. These are the exact props each
later task implements against — copy them verbatim.

`components/overlays/admin-person.tsx`:

```tsx
import { type AdminPerson as Person } from '@/lib/admin/people'

// Filled in Task 8.
export function AdminPerson(_props: {
  person: Person
  onChanged: () => void
  onBack: () => void
  onClose: () => void
}) {
  return null
}
```

`components/overlays/admin-roles.tsx`:

```tsx
import { type AdminRole } from '@/lib/admin/roles'

// Filled in Task 9.
export function AdminRoles(_props: {
  epoch: number
  onOpenRole: (role: AdminRole) => void
  onChanged: () => void
}) {
  return null
}
```

`components/overlays/admin-role.tsx`:

```tsx
import { type AdminRole as Role } from '@/lib/admin/roles'

// Filled in Task 9.
export function AdminRole(_props: {
  role: Role
  onChanged: () => void
  onBack: () => void
  onClose: () => void
}) {
  return null
}
```

`components/overlays/admin-features.tsx`:

```tsx
// Filled in Task 10.
export function AdminFeatures(_props: { epoch: number; onChanged: () => void }) {
  return null
}
```

Run: `pnpm check`
Expected: PASS apart from the known `arcade-siege` worktree failure.

Run: `pnpm i18n:extract` and translate the two new strings into Czech:
`WHO SEES WHAT` → `KDO CO VIDÍ`, `EVERYONE WITH A ROLE OR AN OVERRIDE` → `VŠICHNI S ROLÍ NEBO VÝJIMKOU`.

Run: `pnpm check` again.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(admin): make the admin screen a three-tab hub

People, roles and features are three objects now, so the screen is three
panes with a detail view behind two of them. The detail views are state
on the hub rather than panes of their own, which is what makes one BACK
work for either.

A person row is a link now rather than a role picker in place: a role is
no longer the only thing there is to say about somebody.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 8: The person detail

**Files:**

- Modify: `components/overlays/admin-person.tsx` (replacing the stub)

**Interfaces:**

- Consumes: `loadPersonFeatures`, `setUserRole`, `setUserFeature`, `resetUserFeatures`, `PersonFeature`, `AdminPerson` from `@/lib/admin/people`; `listRoles`, `AdminRole` from `@/lib/admin/roles`; `cycleOverride`, `sourceOf`, `FeatureSource` from `@/lib/features`.
- Produces: `AdminPerson({ person, onChanged, onBack, onClose })`.

- [ ] **Step 1: Write the component**

```tsx
import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'

import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import {
  loadPersonFeatures,
  resetUserFeatures,
  setUserFeature,
  setUserRole,
  type AdminPerson as Person,
  type PersonFeature,
} from '@/lib/admin/people'
import { listRoles, type AdminRole } from '@/lib/admin/roles'
import { cn } from '@/lib/cn'
import { cycleOverride, sourceOf, type FeatureSource } from '@/lib/features'

// What each of the five answers says on the row. The point of printing the *source*
// rather than only the state is that "why can this person see this" is answerable here
// rather than by opening the other two tabs and doing the arithmetic.
const SOURCE_LABEL: Record<FeatureSource, string> = {
  inactive: 'off for everyone',
  'role-on': 'from role',
  'role-off': 'from role',
  'override-on': 'override',
  'override-off': 'override',
}

const isOn = (source: FeatureSource) => source === 'role-on' || source === 'override-on'

function FeatureRow({
  row,
  busy,
  onCycle,
}: {
  row: PersonFeature
  busy: boolean
  onCycle: () => void
}) {
  const source = sourceOf(row)
  // An inactive feature is nobody's to change from here — the switch for it is on the
  // FEATURES tab, and offering a tap that cannot take effect would be a lie.
  const locked = source === 'inactive'
  return (
    <TrackedPressable
      id="admin.person_feature"
      onPress={onCycle}
      disabled={busy || locked}
      className={cn('flex-row items-center py-2', (busy || locked) && 'opacity-40')}
    >
      <Text
        selectable={false}
        className="w-5 font-mono text-[12px] font-black text-primary"
      >
        {isOn(source) ? '●' : '○'}
      </Text>
      <Text
        selectable={false}
        className={cn(
          'flex-1 font-mono text-[12px] font-bold tracking-[0.5px] text-primary',
          locked && 'line-through',
        )}
      >
        {row.key}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[10px] font-medium tracking-[0.5px] text-dim"
      >
        {SOURCE_LABEL[source]}
      </Text>
    </TrackedPressable>
  )
}

export function AdminPerson({
  person,
  onChanged,
  onBack,
  onClose,
}: {
  person: Person
  onChanged: () => void
  onBack: () => void
  onClose: () => void
}) {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [rows, setRows] = useState<PersonFeature[]>([])
  const [role, setRole] = useState<string | null>(person.role)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    const [roleList, featureList] = await Promise.all([
      listRoles(),
      loadPersonFeatures(person.id),
    ])
    setRoles(roleList.rows)
    setRows(featureList.rows)
    setError(roleList.error ?? featureList.error)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // Reading once on open: the lists behind this screen are snapshots too, and every
    // write below reloads deliberately rather than on a dependency changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id])

  // Every write is the same three moves — say busy, call, read the whole person back —
  // because a refused write is as interesting as an accepted one here. The guards can
  // refuse any of these, and the row has to go back to what the server actually holds
  // rather than to what the tap assumed.
  const write = async (call: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const res = await call()
    setError(res.error)
    await reload()
    setBusy(false)
    if (res.error === null) onChanged()
  }

  const hasOverrides = rows.some((row) => row.override !== null)

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <View className="mb-4 flex-row items-center gap-3">
        <TrackedPressable id="admin.back" onPress={onBack} hitSlop={8}>
          <Text selectable={false} className="font-mono text-[16px] font-black text-dim">
            ‹
          </Text>
        </TrackedPressable>
        <Text
          selectable={false}
          className="font-mono text-[18px] font-black tracking-[2px] text-primary"
        >
          {person.nickname ?? <Trans>(no nickname)</Trans>}
        </Text>
      </View>

      {error !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
        >
          {error}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator className="my-4" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text
            selectable={false}
            className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            <Trans>ROLE</Trans>
          </Text>
          {/* NONE leftmost, as it has been: it is the one option that undoes the other
              three, and any order that put it last would bury it. */}
          <View className="mb-5 flex-row flex-wrap gap-1.5">
            {[null, ...roles.map((r) => r.key)].map((option) => {
              const active = option === role
              return (
                <TrackedPressable
                  key={option ?? 'none'}
                  id="admin.person_role"
                  disabled={busy || active}
                  onPress={() => {
                    setRole(option)
                    void write(() => setUserRole(person.id, option))
                  }}
                  className={cn(
                    'rounded-lg border px-2.5 py-1',
                    active ? 'border-strong bg-strong' : 'border-dim/30',
                    busy && !active && 'opacity-40',
                  )}
                >
                  <Text
                    selectable={false}
                    className={cn(
                      'font-mono text-[9px] font-black tracking-[1px]',
                      active ? 'text-on-strong' : 'text-dim',
                    )}
                  >
                    {option === null
                      ? 'NONE'
                      : (roles.find((r) => r.key === option)?.label ?? option)}
                  </Text>
                </TrackedPressable>
              )
            })}
          </View>

          <Text
            selectable={false}
            className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            <Trans>FEATURES</Trans>
          </Text>
          {rows.map((row) => (
            <FeatureRow
              key={row.key}
              row={row}
              busy={busy}
              onCycle={() => {
                void write(() =>
                  setUserFeature(person.id, row.key, cycleOverride(row.override)),
                )
              }}
            />
          ))}

          <TrackedPressable
            id="admin.person_reset"
            disabled={busy || !hasOverrides}
            onPress={() => {
              void write(() => resetUserFeatures(person.id))
            }}
            className={cn(
              'mt-5 items-center rounded-xl border border-dim/30 py-3',
              (busy || !hasOverrides) && 'opacity-40',
            )}
          >
            <Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[1.5px] text-dim"
            >
              <Trans>RESET TO ROLE DEFAULTS</Trans>
            </Text>
          </TrackedPressable>
        </ScrollView>
      )}

      <TrackedPressable
        id="admin.done"
        onPress={onClose}
        className="mt-4 items-center self-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </TrackedPressable>
    </ScreenLayer>
  )
}
```

- [ ] **Step 2: Verify and translate**

Run: `pnpm check`
Expected: PASS apart from the known worktree failure.

Run: `pnpm i18n:extract`, then translate the new strings:
`ROLE` → `ROLE`, `FEATURES` → `FUNKCE`, `RESET TO ROLE DEFAULTS` → `ZPĚT NA VÝCHOZÍ ROLI`.

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(admin): edit one person's role and their overrides

Each feature row cycles inherit, on, off, and says which of the three it
is reading — the source rather than only the state, so "why can this
person see this" is answerable without opening the other two tabs.

Every write reloads the whole person rather than patching the row. The
lockout guards can refuse any of these, and a refused tap has to leave
the screen showing what the server holds, not what the tap assumed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 9: The ROLES tab

**Files:**

- Modify: `components/overlays/admin-roles.tsx`, `components/overlays/admin-role.tsx` (replacing the stubs)

**Interfaces:**

- Consumes: `listRoles`, `loadRoleFeatures`, `createRole`, `renameRole`, `deleteRole`, `setRoleFeature`, `AdminRole` from `@/lib/admin/roles`; `listFeatures`, `AdminFeature` from `@/lib/admin/features`.
- Produces: `AdminRoles({ epoch, onOpenRole, onChanged })`, `AdminRole({ role, onChanged, onBack, onClose })`.

- [ ] **Step 1: Write the list pane**

`components/overlays/admin-roles.tsx`:

```tsx
import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { createRole, listRoles, type AdminRole } from '@/lib/admin/roles'
import { cn } from '@/lib/cn'

// A role key is what `profiles.role` stores, so it has to survive being typed into a
// phone: lower case, no spaces. The label is free.
const toKey = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function AdminRoles({
  epoch,
  onOpenRole,
  onChanged,
}: {
  epoch: number
  onOpenRole: (role: AdminRole) => void
  onChanged: () => void
}) {
  const [rows, setRows] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const res = await listRoles()
      setRows(res.rows)
      setError(res.error)
      setLoading(false)
    })()
  }, [epoch])

  const handleCreate = async () => {
    const label = draft.trim().toUpperCase()
    const key = toKey(draft)
    if (key === '') return
    setBusy(true)
    const res = await createRole(key, label)
    setBusy(false)
    setError(res.error)
    if (res.error === null) {
      setDraft('')
      onChanged()
    }
  }

  return (
    <View className="flex-1">
      <View className="mb-3 flex-row gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="new role"
          autoCapitalize="characters"
          autoCorrect={false}
          className="flex-1 rounded-lg border border-dim/30 bg-background px-3 py-2 font-mono font-bold tracking-[1px] text-primary"
        />
        <TrackedPressable
          id="admin.role_new"
          onPress={() => {
            void handleCreate()
          }}
          disabled={busy || draft.trim() === ''}
          className={cn(
            'items-center justify-center rounded-lg bg-strong px-4',
            (busy || draft.trim() === '') && 'opacity-40',
          )}
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[1px] text-on-strong"
          >
            <Trans>ADD</Trans>
          </Text>
        </TrackedPressable>
      </View>

      {error !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
        >
          {error}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator className="my-4" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) => (
            <TrackedPressable
              id="admin.role"
              onPress={() => {
                onOpenRole(item)
              }}
              className="flex-row items-center justify-between py-2.5"
            >
              <Text
                selectable={false}
                className="flex-1 font-mono text-[12px] font-black tracking-[1px] text-primary"
              >
                {item.label}
              </Text>
              <Text
                selectable={false}
                className="font-mono text-[10px] font-medium tracking-[0.5px] text-dim"
              >
                {item.featureCount} · {item.personCount}
              </Text>
            </TrackedPressable>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}
```

- [ ] **Step 2: Write the role detail**

`components/overlays/admin-role.tsx`:

```tsx
import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'

import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { listFeatures, type AdminFeature } from '@/lib/admin/features'
import {
  deleteRole,
  loadRoleFeatures,
  renameRole,
  setRoleFeature,
  type AdminRole as Role,
} from '@/lib/admin/roles'
import { cn } from '@/lib/cn'

export function AdminRole({
  role,
  onChanged,
  onBack,
  onClose,
}: {
  role: Role
  onChanged: () => void
  onBack: () => void
  onClose: () => void
}) {
  const [features, setFeatures] = useState<AdminFeature[]>([])
  const [stack, setStack] = useState<ReadonlySet<string>>(new Set())
  const [label, setLabel] = useState(role.label)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    const [all, mine] = await Promise.all([listFeatures(), loadRoleFeatures(role.key)])
    setFeatures(all.rows)
    setStack(new Set(mine.keys))
    setError(all.error ?? mine.error)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role.key])

  const write = async (call: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const res = await call()
    setError(res.error)
    await reload()
    setBusy(false)
    if (res.error === null) onChanged()
  }

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <View className="mb-1 flex-row items-center gap-3">
        <TrackedPressable id="admin.back" onPress={onBack} hitSlop={8}>
          <Text selectable={false} className="font-mono text-[16px] font-black text-dim">
            ‹
          </Text>
        </TrackedPressable>
        <TextInput
          value={label}
          onChangeText={setLabel}
          onBlur={() => {
            if (label.trim() !== '' && label !== role.label) {
              void write(() => renameRole(role.key, label.trim()))
            }
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          className="flex-1 font-mono text-[18px] font-black tracking-[2px] text-primary"
        />
      </View>
      <Text
        selectable={false}
        className="mb-4 ml-6 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        {/* The count is the warning: editing the stack below moves every one of them who
            has not overridden the feature being changed. */}
        {role.personCount} <Trans>holding this role</Trans>
      </Text>

      {error !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
        >
          {error}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator className="my-4" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text
            selectable={false}
            className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            <Trans>FEATURES IN THIS STACK</Trans>
          </Text>
          {/* Plain on and off — a stack has no third state. The tri-state belongs to one
              person's overrides, which is the other screen. */}
          {features.map((feature) => {
            const on = stack.has(feature.key)
            return (
              <TrackedPressable
                key={feature.key}
                id="admin.role_feature"
                disabled={busy}
                onPress={() => {
                  void write(() => setRoleFeature(role.key, feature.key, !on))
                }}
                className={cn('flex-row items-center py-2', busy && 'opacity-40')}
              >
                <Text
                  selectable={false}
                  className="w-5 font-mono text-[12px] font-black text-primary"
                >
                  {on ? '●' : '○'}
                </Text>
                <Text
                  selectable={false}
                  className={cn(
                    'flex-1 font-mono text-[12px] font-bold tracking-[0.5px] text-primary',
                    !feature.active && 'line-through',
                  )}
                >
                  {feature.key}
                </Text>
                {!feature.active && (
                  <Text
                    selectable={false}
                    className="font-mono text-[10px] font-medium text-dim"
                  >
                    <Trans>off for everyone</Trans>
                  </Text>
                )}
              </TrackedPressable>
            )
          })}

          <TrackedPressable
            id="admin.role_delete"
            disabled={busy || role.personCount > 0}
            onPress={() => {
              void write(async () => {
                const res = await deleteRole(role.key)
                if (res.error === null) onBack()
                return res
              })
            }}
            className={cn(
              'mt-5 items-center rounded-xl border border-red-500/40 py-3',
              (busy || role.personCount > 0) && 'opacity-40',
            )}
          >
            <Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[1.5px] text-red-500"
            >
              <Trans>DELETE ROLE</Trans>
            </Text>
          </TrackedPressable>
        </ScrollView>
      )}

      <TrackedPressable
        id="admin.done"
        onPress={onClose}
        className="mt-4 items-center self-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </TrackedPressable>
    </ScreenLayer>
  )
}
```

Note `admin.role_rename` is in the `ButtonId` union from Task 7 but unused here — the
rename happens on blur of a `TextInput`, not a press. Remove that one id from
`constants/buttons.ts` in this task so knip and the union stay honest.

- [ ] **Step 3: Verify and translate**

Run: `pnpm check`
Expected: PASS apart from the known worktree failure.

Run: `pnpm i18n:extract`, then translate:
`ADD` → `PŘIDAT`, `holding this role` → `má tuto roli`,
`FEATURES IN THIS STACK` → `FUNKCE V TÉTO SADĚ`, `off for everyone` → `vypnuto pro všechny`,
`DELETE ROLE` → `SMAZAT ROLI`.

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(admin): create, rename, delete roles and edit their stacks

A role is a name and a set of features, flat, so the stack is plain on
and off — the third state belongs to one person's overrides and lives on
the other screen.

The person count beside the name is the warning: editing the stack moves
every one of them who has not overridden the feature being changed. It
is also what blocks the delete, which the foreign key would refuse
anyway — the RPC counts so the screen can say why instead of showing a
constraint name to somebody holding a phone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 10: The FEATURES tab

**Files:**

- Modify: `components/overlays/admin-features.tsx` (replacing the stub)

**Interfaces:**

- Consumes: `listFeatures`, `setFeature`, `AdminFeature` from `@/lib/admin/features`.
- Produces: `AdminFeatures({ epoch, onChanged })`.

- [ ] **Step 1: Write the pane**

```tsx
import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { listFeatures, setFeature, type AdminFeature } from '@/lib/admin/features'
import { cn } from '@/lib/cn'

// The one key nobody may switch off. The database refuses it too — a check constraint on
// `features`, because it has to hold against a migration as well as against this screen
// — and this is only so the switch does not look tappable.
const PROTECTED = 'admin'

export function AdminFeatures({
  epoch,
  onChanged,
}: {
  epoch: number
  onChanged: () => void
}) {
  const [rows, setRows] = useState<AdminFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The note is edited in place, so the field needs somewhere to live between keystrokes
  // that is not the row it came from.
  const [notes, setNotes] = useState<Record<string, string>>({})

  const reload = async () => {
    const res = await listFeatures()
    setRows(res.rows)
    setNotes(Object.fromEntries(res.rows.map((row) => [row.key, row.note ?? ''])))
    setError(res.error)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch])

  const write = async (call: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const res = await call()
    setError(res.error)
    await reload()
    setBusy(false)
    if (res.error === null) onChanged()
  }

  if (loading) return <ActivityIndicator className="my-4" />

  return (
    <View className="flex-1">
      {error !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
        >
          {error}
        </Text>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        {rows.map((row) => {
          const locked = row.key === PROTECTED
          return (
            <View key={row.key} className="mb-4">
              <View className="flex-row items-center">
                <TrackedPressable
                  id="admin.feature_active"
                  disabled={busy || locked}
                  onPress={() => {
                    void write(() =>
                      setFeature(row.key, !row.active, notes[row.key] ?? null),
                    )
                  }}
                  className={cn(
                    'mr-2 rounded-lg border px-2.5 py-1',
                    row.active ? 'border-strong bg-strong' : 'border-dim/30',
                    (busy || locked) && 'opacity-40',
                  )}
                >
                  <Text
                    selectable={false}
                    className={cn(
                      'font-mono text-[9px] font-black tracking-[1px]',
                      row.active ? 'text-on-strong' : 'text-dim',
                    )}
                  >
                    {row.active ? 'ON' : 'OFF'}
                  </Text>
                </TrackedPressable>
                <Text
                  selectable={false}
                  className="flex-1 font-mono text-[12px] font-black tracking-[0.5px] text-primary"
                >
                  {row.key}
                  {locked ? ' 🔒' : ''}
                </Text>
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-medium tracking-[0.5px] text-dim"
                >
                  {/* Roles granting it, then people who actually reach it — the second
                      counts overrides in, which is the number somebody about to flip the
                      switch wants. */}
                  {row.roleCount} · {row.personCount}
                </Text>
              </View>

              {!row.inBuild && (
                <Text
                  selectable={false}
                  className="ml-1 mt-1 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
                >
                  {/* A row the database holds and this build does not: a key left behind
                      by a migration, or a device older than the server. Shown rather than
                      hidden — unseen configuration is how it goes stale. */}
                  ⚠ <Trans>not in this build</Trans>
                </Text>
              )}

              <TextInput
                value={notes[row.key] ?? ''}
                onChangeText={(next) => {
                  setNotes((current) => ({ ...current, [row.key]: next }))
                }}
                onBlur={() => {
                  const next = notes[row.key] ?? ''
                  if (next !== (row.note ?? '')) {
                    void write(() =>
                      setFeature(row.key, row.active, next === '' ? null : next),
                    )
                  }
                }}
                placeholder="why"
                multiline
                className="ml-1 mt-1 font-mono text-[10px] font-medium leading-[15px] text-dim"
              />
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
```

- [ ] **Step 2: Verify and translate**

Run: `pnpm check`
Expected: PASS apart from the known worktree failure.

Run: `pnpm i18n:extract`, then translate `not in this build` → `není v tomto buildu`.

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(admin): switch a feature off for everyone, and say why

The master switch, the note beside it, and two counts: roles granting it,
then people who actually reach it once overrides are applied — which is
the number somebody about to flip the switch wants.

`admin` is drawn locked. The database refuses it too, with a check
constraint, because that has to hold against a migration as well as
against this screen.

A key the database holds and this build does not is marked rather than
hidden: unseen configuration is how it goes stale.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 11: The documentation and the device walk

**Files:**

- Modify: `CLAUDE.md`
- Create: `docs/superpowers/plans/2026-10-06-feature-flags-verification.md`

**Interfaces:**

- Consumes: everything above.
- Produces: nothing code depends on.

- [ ] **Step 1: Rewrite the two domain-language entries in `CLAUDE.md`**

Replace the **role** row of the "Other key words" table:

```markdown
| **role** | A named stack of features, held on `profiles.role` as a foreign key to the `roles` table: null for an ordinary player — which is all but a handful of rows. **Flat**: roles are not ranked and none inherits from another, so `admin`'s stack is spelled out in full. Created, renamed and deleted from the admin screen. Never a permission: a role decides what a player is _shown_, not what a player may do. Not the multiplayer host, who is also called `admin` — see the trap above. |
```

Replace the **flag** row with a **feature** row, and move it into alphabetical place:

```markdown
| **feature** | One part of the app that is not for everyone yet, named by a key the code holds a guard for. `constants/features.ts` is the whole of what the code knows — the list of keys, and nothing about who reaches them. Who reaches them is rows: a role's **stack**, a person's **overrides** on top of it, and the feature's own `active` switch, resolved by `effective_features` in SQL and asked for once per launch. `useFlag('x')` is how a screen asks. Formerly **flag**, which named a build-time switch; the identifiers still say flag and are renamed separately. |
```

Add a **stack** and an **override** row after **feature**, worded as the spec's Domain language section words them.

- [ ] **Step 2: Write the verification checklist**

Create `docs/superpowers/plans/2026-10-06-feature-flags-verification.md`. The
`2026-10-02-arcade-siege-verification.md` precedent applies: no component tests exist in
this repo, so every screen above was verified by reading. Lead with the lockout guards,
because a mistake there is the one that cannot be undone from the app.

```markdown
# Feature flags in the database — Verification Guide

Date: 2026-10-06

**The four lockout guards are the ones that matter.** A mistake anywhere else on this
page is a wrong number on a screen three people see. A mistake in these is an app with
nobody able to open the admin screen, and no way back in but SQL.

## The four, first

1. **Take `admin` off yourself by role.** PEOPLE → yourself → ROLE → NONE. It must
   refuse and say so, and you must still be on the screen afterwards.
2. **Take `admin` off yourself by override.** PEOPLE → yourself → tap `admin` until it
   reads override, off. Same refusal.
3. **Take `admin` out of your own role's stack.** ROLES → ADMIN → tap `admin` off. Same
   refusal.
4. **Switch the `admin` feature off.** FEATURES → the `admin` row. The switch must not
   be tappable at all, and must be drawn with 🔒.

## The resolve

5. A person with no role and no overrides shows a feature count of 0 and every row
   reading "from role", off.
6. Give somebody TESTER. Their count goes to 1 — `dev` — because `multiplayer` is
   inactive even though every stack holds it.
7. Switch `multiplayer` on from FEATURES. The same person's count goes to 2 without
   anybody touching their role. This is the whole point of the switch.
8. Switch it back off.
9. Override `arcade` on for a tester. The row says "override", the count rises, and the
   PEOPLE list shows ✦ beside them.
10. Override `dev` off for that same tester. The count falls, and the row still says
    "override" — the source, not the state.
11. RESET TO ROLE DEFAULTS. Both rows go back to "from role", ✦ disappears, and the
    button greys out.

## Roles

12. Make a role from the ROLES tab. The key it derives from what you typed is lower
    case with dashes; the label is what you typed, uppercased.
13. Give it a feature, assign somebody to it, then try to delete it. It must refuse and
    say how many people hold it.
14. Move that person off, then delete it. The role goes and its stack goes with it.
15. Rename a role by editing the heading and tapping away. The list behind it shows the
    new label.

## The app itself

16. **Cold start as a player with no role.** The intro has no DEV and no ADMIN link, no
    WITH FRIENDS tab, and the ARCADE pill is there wearing SOON and unpressable.
17. **Cold start as an admin.** All of the above appear — a moment after the intro
    paints, not before it. That flicker is deliberate; see `hooks/use-flags.tsx`.
18. **Aeroplane mode, cold start.** The intro paints, the doors stay shut, and nothing
    errors. A failed `my_features()` is an ordinary player.
19. **Change somebody's role, then have them relaunch.** The change takes effect on the
    next start and not before.
20. **The dev gallery** (`dev/gallery.tsx`) shows the intro with every door open,
    including WITH FRIENDS — which it did _not_ before this change, because `admin`
    never reached a feature floored at `nobody`.

## Analytics

21. An admin's events must not reach PostHog. `setAdminOptOut` now asks the feature
    rather than the role, so check a person with `admin` granted by **override** is
    also opted out.
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS apart from the known worktree failure.

Run: `pnpm db:test`
Expected: PASS, all three notices.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-10-06-feature-flags-verification.md
git commit -F - <<'EOF'
docs(features): rewrite the role and flag entries, add the device walk

CLAUDE.md described a ranked ladder and a build-time switch, and this
feature deleted both. The new entries say what a role, a feature, a stack
and an override actually are.

The verification guide leads with the four lockout guards, because a
mistake there is the one with no way back but SQL.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```
