-- Editing a session people have played.
--
-- …_session_scores.sql hardened `cancel_challenge_session` and left its sibling alone,
-- which is half a guard: an admin could not delete a played session but could still move
-- it onto a different challenge. `session_scores` rows carry no mode of their own — they
-- belong to the session, and the session names the challenge — so re-pointing one
-- silently makes somebody's FOUR KEYS run part of another contest's standings, at a rung
-- those runs were never played at.
--
-- The **span** stays editable, and that is deliberate rather than an oversight. A window
-- typed an hour out is the ordinary reason to open this form, moving it does not change
-- what anybody played, and the write path checks the window on every submit anyway. What
-- is refused is only the one field the standings underneath depend on.
--
-- Same shape as the cancel guard: count the players, say how many, and let a session
-- nobody has touched be corrected freely.

create or replace function edit_challenge_session(
  p_id        uuid,
  p_mode_id   text,
  p_opens_at  timestamptz,
  p_closes_at timestamptz
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_was    text;
  v_played int;
begin
  perform require_admin();

  select mode_id into v_was from challenge_sessions where id = p_id;
  if not found then
    raise exception 'edit_challenge_session: no such session';
  end if;

  if v_was is distinct from p_mode_id then
    select count(*) into v_played from session_scores where session_id = p_id;
    if v_played > 0 then
      raise exception
        'edit_challenge_session: % % already scored on it, so it cannot change challenge',
        v_played, case when v_played = 1 then 'player has' else 'players have' end;
    end if;
  end if;

  if challenge_session_clashes(p_mode_id, p_opens_at, p_closes_at, p_id) then
    raise exception 'that challenge is already booked for part of that time';
  end if;

  update challenge_sessions
     set mode_id = p_mode_id, opens_at = p_opens_at, closes_at = p_closes_at
   where id = p_id;
end;
$$;
