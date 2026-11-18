-- A **remark** can be answered, from the same MESSAGES screen a TELL US message is.
--
-- `20261103010000_rating_remark.sql` promised the opposite: a remark "is never answered and
-- never reaches that screen". That kept two kinds of words from being mistaken for one, and
-- it cost the person who made the challenge any way to say thank you, or sorry, to a player
-- who had taken the trouble to write. So the two now share one pile and one answer, and
-- what keeps them apart is a **kind** on each row of it: a message is about a run, a
-- remark is about a session of a challenge, and the screen draws the one it is looking at.
--
-- What does not change: the lab's page per challenge still lists remarks with no name on
-- them (`challenge_remarks` is untouched). Only the MESSAGES screen names the author — it
-- has to, to answer anybody.
--
-- ─── The row ─────────────────────────────────────────────────────────────────
--
-- `session_ratings` gets the four columns `feedback` has for answering, and an `id`: its
-- key is (session, user), and an answer is addressed by one value the way a message's is.
-- `remarked_at` is when the words were sent — `rated_at` is the figure's, and the two can
-- be days apart.

alter table session_ratings
  add column id uuid not null default gen_random_uuid(),
  add column remarked_at timestamptz,
  add column answer text
    check (answer is null or length(btrim(answer)) between 1 and 800),
  add column answered_at timestamptz,
  add column answer_seen_at timestamptz,
  add column dismissed_at timestamptz,
  add constraint session_ratings_id_key unique (id);

update session_ratings set remarked_at = rated_at where remark is not null;

-- The same trigger a message's answer has: answering stamps `answered_at` and clears
-- `answer_seen_at`, so a corrected answer arrives again.
create trigger session_ratings_answered
  before update of answer on session_ratings
  for each row when (new.answer is distinct from old.answer)
  execute function stamp_feedback_answer();

-- `remark_session` as it was, plus the one stamp.
create or replace function remark_session(p_session uuid, p_remark text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_remark text := btrim(p_remark, E' \t\r\n');
begin
  if auth.uid() is null then
    raise exception 'remark_session: not signed in';
  end if;
  if v_remark is null or v_remark = '' then
    raise exception 'remark_session: a remark has to say something';
  end if;
  if char_length(v_remark) > 500 then
    raise exception 'remark_session: a remark is at most 500 characters';
  end if;
  if not exists (
    select 1 from session_scores where session_id = p_session and user_id = auth.uid()
  ) then
    raise exception 'remark_session: no score on that session';
  end if;
  if not exists (
    select 1 from challenge_sessions where id = p_session and closes_at <= now()
  ) then
    raise exception 'remark_session: that session has not closed';
  end if;
  insert into session_ratings (session_id, user_id, remark, remarked_at)
  values (p_session, auth.uid(), v_remark, now())
  on conflict (session_id, user_id)
  do update set remark = excluded.remark, remarked_at = excluded.remarked_at;
end;
$$;

-- ─── The player's side ───────────────────────────────────────────────────────
--
-- One queue of replies, from both tables, oldest answer first. The id is whichever row's
-- it is — they are uuids drawn from the same space — and `mark_feedback_reply_seen` tries
-- both, so the client needs to know nothing about the difference.
-- A remark's answer is never held for a build: there is no fix to wait for.

create or replace function my_feedback_replies(p_build text default null)
returns table (
  id         uuid,
  answer     text,
  message    text,
  created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select q.id, q.answer, q.message, q.created_at
  from (
    select f.id, f.answer, f.message, f.created_at, f.answered_at
    from   feedback f
    where  f.user_id = auth.uid()
      and  f.answer is not null
      and  f.answer_seen_at is null
      and  (f.answer_needs_build is null or p_build >= f.answer_needs_build)
    union all
    select r.id, r.answer, r.remark, r.remarked_at, r.answered_at
    from   session_ratings r
    where  r.user_id = auth.uid()
      and  r.answer is not null
      and  r.answer_seen_at is null
  ) q
  order  by q.answered_at;
$$;

create or replace function mark_feedback_reply_seen(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update feedback
  set    answer_seen_at = now()
  where  id = p_id
    and  user_id = auth.uid()
    and  answer is not null
    and  answer_seen_at is null;
  update session_ratings
  set    answer_seen_at = now()
  where  id = p_id
    and  user_id = auth.uid()
    and  answer is not null
    and  answer_seen_at is null;
end;
$$;

-- ─── The admin's side ────────────────────────────────────────────────────────
--
-- `admin_feedback` grows five columns and loses three guarantees: a remark has no
-- difficulty, no score and no build, so those three are now nullable on the wire. For a
-- remark `mode` is the challenge's id, and `session_id` / `session_opens_at` / `rating`
-- say which appearance of it and what the player gave it.

drop function if exists admin_feedback();

create function admin_feedback()
returns table (
  id               uuid,
  kind             text,
  user_id          uuid,
  nickname         text,
  message          text,
  mode             text,
  difficulty       text,
  score            int,
  build            text,
  created_at       timestamptz,
  answer           text,
  answered_at      timestamptz,
  answer_seen_at   timestamptz,
  dismissed_at     timestamptz,
  session_id       uuid,
  session_opens_at timestamptz,
  rating           smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_feedback: not an admin';
  end if;

  return query
    select * from (
      select f.id, 'message'::text, f.user_id, p.nickname::text, f.message,
             f.mode, f.difficulty, f.score, f.build, f.created_at,
             f.answer, f.answered_at, f.answer_seen_at, f.dismissed_at,
             null::uuid, null::timestamptz, null::smallint
      from   feedback f
      left   join profiles p on p.id = f.user_id
      union all
      select r.id, 'remark'::text, r.user_id, p.nickname::text, r.remark,
             s.mode_id, null::text, null::int, null::text, r.remarked_at,
             r.answer, r.answered_at, r.answer_seen_at, r.dismissed_at,
             r.session_id, s.opens_at, r.rating
      from   session_ratings r
      join   challenge_sessions s on s.id = r.session_id
      left   join profiles p on p.id = r.user_id
      where  r.remark is not null
    ) m
    order by m.created_at desc;
end;
$$;

grant execute on function public.admin_feedback() to authenticated;

create or replace function admin_feedback_owed()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_feedback_owed: not an admin';
  end if;
  return (
    select count(*) from feedback
    where  answer is null and dismissed_at is null
  ) + (
    select count(*) from session_ratings
    where  remark is not null and answer is null and dismissed_at is null
  );
end;
$$;

create or replace function admin_answer_feedback(p_id uuid, p_answer text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_answer_feedback: not an admin';
  end if;

  update feedback
  set    answer = btrim(p_answer),
         dismissed_at = null
  where  id = p_id;
  if found then return; end if;

  update session_ratings
  set    answer = btrim(p_answer),
         dismissed_at = null
  where  id = p_id and remark is not null;
end;
$$;

create or replace function admin_dismiss_feedback(p_id uuid, p_dismissed boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_dismiss_feedback: not an admin';
  end if;

  update feedback
  set    dismissed_at = case when p_dismissed then now() else null end
  where  id = p_id
    and  (not p_dismissed or answer is null);
  if found then return; end if;

  update session_ratings
  set    dismissed_at = case when p_dismissed then now() else null end
  where  id = p_id
    and  remark is not null
    and  (not p_dismissed or answer is null);
end;
$$;
