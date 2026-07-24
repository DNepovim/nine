-- Multiplayer rooms and player membership tables.

create table rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  admin_id   uuid not null references auth.users(id) on delete cascade,
  mode       text not null check (mode in ('accuracy', 'speed')),
  status     text not null default 'waiting'
               check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table room_players (
  room_id   uuid not null references rooms(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table rooms enable row level security;
alter table room_players enable row level security;

create policy "rooms_public_read"   on rooms for select using (true);
create policy "rooms_admin_insert"  on rooms for insert with check (auth.uid() = admin_id);
create policy "rooms_admin_update"  on rooms for update using (auth.uid() = admin_id);
create policy "rooms_admin_delete"  on rooms for delete using (auth.uid() = admin_id);

create policy "rp_public_read"  on room_players for select using (true);
create policy "rp_join_own"     on room_players for insert with check (auth.uid() = user_id);
create policy "rp_leave_own"    on room_players for delete using (auth.uid() = user_id);

-- ── Grants ───────────────────────────────────────────────────────────────────

grant select                         on public.rooms        to anon, authenticated;
grant insert, update, delete         on public.rooms        to authenticated;
grant select                         on public.room_players to anon, authenticated;
grant insert, delete                 on public.room_players to authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;
alter table rooms replica identity full;
alter table room_players replica identity full;

-- ── SQL helpers ──────────────────────────────────────────────────────────────

-- Generate a 4-digit code unique among non-finished rooms.
create function generate_room_code()
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

-- Create a room and add the caller as the first (admin) player.
create function create_room(p_mode text)
returns table (room_id uuid, code text)
language plpgsql security definer
as $$
declare
  v_room_id uuid;
  v_code    text;
begin
  -- Ensure profile row exists (self-healing for local dev after db:reset).
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;

  v_code := generate_room_code();
  insert into rooms (code, admin_id, mode)
  values (v_code, auth.uid(), p_mode)
  returning id into v_room_id;

  insert into room_players (room_id, user_id)
  values (v_room_id, auth.uid());

  return query select v_room_id, v_code;
end;
$$;

-- Join an existing waiting room by code. Raises ROOM_NOT_FOUND or ROOM_FULL.
create function join_room(p_code text)
returns table (out_room_id uuid, out_admin_id uuid, out_mode text)
language plpgsql security definer
as $$
declare
  v_room  rooms;
  v_count int;
begin
  -- Ensure profile row exists (self-healing for local dev after db:reset).
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;

  select * into v_room from rooms where code = p_code and status = 'waiting';
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select count(*) into v_count
  from room_players rp
  where rp.room_id = v_room.id;

  if v_count >= 4 then
    raise exception 'ROOM_FULL';
  end if;

  insert into room_players (room_id, user_id)
  values (v_room.id, auth.uid())
  on conflict on constraint room_players_pkey do nothing;

  return query select v_room.id, v_room.admin_id, v_room.mode;
end;
$$;

-- Admin transitions room to playing.
create function start_room(p_room_id uuid)
returns void
language plpgsql security definer
as $$
begin
  update rooms set status = 'playing'
  where id = p_room_id and admin_id = auth.uid();
end;
$$;

-- Admin marks room finished (dissolves waiting room for all members).
create function finish_room(p_room_id uuid)
returns void
language plpgsql security definer
as $$
begin
  update rooms set status = 'finished'
  where id = p_room_id and admin_id = auth.uid();
end;
$$;
