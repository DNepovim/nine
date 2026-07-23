-- Expose scores and daily_scores to Supabase Realtime so clients can
-- subscribe to live leaderboard changes.
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table daily_scores;

-- Full replica identity so row-level column filters (mode=eq.X&difficulty=eq.Y)
-- work on all event types (INSERT, UPDATE, DELETE).
alter table scores replica identity full;
alter table daily_scores replica identity full;
