-- An answer that waits for the build it talks about.
--
-- Most answers are written days or weeks after the message, and a good many of them say
-- some version of "fixed". Until now the player could read that on the very build that
-- still has the bug: the dialog shows up on the next launch, whatever code that launch
-- happens to be running. A web app makes this worse rather than better — the service
-- worker keeps serving its cached bundle until it decides to swap, so "the next launch"
-- and "the newest build" are not the same moment, and the gap between them is exactly
-- where a reply promising a fix does the most damage to its own credibility.
--
-- So an answer may name the build it needs. `my_feedback_replies` is now told which build
-- is asking, and holds back anything that wants a newer one: the answer keeps its unseen
-- stamp and comes round again on a launch that actually has the thing it describes.
--
-- Answering with a gate is one more assignment and nothing else:
--
--   update feedback
--   set    answer = 'Fixed — the dial no longer eats the first press.',
--          answer_needs_build = '260924.1430'
--   where  id = '…';
--
-- A stamp is the second half of a build id, so the one a message came from is
-- `split_part(build, '-', 2)` — useful for reading, never for gating: the build to name
-- is the one carrying the fix, not the one that reported the bug.

-- `build:web` stamps EXPO_PUBLIC_BUILD_ID as `<sha>-<yymmdd.HHMM>`; this is that second
-- half, verbatim. Text, and compared as text, on purpose: those digits in that order sort
-- chronologically anyway, and the stamp is the build machine's wall clock with no zone
-- written on it. Reading it into a timestamptz would mean inventing one on each side and
-- hoping they agreed. Stamp against stamp compares like with like.
alter table feedback
  add column answer_needs_build text
    check (answer_needs_build is null or answer_needs_build ~ '^\d{6}\.\d{4}$');

comment on column feedback.answer_needs_build is
  'Hold this answer until the player runs a build at least this new — the yymmdd.HHMM half of that build''s id. Null delivers on the next launch, whatever is running.';

-- ─── Reading a reply ─────────────────────────────────────────────────────────
-- The same function as 20260923000000_feedback_reply.sql, now asked who is asking.
--
-- Dropped and recreated rather than replaced: a new parameter makes a new signature, so
-- `create function` would leave the old one standing beside it and a no-argument call
-- would match both and fail as ambiguous.
--
-- The parameter defaults to null so a no-argument call still lands here — which is what a
-- client cached from before this migration sends. Null loses every comparison below, so
-- such a client keeps receiving its ungated answers and is held back from all the rest:
-- precisely right for a client old enough to still be asking the old way. A build with no
-- stamp at all (`expo start`, where EXPO_PUBLIC_BUILD_ID is never set) sends null too and
-- is treated the same — a gated answer is not readable in development, which is the safe
-- direction for the one environment where an answer can simply be un-gated to look at it.

drop function my_feedback_replies();

create function my_feedback_replies(p_build text default null) returns table (
  id     uuid,
  answer text
) language sql stable security definer set search_path = public as $$
  select f.id, f.answer
  from   feedback f
  where  f.user_id = auth.uid()
    and  f.answer is not null
    and  f.answer_seen_at is null
    -- Null p_build makes this null rather than true, so an unknown build is a build that
    -- does not qualify. The gate only ever opens for a stamp we were actually given.
    and  (f.answer_needs_build is null or p_build >= f.answer_needs_build)
  order  by f.answered_at;
$$;

grant execute on function public.my_feedback_replies(text) to authenticated;
