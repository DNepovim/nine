-- A feature's switch grows a third position.
--
-- `features.active` was a boolean and it answered one question: does the stack mean
-- anything today. Off meant nobody reaches this; on meant whoever a role or an override
-- says. There was no way to say *everybody* — which is what a feature needs on the day
-- it stops being a feature. The only way to ship one to players was to put it in every
-- stack and then keep carrying it there, which is a finished feature still wearing the
-- apparatus that was meant to be temporary.
--
-- So the switch stops being a boolean and becomes a word with three values, in a column
-- named for what it actually decides rather than for one of its positions:
--
--   hidden   nobody reaches it, whatever any stack or override says. Was `active = false`.
--   private  whoever their role's stack, or their own override, says. Was `active = true`.
--   public   everybody, role or no role — and no role is all but a handful of profiles.
--
-- `public` beats the stack and does **not** beat an override. A revoked override still
-- takes a public feature away from the one person it names, and that is deliberate:
-- "regardless of roles" is what public promises, and an override is not a role — it is
-- one person picked out by hand on the person screen, which is the only place anybody has
-- said what they mean about that person specifically. Throwing that away because the
-- feature later went public would be the screen forgetting an instruction it was given.
-- The resolve below reads in exactly that order: hidden, then the override, then public,
-- then the stack.
--
-- The usual warning this schema keeps needing: `admin` here is a feature key and an
-- account role, and has nothing to do with `rooms.admin_id`, the player who created a
-- multiplayer room. Never read one off the other.

-- ─── The column ──────────────────────────────────────────────────────────────
-- Added with a default and backfilled from `active`, so every existing row keeps the
-- behaviour it had: on becomes private, off becomes hidden. Nothing is public after this
-- migration — public is a decision for the admin screen, the same way turning a feature
-- on always was.
alter table features add column visibility text not null default 'private';

update features set visibility = case when active then 'private' else 'hidden' end;

alter table features add constraint features_visibility_known
  check (visibility in ('hidden', 'private', 'public'));

-- ─── The admin door, pinned ──────────────────────────────────────────────────
-- `admin_feature_stays_active` shut one of the two doors this key must never go through.
-- There are two now, and they fail in opposite directions:
--
--   hidden   every write guard in the feature system asks `has_feature(auth.uid(),
--            'admin')`, and that reads this column — so hiding this one key locks every
--            admin out of the only screen that could put it back.
--   public   the ADMIN link on the intro, for every player who opens the app. The screen
--            behind it edits who sees everything else; it is the one feature whose whole
--            purpose is to not be for everyone.
--
-- A check constraint rather than a guard in the RPC, because this has to hold against a
-- later migration as well as against the screen.
alter table features drop constraint admin_feature_stays_active;
alter table features add constraint admin_feature_stays_private
  check (visibility = 'private' or key <> 'admin');

-- ─── The note that said otherwise ────────────────────────────────────────────
-- `admin`'s note has read "cannot be switched off" since the day the switch was a
-- boolean, and it is now half the truth. Rewritten only if it is still word for word
-- what …_feature_flags.sql seeded: the note is editable from the screen, and a migration
-- that overwrote a sentence somebody wrote there would be answering a decision with a
-- deployment.
update features
   set note = 'This screen. Protected: it cannot be hidden, it cannot be made public, and nobody can take it from themselves.'
 where key = 'admin'
   and note = 'This screen. Protected: cannot be switched off, and nobody can take it from themselves.';

-- ─── The resolve ─────────────────────────────────────────────────────────────
-- Still one function, still the only place the rules are written. The `coalesce` is the
-- override's tri-state: a row wins outright in either direction, and its absence falls
-- through to what is now two sources of inheritance — public, or the role's stack.
--
-- A null `p_user_id` — what `my_features()` passes on a first launch, before the
-- anonymous sign-in — used to resolve to the empty set. It now resolves to the public
-- features, which is the only answer public can honestly give: a player who has not
-- signed in yet is still everybody. Nothing private can leak through it, because the
-- override subselect and the stack `exists` both answer false for a null id.
create or replace function effective_features(p_user_id uuid)
returns setof text language sql stable set search_path = public as $$
  select f.key
  from features f
  where f.visibility <> 'hidden'
    and coalesce(
      (select uf.granted
         from user_features uf
        where uf.user_id = p_user_id and uf.feature_key = f.key),
      f.visibility = 'public'
        or exists (select 1
                     from role_features rf
                     join profiles p on p.role = rf.role_key
                    where p.id = p_user_id and rf.feature_key = f.key)
    );
$$;

-- ─── The writes and the reads that named the old column ──────────────────────
-- `set_feature`'s middle argument changes type, which makes this a different function
-- rather than a replacement for the old one — so the boolean version is dropped by hand.
-- `create or replace` alone would leave two functions called `set_feature`, and PostgREST
-- would have to guess which one a client meant.
drop function if exists set_feature(text, boolean, text);

create or replace function set_feature(p_key text, p_visibility text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
begin
  -- Named here as well as in the check constraint, the same way `set_user_role` names an
  -- unknown role: the constraint is what makes it true against a migration, and this is
  -- what puts a sentence rather than a constraint name in front of somebody holding a
  -- phone.
  if p_visibility not in ('hidden', 'private', 'public') then
    raise exception 'set_feature: unknown visibility %', p_visibility;
  end if;
  update features set visibility = p_visibility, note = p_note where key = p_key;
  perform guard_admin_floor(v_caller);
end;
$$;

grant execute on function public.set_feature(text, text, text) to authenticated;

-- The two readers that handed `active` to the screen. Dropped rather than replaced
-- because a returned column changes name and type, which `create or replace` refuses.
drop function if exists person_features(uuid);

create or replace function person_features(p_user_id uuid)
returns table (key text, override boolean, in_role_stack boolean, visibility text)
language sql stable set search_path = public as $$
  select f.key,
         (select uf.granted from user_features uf
           where uf.user_id = p_user_id and uf.feature_key = f.key),
         exists (select 1 from role_features rf
                   join profiles p on p.role = rf.role_key
                  where p.id = p_user_id and rf.feature_key = f.key),
         f.visibility
  from features f
  order by f.key;
$$;

drop function if exists feature_stats();

-- `person_count` is still after resolution and still scoped to the roled population —
-- the handful of rows that could possibly answer. It therefore says nothing useful about
-- a public feature, which reaches a population that grows with every player who ever
-- opened the app; the screen prints *everyone* for those rows rather than a number, and
-- counting the whole of `profiles` here to produce a figure nobody reads would be a seq
-- scan per public feature per visit to the tab.
create or replace function feature_stats()
returns table (key text, visibility text, note text, role_count int, person_count int)
language sql stable set search_path = public as $$
  select f.key,
         f.visibility,
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

grant execute on function public.person_features(uuid) to authenticated;
grant execute on function public.feature_stats()       to authenticated;

-- ─── And the boolean goes ────────────────────────────────────────────────────
-- Last, so that everything above has been redefined against `visibility` before the
-- column it replaces stops existing. These function bodies are strings rather than
-- tracked SQL, so Postgres would have let the column go first and broken them silently.
alter table features drop column active;
