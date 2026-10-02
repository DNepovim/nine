-- set_user_role: the one way `profiles.role` is ever written by a client.
--
-- …_profile_role.sql took the column off the authenticated grant entirely — a role is not
-- something a player sets on themselves, the way a nickname or a motto is. What was
-- missing was the other side of that: a guarded way for an admin to set it on someone
-- else. This is it, for the admin screen on the intro.
--
-- `security definer` so it can write a column the caller's own grant does not reach, and
-- the whole function is the check that stands in for that grant: the caller's own row in
-- `profiles` must already say `role = 'admin'` before anything is written. Nobody who is
-- not already an admin can make one — including themselves — the same shape as every
-- other security-definer door in this schema.
create or replace function set_user_role(
  p_user_id uuid,
  p_role    text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller      uuid := auth.uid();
  v_caller_role text;
begin
  if v_caller is null then
    raise exception 'set_user_role: not authenticated';
  end if;

  select role into v_caller_role from profiles where id = v_caller;
  if v_caller_role is distinct from 'admin' then
    raise exception 'set_user_role: caller is not an admin';
  end if;

  -- Null is a legal target — it is how a role is taken away again — but anything else
  -- has to be one of the three the column's own check constraint already names.
  if p_role is not null and p_role not in ('tester', 'developer', 'admin') then
    raise exception 'set_user_role: unknown role %', p_role;
  end if;

  update profiles set role = p_role where id = p_user_id;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;
