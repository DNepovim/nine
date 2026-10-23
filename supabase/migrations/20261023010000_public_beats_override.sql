-- A public feature reaches everybody, and an override no longer takes it away.
--
-- 20261014010000 made `public` beat the stack and deliberately *not* an override, so a
-- revoke on the person screen kept taking a public feature off the one person it named.
-- That rule is reversed. Public means everybody: the admin screens no longer show a
-- public feature on a role or a person at all, because neither can change whether they
-- reach it — and a revoke the screens cannot show would be an instruction nobody can see
-- or take back. Nothing in production depended on it: no override row named a public
-- feature when this was written.
--
-- The resolve now reads hidden, then public, then the override, then the stack.
--
-- **Making a feature public also forgets who it was granted to.** Its ticks in every
-- role's stack and every override naming it are deleted, here for the one feature public
-- already, and by `set_feature` from now on. Kept, they would be state the screens no
-- longer show — and it would all come back without a word the day the feature was made
-- private again, reaching whoever happened to be ticked months earlier. Private again
-- starts from nobody, and the admin ticks it out from there. The `admin` key can never be
-- public, so this cannot take the screen away from the person using it.
--
-- `has_feature` reads `effective_features` and every guard reads `has_feature`, so the
-- resolve below is the whole of the rule; the deletes and `set_feature` are the
-- housekeeping that keeps it from hiding anything.

create or replace function effective_features(p_user_id uuid)
returns setof text language sql stable set search_path = public as $$
  select f.key
  from features f
  where f.visibility <> 'hidden'
    and (
      f.visibility = 'public'
      or coalesce(
        (select uf.granted
           from user_features uf
          where uf.user_id = p_user_id and uf.feature_key = f.key),
        exists (select 1
                  from role_features rf
                  join profiles p on p.role = rf.role_key
                 where p.id = p_user_id and rf.feature_key = f.key)
      )
    );
$$;

delete from user_features uf using features f
 where f.key = uf.feature_key and f.visibility = 'public';
delete from role_features rf using features f
 where f.key = rf.feature_key and f.visibility = 'public';

-- `set_feature` as 20261014010000 wrote it, with the clearing added at the end of the
-- write. Same signature, so a replacement rather than a second function.
create or replace function set_feature(p_key text, p_visibility text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
begin
  if p_visibility not in ('hidden', 'private', 'public') then
    raise exception 'set_feature: unknown visibility %', p_visibility;
  end if;
  update features set visibility = p_visibility, note = p_note where key = p_key;
  -- Public reaches everybody, so nothing per role or per person is left to say about it.
  if p_visibility = 'public' then
    delete from user_features where feature_key = p_key;
    delete from role_features where feature_key = p_key;
  end if;
  perform guard_admin_floor(v_caller);
end;
$$;
