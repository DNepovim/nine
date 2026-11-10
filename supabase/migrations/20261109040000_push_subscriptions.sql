-- Push: the table of where to reach a player when the app is closed, and the first thing
-- worth reaching them about — a board they held being taken.
--
-- Three pieces, kept apart on purpose.
--
--   push_subscriptions  one device's address for a push, belonging to one profile.
--   push_outbox         pushes owed and not yet sent. A trigger writes it; the
--                       `send-push` function drains it. The trigger never touches the
--                       network, so a slow push service cannot slow a score write and no
--                       secret lives inside a trigger.
--   the trigger         a reign opening is the moment the previous holder lost the board.
--
-- Neither table is readable by a client. The app reaches subscriptions through the two
-- RPCs below and never sees the outbox at all.

create table push_subscriptions (
  id         bigserial primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  platform   text not null check (platform in ('web', 'ios', 'android')),
  -- A web push endpoint, or the Expo token on a native device. Unique across profiles: one
  -- device has one address, and a restore moves a profile onto a device, so a second save
  -- of the same address moves it rather than adding a second owner.
  endpoint   text not null unique,
  -- Web only; null for a native token.
  p256dh     text,
  auth       text,
  -- The language the push is written in, taken from the app when it subscribes.
  locale     text not null check (locale in ('en', 'cs')),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create table push_outbox (
  id          bigserial primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  kind        text not null check (kind in ('takeover')),
  mode        text not null,
  difficulty  text not null,
  -- The taker's nickname, kept whole. Stored rather than joined at send time because a
  -- nickname can change between the takeover and the push, and the push should say what
  -- was true when it happened.
  by_nickname text not null,
  -- The Prague day it was owed on. With the user and the board this is the throttle: one
  -- push per player per board per day, so a board changing hands back and forth does not
  -- ring a phone every time.
  day         date not null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  unique (user_id, mode, difficulty, day)
);

create index push_outbox_unsent_idx on push_outbox (id) where sent_at is null;

alter table push_outbox enable row level security;

-- Row security with no policy already refuses a client; the revoke makes it refuse for the
-- right reason, so a policy added later cannot open a table the grants never meant to.
revoke all on push_subscriptions, push_outbox from public, anon, authenticated;

-- The one thing the function does to a subscription itself: delete the ones the push service
-- says are gone for good. Everything else it does goes through `drain_push_outbox`. Granted
-- by name because this project's default privileges do not hand a new table to service_role,
-- and without it the delete is refused — silently, since the function only logs a failed push.
grant select, delete on push_subscriptions to service_role;

-- ─── Saving and dropping a subscription ─────────────────────────────────────

create or replace function save_push_subscription(
  p_platform text,
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_locale   text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'save_push_subscription: not signed in';
  end if;
  if p_endpoint is null or p_endpoint = '' then
    raise exception 'save_push_subscription: no endpoint';
  end if;
  -- The server POSTs to this address later, from a function holding the service key, so it
  -- must be a push service's and nobody else's. Browsers only ever hand out addresses on
  -- these hosts; anything else is somebody pointing the server at a place of their choosing.
  -- Native tokens are not URLs and are not sent from here yet.
  if p_platform = 'web' then
    if p_p256dh is null or p_auth is null then
      raise exception 'save_push_subscription: a web subscription carries its keys';
    end if;
    -- `coalesce`: an address that is not https at all matches nothing, and `null !~ x` is not true.
    if coalesce(substring(p_endpoint from '^https://([^/:@?#]+)(?::[0-9]+)?(?:/|$)'), '') !~
       '^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)$' then
      raise exception 'save_push_subscription: not a push service address';
    end if;
  end if;
  insert into push_subscriptions (user_id, platform, endpoint, p256dh, auth, locale)
  values (auth.uid(), p_platform, p_endpoint, p_p256dh, p_auth, p_locale)
  -- The device is the thing that is unique. Whoever saves it last owns it, which is what
  -- stops the previous profile on a shared or restored device from still being pushed.
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        locale = excluded.locale;
end;
$$;

create or replace function drop_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'drop_push_subscription: not signed in';
  end if;
  -- Only the caller's own: an endpoint is not a secret worth guarding against, but
  -- deleting somebody else's switches off their notifications.
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text, text) from public, anon;
revoke all on function public.drop_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function public.drop_push_subscription(text) to authenticated;

-- ─── A takeover owes the displaced holder a push ─────────────────────────────
-- `reconcile_board_reign` closes the open reign and inserts the next in one call, so the
-- insert is where both holders are known: the previous reign on the board is the newest
-- closed one, and its owner is who just lost it.

create or replace function board_reigns_owe_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_previous uuid;
  v_nickname text;
begin
  -- Hiding the feature is the way to pull it back, and it has to stop the pushes too, not
  -- only the asking: the people already subscribed are exactly who the client gate cannot
  -- reach.
  if exists (select 1 from features where key = 'push' and visibility = 'hidden') then
    return null;
  end if;

  select user_id into v_previous
  from   board_reigns
  where  mode = new.mode and difficulty = new.difficulty
    and  lost_at is not null and id <> new.id
  order  by lost_at desc, id desc
  limit  1;

  -- Nobody held it before, or the board came back round to the same player.
  if v_previous is null or v_previous = new.user_id then return null; end if;

  -- Nothing to send to a player with no device on file.
  if not exists (select 1 from push_subscriptions where user_id = v_previous) then
    return null;
  end if;

  select nickname into v_nickname from profiles where id = new.user_id;
  if v_nickname is null then return null; end if;

  insert into push_outbox (user_id, kind, mode, difficulty, by_nickname, day)
  values (v_previous, 'takeover', new.mode, new.difficulty, v_nickname,
          (now() at time zone 'Europe/Prague')::date)
  on conflict (user_id, mode, difficulty, day) do nothing;
  return null;
end;
$$;

create trigger board_reigns_push
  after insert on board_reigns
  for each row
  execute function board_reigns_owe_push();

-- ─── Draining the outbox ─────────────────────────────────────────────────────
-- Service role only: the function claims a batch and each row comes back with every
-- address it must reach. `skip locked` so two overlapping minutes do not send twice.

create or replace function drain_push_outbox(p_limit int)
returns table (
  outbox_id   bigint,
  kind        text,
  mode        text,
  difficulty  text,
  by_nickname text,
  endpoint    text,
  platform    text,
  p256dh      text,
  auth        text,
  locale      text
) language sql security definer set search_path = public as $$
  with claimed as (
    update push_outbox o
       set sent_at = now()
     where o.id in (
       select id from push_outbox where sent_at is null order by id limit p_limit
       for update skip locked
     )
    returning o.id, o.user_id, o.kind, o.mode, o.difficulty, o.by_nickname
  )
  select c.id, c.kind, c.mode, c.difficulty, c.by_nickname,
         s.endpoint, s.platform, s.p256dh, s.auth, s.locale
  from   claimed c
  join   push_subscriptions s on s.user_id = c.user_id;
$$;

-- Marked sent at claim time: a push is a nicety, and sending twice is worse than
-- occasionally not sending. The row stays as the throttle for the rest of the day.
revoke all on function public.drain_push_outbox(int) from public, anon, authenticated;
grant execute on function public.drain_push_outbox(int) to service_role;
