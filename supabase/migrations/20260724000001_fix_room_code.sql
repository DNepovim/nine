-- Room codes use digits 1-9 only (no 0) so the custom dial keyboard covers all cases.
create or replace function generate_room_code()
returns text
language plpgsql
as $$
declare
  v_code text;
begin
  loop
    v_code := (floor(random()*9+1)::int::text) || (floor(random()*9+1)::int::text) || (floor(random()*9+1)::int::text) || (floor(random()*9+1)::int::text);
    exit when not exists (
      select 1 from rooms where code = v_code and status != 'finished'
    );
  end loop;
  return v_code;
end;
$$;
