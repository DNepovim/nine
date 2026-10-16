-- Answering and dismissing a message from the admin screen.
--
-- The messages screen has been a read since it was written: an answer was an
-- `update feedback set answer = …` run by hand from a machine with the production
-- credentials (the `answer-feedback` skill), and a message nobody was ever going to
-- answer simply stayed in OWED for good. Those are two different gaps and this closes
-- both — the write path for the quick answers, and a state for the ones that want no
-- answer at all.
--
-- **The skill stays**, and the split between the two is the build gate. An answer that
-- says *fixed* has to wait for a build that has the fix, which is what
-- `answer_needs_build` is for and what a phone cannot know: the stamp is read off a diff,
-- not off the device doing the typing. So the skill keeps the considered answers and this
-- keeps the rest, and the function below never sets the gate.

-- ─── Dismissed ───────────────────────────────────────────────────────────────

-- A message read and deliberately left unanswered.
--
-- Silent, and the whole of its effect is on this end: the row drops out of OWED and out
-- of the count behind the dot on the ADMIN link, and nothing reaches the player. The
-- feedback dialog promises that the message is read and that no reply should be expected
-- — so saying nothing is the thing that was promised, where a form letter closing the
-- thread would be a worse answer than none.
--
-- A timestamp rather than a flag, for what every other state on this row is: `answered_at`
-- and `answer_seen_at` are both moments, and *when it was set aside* is worth as much as
-- *that it was*. Null is the ordinary state and the one a restore puts back.
alter table feedback
  add column dismissed_at timestamptz;

comment on column feedback.dismissed_at is
  'When a message was set aside unanswered, or null. Admin-side only: nothing about it reaches the player.';

-- ─── Writing an answer ───────────────────────────────────────────────────────

-- The answer, written from the app.
--
-- `security definer` for the same reason every admin read is: `feedback` has no select
-- grant and no update policy for anybody, which is how this schema says *through a
-- guarded function alone*. So the guard is the function's first statement, and it is the
-- one every write in the feature system asks — the caller's own resolved feature set,
-- never `profiles.role`, which says what a person was given rather than what they hold.
--
-- The column's own check constraint carries the length (1 to 800 after trimming) and the
-- trigger carries the two stamps, including clearing `answer_seen_at` so that a corrected
-- answer is delivered again. Nothing here restates either: this function's whole job is
-- the guard and the `where`.
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
         -- Answering a message takes it out of the dismissed pile, because the two
         -- states are answers to the same question and the later press is the one meant.
         -- Nothing in the app can reach this — the screen offers one or the other — but a
         -- row that was both set aside and answered would be a row no filter describes.
         dismissed_at = null
  where  id = p_id;
end;
$$;

-- ─── Setting one aside ───────────────────────────────────────────────────────

-- Dismiss, and the undo of it, as one function taking which it is.
--
-- One rather than two because they are one decision made twice — and because a
-- `admin_restore_feedback` would be a second guard, a second grant and a second place for
-- the `where` to drift.
--
-- An answered message cannot be dismissed. The pile is for messages that will never be
-- answered, and a row that has an answer *and* is set aside reads as a mistake to every
-- filter on the screen.
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
end;
$$;

grant execute on function public.admin_answer_feedback(uuid, text)     to authenticated;
grant execute on function public.admin_dismiss_feedback(uuid, boolean) to authenticated;

-- ─── What the screen reads ───────────────────────────────────────────────────

-- `admin_feedback` gains the new column, which means dropping it first: a `returns table`
-- is part of a function's signature, so `create or replace` refuses to add a column to
-- one. Everything else about it is as 20261015010000 left it.
drop function if exists admin_feedback();

create function admin_feedback()
returns table (
  id            uuid,
  user_id       uuid,
  nickname      text,
  message       text,
  mode          text,
  difficulty    text,
  score         int,
  build         text,
  created_at    timestamptz,
  answer        text,
  answered_at   timestamptz,
  answer_seen_at timestamptz,
  dismissed_at  timestamptz
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
    select f.id,
           f.user_id,
           p.nickname::text,
           f.message,
           f.mode,
           f.difficulty,
           f.score,
           f.build,
           f.created_at,
           f.answer,
           f.answered_at,
           f.answer_seen_at,
           f.dismissed_at
    from   feedback f
    left   join profiles p on p.id = f.user_id
    order  by f.created_at desc;
end;
$$;

grant execute on function public.admin_feedback() to authenticated;

-- What the dot on the ADMIN link counts.
--
-- Dismissed messages come out of it, which is the point of the pile: the dot says *there
-- is something to do*, and a message deliberately set aside is a thing already done.
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
    select count(*)
    from   feedback
    where  answer is null
      and  dismissed_at is null
  );
end;
$$;
