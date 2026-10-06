# Feature flags in the database — Design

Date: 2026-10-06

## Goal

Move every decision about _who sees what_ out of the build and into the database, and
give the admin screen the controls to make them.

Code keeps the one thing only code can know: the set of feature keys it has guards
for. Everything else — which roles exist, what each role opens, who holds which role,
and the adjustments made to one person — becomes rows an admin edits on their phone.

Three things follow that the app cannot do today:

- A role is a **stack of features**, editable without a deploy. Handing `arcade` to
  every tester is a tap, not a release.
- A person can differ from their role in **both directions** — one feature granted on
  top, one taken away — and be **reset** to their role's stack in one move.
- Roles themselves are **created, renamed and deleted** from the screen.

## What the system does today, and why it has to change

`constants/features.ts` maps each flag to a **floor**: the lowest rung of a fixed
ladder that may see it.

```ts
export const FLAGS = {
  multiplayer: 'nobody',
  arcade: 'developer',
  dev: 'tester',
  admin: 'admin',
} as const satisfies Record<string, Floor>
```

`lib/role.ts` holds the ladder — `tester` 1, `developer` 2, `admin` 3 — and
`holds(role, floor)` is a rank comparison. `profiles.role` stores one rung, read once
per launch beside the nickname (`hooks/use-supabase-auth.ts`) and handed to
`FlagsProvider`. The admin screen can set a person's rung and nothing else.

So the mapping from rung to features is a **build-time fact**. Giving a single tester
one extra screen means either promoting them — which hands them everything else a
developer gets — or shipping a new bundle. Both are the wrong size of move for the
question being asked.

The ladder is also the thing that blocks roles-as-data. A role created from the screen
would need a rank, and a rank between `developer` and `admin` means nothing to anyone.
The ladder goes.

## Domain language

These replace the **role** and **flag** entries in CLAUDE.md, which this design
invalidates.

**feature** — one part of the app that is not for everyone yet, named by a key the
code holds a guard for: `multiplayer`, `arcade`, `dev`, `admin`. The code's list is
the authority on which keys exist; the database row of the same key carries what is
editable about it. Formerly **flag** — and in prose the word **flag** is retired,
because it named a build-time switch and the thing is no longer one. The
_identifiers_ — `FLAGS`, `Flag`, `useFlag`, `FlagsProvider` — keep their names
through this change and are renamed separately; see **Out of scope**.

**stack** — the set of features a role opens. A role _is_ its stack plus a name; there
is nothing else to a role. Flat: no rank, no inheritance, no role reaching anything
through another. `admin`'s stack is spelled out in full.

**override** — one person's departure from their role's stack, in either direction:
`granted` true puts a feature on that their role does not give, false takes one away
that it does. The absence of an override row is the third state and the usual one —
_inherit_. **Reset** deletes a person's override rows, returning them to the stack.

**active** — a feature's master switch. Inactive means nothing grants it: no stack, no
override, nobody, admin included. It is `nobody` from the old `Floor` type, translated
literally, and it exists for the reason that comment gives — a feature taken off the
app for a while must not cost its configuration, which clearing the grants would.

**role** — a named stack, and the thing a person is assigned one of. Still
`profiles.role`, still null for all but a handful of rows. Still **not** the
multiplayer host, who is also called `admin` (`rooms.admin_id`) — the trap CLAUDE.md
already warns about survives this change unchanged.

What does _not_ change: a feature decides what a player is **shown**, never what a
player may **do**. The resolve runs on the server now, which makes it tempting to read
as a permission system. It is not one. Anything that must not be _reached_ still needs
its own check in the function that does the reaching.

## Data model

Four tables. All four are seeded by migration to reproduce today's behaviour exactly,
so the deploy changes nothing for any player.

### `features` — the keys, and what is editable about them

```sql
create table features (
  key        text primary key,
  active     boolean not null default true,
  note       text,
  created_at timestamptz not null default now(),

  -- The admin door cannot be shut from behind the admin door. Every write guard in
  -- this design asks `has_feature(auth.uid(), 'admin')`, and that question reads
  -- `active` — so deactivating this one key would lock every admin out of the screen
  -- that is the only way to reactivate it.
  constraint admin_feature_stays_active check (active or key <> 'admin')
);
```

Rows are created and removed **by migration**, not by the screen — the code's guards
are what make a key mean anything, so a key appearing or disappearing is a code change
either way. The screen edits `active` and `note` and nothing else.

`note` is free text for the admin reading the screen in three weeks: _"intro being
refitted"_. It is the one place the reason lives now that the `FLAGS` comments can no
longer carry it.

### `roles` — a named stack

```sql
create table roles (
  key        text primary key,
  label      text not null,
  created_at timestamptz not null default now()
);
```

`key` is what `profiles.role` stores and what seeds match: `tester`, `developer`,
`admin`. `label` is what the screen prints.

Labels are **not translated**. Roles are rows now, and a row cannot carry a Lingui
message id. The current screen's `ROLE_LABEL` map is already plain English for the
same reason — this is an admin-only screen, and the people who open it are the people
who write the catalog.

### `role_features` — the stack itself

```sql
create table role_features (
  role_key    text not null references roles (key)    on delete cascade,
  feature_key text not null references features (key) on delete cascade,
  primary key (role_key, feature_key)
);
```

Presence is the grant; there is no `granted` column, because a stack has no third
state. The tri-state belongs to overrides alone.

### `user_features` — one person's departures from it

```sql
create table user_features (
  user_id     uuid    not null references profiles (id)   on delete cascade,
  feature_key text    not null references features (key)  on delete cascade,
  granted     boolean not null,
  primary key (user_id, feature_key)
);
```

`granted` is the whole point: true adds, false subtracts, **no row** inherits. A
two-column table with presence-as-grant could only ever add, and "this developer
should not see ADMIN" would have no answer except a near-duplicate role — which is the
thing roles-as-data is meant to stop.

### `profiles.role` becomes a foreign key

```sql
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_fkey
  foreign key (role) references roles (key) on delete restrict;
```

The column keeps its name, its type and its three existing values, so no profile row
is touched. `restrict` rather than `set null`: the delete RPC refuses to drop a role
anybody holds, and this constraint is what makes that refusal true even when the
screen is wrong.

## Resolution

One function, used by the player path and by the admin screen alike. Writing it twice
is how the screen and the app come to disagree about why somebody can see something.

```sql
create or replace function effective_features(p_user_id uuid)
returns setof text language sql stable set search_path = public as $$
  select f.key
  from features f
  where f.active
    and coalesce(
      -- An override row, either way round, wins outright.
      (select uf.granted
         from user_features uf
        where uf.user_id = p_user_id and uf.feature_key = f.key),
      -- No row: whatever the person's role says, or false if they have none.
      exists (select 1
                from role_features rf
                join profiles p on p.role = rf.role_key
               where p.id = p_user_id and rf.feature_key = f.key)
    );
$$;
```

The `coalesce` _is_ the tri-state: a row wins, absence falls through. And `f.active`
sits outside the whole thing rather than inside either branch, so the master switch
beats both.

Two thin wrappers:

```sql
create or replace function my_features()
returns setof text language sql stable set search_path = public as $$
  select * from effective_features(auth.uid());
$$;

create or replace function has_feature(p_user_id uuid, p_key text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from effective_features(p_user_id) k where k = p_key);
$$;
```

A person with no role and no overrides resolves to the empty set, which is what all
but a handful of rows do and what the ladder's `role is null` meant.

## Who may write what

No table above grants `insert`, `update` or `delete` to `authenticated`. Every write
goes through a `security definer` RPC, which is the shape `set_user_role` already has
and the shape `…_profile_role.sql` argued for at length.

Every one of them opens with the same guard:

```sql
if not has_feature(v_caller, 'admin') then
  raise exception '<fn>: caller is not an admin';
end if;
```

`has_feature(…, 'admin')` and **not** `role = 'admin'`, which is what `set_user_role`
checks today. A custom role granting `admin` has to open the buttons as well as the
door, or roles-as-data stops halfway.

| RPC                                    | What it does                                       |
| -------------------------------------- | -------------------------------------------------- |
| `set_user_role(user, role)`            | Rewrite of the existing one: any role key, or null |
| `set_user_feature(user, key, granted)` | `granted` null deletes the override row            |
| `reset_user_features(user)`            | Deletes every override row for that person         |
| `create_role(key, label)`              |                                                    |
| `rename_role(key, label)`              |                                                    |
| `delete_role(key)`                     | Refuses while anybody holds it, and says how many  |
| `set_role_feature(role, key, on)`      | Adds or removes one row of a stack                 |
| `set_feature(key, active, note)`       | The master switch and the note; nothing else       |

### Lockout guards

This system can now edit its own access, through four different doors. One helper,
called at the **end** of every mutating RPC, closes all four at once:

```sql
-- Deliberately not `stable`. This is called after the write it is judging, and it has
-- to see that write. Volatile is the only marking that promises a fresh snapshot per
-- statement; a `stable` guard that silently read the pre-write world would pass every
-- change it exists to refuse, and would do it quietly.
create or replace function guard_admin_floor(p_actor uuid)
returns void language plpgsql set search_path = public as $$
begin
  -- You cannot take admin away from yourself — by role change, by override, or by
  -- editing the stack of the role you happen to hold.
  if not has_feature(p_actor, 'admin') then
    raise exception 'that change would take admin away from you';
  end if;

  -- And the room cannot be emptied. Scoped to the roled population, which is the
  -- handful of rows that could possibly answer.
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
```

Checking after the write and raising inside the transaction means the guard sees the
world the write would have made, and the rollback is free. The fourth door —
deactivating the `admin` feature — is shut by the check constraint on `features`
instead, because that one has to hold even against a migration.

### Reads

`select` is granted to the same audience `profiles` already has. A role is public
today and what it opens is not a secret either; the doctrine that this decides what a
player is _shown_ is exactly the argument that none of it needs hiding.

`user_features` is the one row of this to think twice about, since it is per-person.
It goes public too, for consistency with `profiles.role` — but it is the piece to
revisit first if that ever stops being comfortable. See **Out of scope**.

A handful of read RPCs keep the screen from asking N questions for a list of N:

```sql
admin_people()               → id, nickname, role, feature_count, has_overrides
admin_find_person(nickname)  → the same row, for the search box
person_features(user)        → key, override, in_role_stack, active
role_stats()                 → key, label, feature_count, person_count
role_feature_keys(role)      → setof key
feature_stats()              → key, active, note, role_count, person_count
```

These are **not** admin-guarded, and the inconsistency of guarding them would be the
mistake. They are `stable` functions over tables every client can already select; a
guard there would suggest the counts are secret while the rows they count are not.
Guards belong on the writes, where they are the only thing standing between a player
and `profiles.role` — which is exactly where `…_profile_role.sql` put them.

## Reading on the device

`hooks/use-supabase-auth.ts` stops selecting `role` and calls `my_features()` instead,
in parallel with the profile select it already makes. One extra round trip per launch;
the column it replaces was free, so this is the real cost of the change and it is
worth naming.

The timing story is unchanged and still right: features are unknown until auth
settles, `useFeature` answers false until then, and a tester watches the intro paint
without their extra doors and gain them a moment later. Holding the intro on a server
answer would cost every player a wait so that a handful avoid a flicker.

Keys the server knows and this build does not are **dropped on the way in** — the
instinct `parseRole` had, moved to the set:

```ts
const known = new Set(FLAGS)
const mine = new Set(rows.filter((key): key is Flag => known.has(key)))
```

## What the code loses

`constants/features.ts` collapses to the list. The per-feature comments stay — they
explain what each one _is_, which is still a code fact; the sentence about who sees it
moves to the row's `note`.

```ts
export const FLAGS = ['multiplayer', 'arcade', 'dev', 'admin'] as const
export type Flag = (typeof FLAGS)[number]
```

`lib/role.ts` is **deleted outright**. `ROLE_RANK`, `Floor` and `holds` describe a
ladder that no longer exists; `ROLES` is a database query now; `parseRole` guarded a
closed set that is open. Its tests go with it.

`hooks/use-flags.tsx` keeps its name and its exports, and takes a set instead of a
rung:

```ts
export function FlagsProvider({
  features,
  children,
}: {
  features: ReadonlySet<Flag>
  children: ReactNode
})
```

The default-empty context stays, and for the same documented reason: `dev/gallery.tsx`
renders the intro outside the app's tree and must not crash. The gallery's two
`<FlagsProvider role="admin">` become `<FlagsProvider features={new Set(FLAGS)}>` —
the gallery wants every door open, which used to be spelled "admin" and is now spelled
"all of them".

`useFlag(flag)` is untouched at all six call sites.

`lib/admin-roles.ts` grows past one file's worth and becomes `lib/admin/` —
`people.ts`, `roles.ts`, `features.ts`. Same job, same Supabase-call shape, split by
the three objects the screen now has.

`components/overlays/admin-overlay.tsx` splits the same way: the hub, then
`admin-people.tsx`, `admin-person.tsx`, `admin-roles.tsx`, `admin-role.tsx`,
`admin-features.tsx`.

## The admin screen

Three objects, so three tabs — pressable pills in the style `RolePicker` already uses,
not a new shared component.

```
ADMIN
WHO SEES WHAT

[ PEOPLE ]  [ ROLES ]  [ FEATURES ]
```

### PEOPLE — the default, because it is the common errand

```
 ┌ search ─────────────────────┬──────┐
 │ nickname                    │ FIND │
 └─────────────────────────────┴──────┘

 EVERYONE WITH A ROLE
 ─────────────────────────────────────
 RUPRD            admin      4 ✦        ›
 TEREZA           tester     1          ›
 MARTIN           tester     2 ✦        ›
```

The count is features in effect; `✦` marks somebody carrying overrides. The search is
the existing `findProfileByNickname`, unchanged — `nickname` is `citext unique`, so at
most one row can answer.

A person who holds no role but carries overrides appears in this list too. The heading
says "everyone with a role" today and will have to stop.

```
 ‹ RUPRD

 ROLE   [ NONE ][ TESTER ][ DEVELOPER ][ ADMIN ]

 FEATURES
 multiplayer   ○  off for everyone         (struck through, not tappable)
 arcade        ●  from role
 dev           ○  override
 admin         ●  from role

 [ RESET TO ROLE DEFAULTS ]               (disabled: no overrides)
```

Tapping a feature cycles **inherit → on → off → inherit**, which is
`set_user_feature(user, key, true | false | null)`.

Every row states its **source**, not only its state. That is the line between a screen
that can be edited and a screen that can be debugged: _why can this person see this_
is answerable without opening the other two tabs.

The role picker is today's, reading `roles` instead of the `ROLES` const. NONE stays
leftmost for the reason the current comment gives — it is the one option that undoes
the other three, and rising order would bury it.

### ROLES

```
 ROLES                              [ + NEW ]
 ─────────────────────────────────────
 TESTER        1 feature    ·  4 people   ›
 DEVELOPER     2 features   ·  2 people   ›
 ADMIN         4 features   ·  1 person   ›
```

```
 ‹ DEVELOPER                       2 people
   [ RENAME ]  [ DELETE ]        (delete blocked: 2 hold it)

 FEATURES IN THIS STACK
 multiplayer   ○
 arcade        ●
 dev           ●
 admin         ○
```

Plain on/off — a stack has no third state. Editing one here moves every holder who has
not overridden it, and the person count above is the warning that says how many.

### FEATURES

```
 FEATURES
 ─────────────────────────────────────
 multiplayer   OFF   2 roles · 5 people   ›
 arcade        ON    2 roles · 3 people   ›
 dev           ON    3 roles · 7 people   ›
 admin         ON    1 role  · 1 person   ›  🔒
 four-keys     ON    0 roles · 0 people   ›  ⚠ not in this build
```

The master switch, the note, and the counts. `🔒` is the protected key — its switch is
not tappable. `⚠` is a row the database holds and this build's `FLAGS` does not: a key
left behind by a migration, or a device older than the server. Shown rather than
hidden, because unseen configuration is how it goes stale.

Counts are "after resolution": `person_count` is people who actually end up with it,
overrides included, which is the number somebody flipping the master switch wants.

### Copy

Every string on these screens goes through Lingui and is extracted — `pnpm i18n:verify`
is now a gate in `pnpm check`, and an unextracted string renders its generated id in a
production build. Czech translations are part of the work, not a follow-up.

## Testing

This is the honest part. **The resolve has no home in the current test suite.** Vitest
runs in `environment: 'node'` against TypeScript; the resolve is SQL; and mirroring it
in TypeScript to test it would create the second copy this design spent a section
avoiding.

So:

- **A SQL test script**, `supabase/tests/features.sql`, run against the local stack by
  a new `pnpm db:test` (`supabase db reset && psql -f …`). Plain `do $$ … assert … $$`
  blocks over a fixture: a person with no role, a person with a role, an override each
  way, a reset, an inactive feature beating both, and each of the four lockout guards
  refusing. Not in `pnpm check` — it needs Docker — but repeatable and in the repo.
- **Vitest keeps what is still pure**: the key-filtering on the way in (unknown server
  keys dropped), and the override cycle `inherit → on → off → inherit` as a function
  rather than a `useState` tangle inside the row component.
- **The screens are read, not rendered.** No component tests exist in this repo. The
  `2026-10-02-arcade-siege-verification.md` precedent applies: a verification checklist
  ships with the branch, and the lockout guards are the items to walk first on a real
  device.

## Migration and rollout

One migration, in this order:

1. Create the four tables, the three functions and `guard_admin_floor`.
2. Seed `features` with the four keys. `active` true for all but `multiplayer`, whose
   note records why — the `nobody` floor it carries today, preserved rather than lost.
3. Seed `roles` with `tester` / `developer` / `admin`.
4. Seed `role_features` to reproduce today's floors: `dev` to all three, `arcade` to
   developer and admin, `admin` to admin — and `multiplayer` **to all three as well**,
   even though it is inactive. The resolve intersects with `active`, so behaviour is
   identical either way; seeding the grants is what makes the master switch mean what
   the design says it means. The old comment ends _"floored back at `tester` when
   there is something to report on again"_, and this way that is one tap rather than
   four.
5. Drop the check constraint on `profiles.role`, add the foreign key. Every existing
   value is one of the three the dropped constraint allowed and all three are seeded
   in step 3, so no row can fail it.
6. Replace `set_user_role`; grant execute on the new RPCs.

After step 4 the resolve returns, for every existing profile, exactly what `holds()`
returns today. That is the property to assert in the SQL test, and it is what makes
this deployable without a flag of its own.

No down migration. The tables are additive and the column is unchanged; reverting is a
matter of deploying the previous bundle, which reads `profiles.role` through the
ladder and ignores everything else.

## Out of scope

- **Feature CRUD from the screen.** Keys come from code; a key without a guard means
  nothing. Migrations add and remove them.
- **More than one role per person.** `profiles.role` stays singular. Overrides are the
  answer to "almost a tester, plus one thing".
- **An audit trail.** Who flipped what, and when. Worth having once more than one
  person holds `admin`; a `feature_changes` table and a write in each RPC. Not now.
- **Hiding `user_features` from ordinary players.** It is public read for consistency
  with `profiles.role`. If that becomes uncomfortable, the move is RLS on that one
  table plus a `my_overrides()` RPC — `effective_features` is `security definer`-able
  and would not change.
- **Scheduled windows** ("active from Friday"). `modes/challenges` already has a
  window concept and this is not it; conflating them would make both worse.
- **Renaming the identifiers.** `FLAGS`, `Flag`, `useFlag`, `FlagsProvider` and
  `constants/features.ts` all keep their names here. The prose word is **feature**
  from now on, and the code catches up in a rename of its own — mixed into this diff
  it would bury the parts that matter under six mechanical call-site edits.
