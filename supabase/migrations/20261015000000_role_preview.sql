-- Looking at the app as somebody else.
--
-- The feature system decides what a player is *shown*, and until now the only way to
-- check what a stack actually came to was to hold it: give yourself the role, open the
-- app, put your own role back. That is three writes and a lockout guard to answer a
-- question about one row, and the answer arrives after the edit rather than before it.
--
-- So an admin can borrow a role instead. The device keeps asking the server what it may
-- be shown; it just asks the question about a role rather than about the person holding
-- the phone. Nothing is written, nothing about the person changes, and a reload ends it.
--
-- **This is a view, not a grant.** Every write in the app is guarded on the server by
-- `has_feature(auth.uid(), …)`, which reads the caller's own row and has never heard of
-- a preview — so an admin previewing a role gains nothing and, more to the point, a
-- player who talks their own client into previewing `admin` gains nothing either. The
-- preview moves what the screens draw and not one thing more.

-- ─── What a role opens ───────────────────────────────────────────────────────
-- A sibling of `effective_features`, not a second copy of it: same table, same
-- precedence — hidden reaches nobody, public reaches everybody — with the one clause
-- that cannot apply left out. That clause is the override, and leaving it out is the
-- definition of the thing: an override belongs to a person, a role has none, and what
-- this answers is what the *role* opens. Previewing a person would be a different
-- feature, and it would have to say whose overrides it was wearing.
--
-- A null `p_role` is an ordinary player — no role at all, which is all but a handful of
-- profiles — and so resolves to the public features and nothing else. That is the
-- preview most worth having, and it needs no row to name it.
--
-- Not guarded, for the reason the admin screen's other readers are not: this is a
-- `stable` function over two tables every client can already select, and a guard here
-- would suggest the answer is a secret while the rows it reads are not. The guards
-- belong on the writes, which is where they are.
create or replace function features_as_role(p_role text)
returns setof text language sql stable set search_path = public as $$
  select f.key
  from features f
  where f.visibility <> 'hidden'
    and (f.visibility = 'public'
         or exists (select 1
                      from role_features rf
                     where rf.role_key = p_role and rf.feature_key = f.key));
$$;

grant execute on function public.features_as_role(text) to authenticated;

-- ─── The door ────────────────────────────────────────────────────────────────
-- Its own key rather than riding on `admin`, even though the pills that start a preview
-- are inside the admin screen and nothing else opens them. Two reasons: the badge that
-- ends a preview is the only way back out of one, so this is a feature that can leave
-- somebody somewhere — and a feature that can go wrong wants a switch of its own, not a
-- switch shared with the door that would be used to turn it off.
insert into features (key, visibility, note) values
  ('rolePreview', 'private',
   'Role preview: the pills on the ROLES tab that redraw the app with another role''s features, and the badge in the corner that says which and ends it. A view and not a grant — every write is still guarded on the caller''s own row.');

-- The `admin` stack and only that one. The pills live on a screen that already asks for
-- `admin`, so granting this anywhere else would be a key opening a door behind a locked
-- door. Roles are flat and nothing inherits, so a custom role granting `admin` has to be
-- given this one too — deliberately, from the screen, by somebody who means it.
insert into role_features (role_key, feature_key) values
  ('admin', 'rolePreview');
