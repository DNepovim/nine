-- Expose session_scores to Supabase Realtime, so a run in progress hears the moment
-- another player goes ahead of it on the same session board — the `sessionLost`
-- announcement (lib/session-announcements.ts). The table is already public read, so
-- Realtime's RLS check passes every subscriber the same rows the `session_board` RPC does.
alter publication supabase_realtime add table session_scores;

-- Full replica identity, the same as scores and daily_scores: a DELETE would otherwise
-- carry no `session_id`, and the client attributes every event by it.
alter table session_scores replica identity full;
