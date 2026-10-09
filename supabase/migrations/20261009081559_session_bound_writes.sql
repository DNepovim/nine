-- A profile lives on one device at a time, and this is what makes that true of the data
-- rather than only of the screens.
--
-- Restoring a profile onto another phone calls `signOut({ scope: 'others' })`, which
-- deletes every other session row. What it does *not* do is reach into the phone it took
-- the profile from: that device still holds an access token, and an access token is good
-- until it expires — an hour by `jwt_expiry`. PostgREST checks a token's signature and
-- nothing else, so for that hour the old phone goes on writing scores, achievements and
-- totals under a profile that has already moved. Both phones, one player, two sets of
-- rows. That is the bug this closes.
--
-- The client now asks `/auth/v1/user` on launch, on foreground and on a timer, which is
-- the only endpoint that checks the session rather than the signature. But that is
-- detection, and detection has a window. This is the guarantee: the writes themselves are
-- refused, from the first moment, by the database.
--
-- Supabase's own guidance, from the sessions guide: "When a user signs out, the sessions
-- affected by the sign-out are removed from the database entirely. You can check that the
-- `session_id` claim in the JWT corresponds to a row in the `auth.sessions` table."

-- A schema for things that are called by policies and by nothing else. Not in the Data
-- API's `schemas` list, so nothing here is reachable as an RPC however it is granted.
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Whether the session this request's token was minted for still exists.
--
-- `security definer` because `auth.sessions` belongs to the auth admin and no player role
-- may read it; `stable` so a policy evaluates it once per statement rather than once per
-- row. The only thing it can tell a caller is whether their own session is alive, which
-- they can discover anyway by making any request at all.
--
-- A token with no `session_id` claim answers false. The policies below pair this with an
-- `auth.uid()` check that only a real session can satisfy, so the only tokens reaching
-- here without the claim are ones that were failing those policies already.
create or replace function private.session_is_live()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.sessions s
     where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  );
$$;

revoke all on function private.session_is_live() from public;
grant execute on function private.session_is_live() to authenticated;

-- Restrictive rather than permissive: these are ANDed with the `own ...` policies already
-- on each table rather than offering a new way in. One per command, and deliberately not
-- `for all` — a device whose session has gone must still be able to *read* its profile
-- row, because that read is how the app tells "your profile moved to another phone" apart
-- from "this account no longer exists", and those are different things to say to a player.
create policy "live session insert" on public.daily_scores
  as restrictive for insert to authenticated
  with check ((select private.session_is_live()));

create policy "live session update" on public.daily_scores
  as restrictive for update to authenticated
  using ((select private.session_is_live()))
  with check ((select private.session_is_live()));

create policy "live session insert" on public.achievements
  as restrictive for insert to authenticated
  with check ((select private.session_is_live()));

create policy "live session update" on public.achievements
  as restrictive for update to authenticated
  using ((select private.session_is_live()))
  with check ((select private.session_is_live()));

create policy "live session update" on public.profiles
  as restrictive for update to authenticated
  using ((select private.session_is_live()))
  with check ((select private.session_is_live()));

create policy "live session insert" on public.scores
  as restrictive for insert to authenticated
  with check ((select private.session_is_live()));

create policy "live session update" on public.scores
  as restrictive for update to authenticated
  using ((select private.session_is_live()))
  with check ((select private.session_is_live()));

-- `record_run` is `security definer`, so it is the one write path no policy above can
-- reach: it runs as the owner and RLS never looks at it. The same question, asked once,
-- beside the authentication check it belongs next to.
--
-- Raised rather than returned quietly. The run is genuinely refused here — unlike a
-- replayed receipt, which is a retry whose answer was lost — and the client treats a
-- failed post as a run still waiting to be sent, which is the right thing for it to do
-- with a run that nobody has accepted.
create or replace function public.record_run(
  p_run_id uuid, p_mode text, p_difficulty text, p_score integer, p_hits integer,
  p_acc_sum double precision, p_spd_sum double precision,
  p_elapsed_ms bigint default 0, p_final boolean default true
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_owner      uuid;
  v_settled    boolean;
  v_mode       text;
  v_difficulty text;
  v_old_score   bigint           := 0;
  v_old_hits    int              := 0;
  v_old_acc     double precision := 0;
  v_old_spd     double precision := 0;
  v_old_elapsed bigint           := 0;
  v_fresh boolean;
  v_new_score   bigint;
  v_new_hits    int;
  v_new_acc     double precision;
  v_new_spd     double precision;
  v_new_elapsed bigint;
  v_acc double precision;
  v_spd double precision;
begin
  if v_user is null then
    raise exception 'record_run: not authenticated';
  end if;
  -- The profile moved to another device while this one was mid-run.
  if not private.session_is_live() then
    raise exception 'record_run: session revoked';
  end if;
  if p_mode not in ('accuracy', 'speed') then
    raise exception 'record_run: unknown mode %', p_mode;
  end if;
  if p_difficulty not in ('easy', 'hard', 'extreme') then
    raise exception 'record_run: unknown difficulty %', p_difficulty;
  end if;
  if p_score < 0 or p_hits < 0 or p_acc_sum < 0 or p_spd_sum < 0 or p_elapsed_ms < 0 then
    raise exception 'record_run: negative values';
  end if;
  if p_hits > 5000 or p_score > 1000000 then
    raise exception 'record_run: out of range';
  end if;
  if p_elapsed_ms > 86400000 then
    raise exception 'record_run: elapsed out of range';
  end if;
  if p_acc_sum > p_hits * 2 or p_spd_sum > p_hits * 2 then
    raise exception 'record_run: factor sums out of range';
  end if;

  select r.user_id, r.settled, r.mode, r.difficulty,
         r.score, r.hits, r.acc_sum, r.spd_sum, r.elapsed_ms
    into v_owner, v_settled, v_mode, v_difficulty,
         v_old_score, v_old_hits, v_old_acc, v_old_spd, v_old_elapsed
    from run_receipts r
   where r.run_id = p_run_id
     for update;
  v_fresh := not found;

  if v_fresh then
    v_old_score := 0; v_old_hits := 0;
    v_old_acc := 0;   v_old_spd := 0;
    v_old_elapsed := 0;
  else
    if v_owner <> v_user then return; end if;
    if v_settled then return; end if;
    if v_mode <> p_mode or v_difficulty <> p_difficulty then
      raise exception 'record_run: board changed mid-run';
    end if;
  end if;

  v_new_score   := greatest(v_old_score, p_score);
  v_new_hits    := greatest(v_old_hits, p_hits);
  v_new_acc     := greatest(v_old_acc, p_acc_sum);
  v_new_spd     := greatest(v_old_spd, p_spd_sum);
  v_new_elapsed := greatest(v_old_elapsed, p_elapsed_ms);

  v_acc := case when p_final and p_hits > 0 then 100 * p_acc_sum / p_hits else 0 end;
  v_spd := case when p_final and p_hits > 0 then 100 * p_spd_sum / p_hits else 0 end;

  insert into run_receipts (
    run_id, user_id, mode, difficulty,
    score, hits, acc_sum, spd_sum, elapsed_ms, settled
  )
  values (
    p_run_id, v_user, p_mode, p_difficulty,
    v_new_score, v_new_hits, v_new_acc, v_new_spd, v_new_elapsed, p_final
  )
  on conflict (run_id) do update set
    score      = excluded.score,
    hits       = excluded.hits,
    acc_sum    = excluded.acc_sum,
    spd_sum    = excluded.spd_sum,
    elapsed_ms = excluded.elapsed_ms,
    settled    = excluded.settled;

  insert into player_totals (
    user_id, mode, difficulty, runs, hits, score_sum, acc_sum, spd_sum,
    best_acc, best_spd, time_ms, updated_at
  )
  values (
    v_user, p_mode, p_difficulty,
    case when v_fresh then 1 else 0 end,
    v_new_hits - v_old_hits,
    v_new_score - v_old_score,
    v_new_acc - v_old_acc,
    v_new_spd - v_old_spd,
    v_acc, v_spd,
    v_new_elapsed - v_old_elapsed,
    now()
  )
  on conflict (user_id, mode, difficulty) do update set
    runs       = player_totals.runs + excluded.runs,
    hits       = player_totals.hits + excluded.hits,
    score_sum  = player_totals.score_sum + excluded.score_sum,
    acc_sum    = player_totals.acc_sum + excluded.acc_sum,
    spd_sum    = player_totals.spd_sum + excluded.spd_sum,
    best_acc   = greatest(player_totals.best_acc, excluded.best_acc),
    best_spd   = greatest(player_totals.best_spd, excluded.best_spd),
    time_ms    = player_totals.time_ms + excluded.time_ms,
    updated_at = now();
end;
$function$;
