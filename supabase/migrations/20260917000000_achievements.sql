-- Achievements — the server's copy of what each player has earned.
--
-- The device's copy is what the app shows: the strip, the list and every count read
-- AsyncStorage, and an unlock never waits on a round trip. This table is the backup that
-- outlives a reinstall or a move to a second device.

create table achievements (
  user_id        uuid not null references profiles (id) on delete cascade,
  achievement_id text not null,
  -- When it was earned, never when it synced. The achievements screen dates each row
  -- with this, and a reinstall that restored them all stamped "today" would quietly
  -- rewrite the player's history — so a client always sends the moment it happened.
  earned_at      timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- Deliberately plain text rather than an enum: an achievement is added by shipping a
-- client, and an enum would make every addition a migration as well. Nothing here reads
-- the value — an id the server does not recognise is simply an id this client does.
create index achievements_user_idx on achievements (user_id);

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- No update and no delete, for anyone. An achievement is permanent, so the only write
-- that makes sense is the first one; re-sending a row is an upsert that ignores
-- duplicates, which is what makes an offline device safe to replay wholesale.

grant select         on public.achievements to anon;
grant select, insert on public.achievements to authenticated;

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Readable by anyone, so a future profile view can show what someone holds; writable
-- only by the player it belongs to.

alter table achievements enable row level security;

create policy "public read" on achievements for select using (true);
create policy "own insert"  on achievements for insert with check (auth.uid() = user_id);
