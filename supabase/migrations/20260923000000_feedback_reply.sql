-- An answer to a message a player sent, and the way it reaches them.
--
-- The dialog has always promised the message is read, and told the player not to expect a
-- reply — which is the honest thing to say when there is no way to send one. This is that
-- way: an `answer` written by hand in the SQL editor, delivered as a dialog the next time
-- the player opens the game, and then gone.
--
-- The table stays unreadable from the client. There is still no select policy and no
-- select grant on `feedback` (see 20260819000000_feedback.sql, which argues for that at
-- length), so the answer comes back through a function instead — and that function
-- returns the answer alone. Not the message, not the board, not the run snapshot: a
-- player asking for their reply is asking for the reply, and nothing else needs to cross
-- the wire for the dialog to be drawn.

alter table feedback
  add column answer text
    check (answer is null or length(btrim(answer)) between 1 and 800),
  -- When it was written, which is what "oldest first" means when several are waiting.
  add column answered_at timestamptz,
  -- When the player closed the dialog. Null while a reply is still owed, which is what
  -- `my_feedback_replies` filters on — and, read in the dashboard, the one way to tell
  -- whether an answer ever actually landed in front of anyone.
  add column answer_seen_at timestamptz;

comment on column feedback.answer is
  'The reply to this message, written by hand. Delivered to the player once, then marked seen. Null for a message with no answer.';

-- ─── Stamping the answer ─────────────────────────────────────────────────────
-- Answering is `update feedback set answer = '…' where id = '…'` and nothing else. The
-- two timestamps are the database's business, not something to remember at the keyboard:
-- an `answered_at` left behind by a hurried update would reorder the queue, and an
-- `answer_seen_at` left behind by a *corrected* answer would bury the correction.

create function stamp_feedback_answer() returns trigger
language plpgsql as $$
begin
  new.answered_at := now();
  -- Rewriting an answer sends it again. A correction that the player never sees is worth
  -- less than nothing, and the only reason to edit one is that the first was wrong.
  new.answer_seen_at := null;
  return new;
end;
$$;

create trigger feedback_answered
  before update of answer on feedback
  for each row when (new.answer is distinct from old.answer)
  execute function stamp_feedback_answer();

-- ─── Reading a reply ─────────────────────────────────────────────────────────

-- Every answer owed to the player asking, oldest first.
--
-- `security definer` because the caller has no select grant on the table at all, and the
-- filter is `auth.uid()` rather than an argument: an id that came up with the request is
-- an id that can be swapped for someone else's.
create function my_feedback_replies() returns table (
  id     uuid,
  answer text
) language sql stable security definer set search_path = public as $$
  select f.id, f.answer
  from   feedback f
  where  f.user_id = auth.uid()
    and  f.answer is not null
    and  f.answer_seen_at is null
  order  by f.answered_at;
$$;

-- Closing the dialog. Scoped to the caller's own rows for the same reason: the id travels
-- from the client, and on its own it must not be a key to anything.
create function mark_feedback_reply_seen(p_id uuid) returns void
language sql volatile security definer set search_path = public as $$
  update feedback
  set    answer_seen_at = now()
  where  id = p_id
    and  user_id = auth.uid()
    and  answer is not null
    and  answer_seen_at is null;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- Signed-in only, like the insert. `anon` has no rows here by definition — every row is
-- filed under an `auth.uid()` — so the function would answer an anonymous caller with an
-- empty set anyway, and not granting it says so at the door.

grant execute on function public.my_feedback_replies()          to authenticated;
grant execute on function public.mark_feedback_reply_seen(uuid) to authenticated;
