-- The message an answer answers, handed back beside it.
--
-- 20260923000000_feedback_reply.sql argued the opposite at length: "that function returns
-- the answer alone. Not the message, not the board, not the run snapshot." That argument
-- was about what a *reader* is entitled to, and it still holds for the board and the run
-- snapshot. It was wrong about the message. The reply lands weeks after the thing it
-- replies to, on a launch the player did not connect to anything they wrote, and an
-- answer with no question in front of it reads as a message for somebody else.
--
-- Nothing crosses a trust boundary here that was not already on this side of it. The
-- function is `security definer` filtered on `auth.uid()`, so the only message it can
-- return to a player is one that player typed. Their own words coming back is not a
-- disclosure; it is the half of the conversation they are missing.
--
-- `created_at` comes with it because the message needs dating. Weeks-old is the ordinary
-- case, and "you wrote this" means something different when the player can see it was in
-- July.

drop function my_feedback_replies(text);

-- Dropped and recreated rather than replaced, again: `create or replace` cannot change a
-- function's return type, and this one grows two columns.
--
-- The client narrows the two new columns as optional (`lib/feedback-reply.ts`), so a
-- bundle running against a database without this migration — a cached service worker, a
-- local stack that has not been reset — shows the answer without the quote rather than
-- showing nothing.
create function my_feedback_replies(p_build text default null) returns table (
  id         uuid,
  answer     text,
  message    text,
  created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select f.id, f.answer, f.message, f.created_at
  from   feedback f
  where  f.user_id = auth.uid()
    and  f.answer is not null
    and  f.answer_seen_at is null
    -- Unchanged, and still the whole point of p_build: a null stamp makes this null rather
    -- than true, so an unknown build is a build that does not qualify.
    and  (f.answer_needs_build is null or p_build >= f.answer_needs_build)
  order  by f.answered_at;
$$;

grant execute on function public.my_feedback_replies(text) to authenticated;
