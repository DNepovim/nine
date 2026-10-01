// AsyncStorage keys for persisted state.

// Bumped to v4 when the scoring mechanics changed: a best set under the old rules is not
// comparable to one set under the new ones, so it is not a best worth keeping. A missing
// key simply skips HYDRATE_STATS, which is why nothing has to migrate.
export const STATS_KEY = 'nine.stats.v4'
export const DIFFICULTY_KEY = 'nine.difficulty.v1'
export const MODE_KEY = 'nine.mode.v1'
export const OPTIONS_KEY = 'nine.options.v1'
// Whether the start screen was last left on the ARCADE pill. Its own key rather than a
// value in MODE_KEY, because arcade is not a `Mode`: that key hydrates the game machine,
// and a string it cannot parse would be a mode the machine has to have an opinion about.
// A launch that cannot read this one simply opens on the stored mode.
export const ARCADE_FOCUS_KEY = 'nine.arcade-focus.v1'
// Which of the two ways up the arcade map was last read: north pinned to the top of the
// screen, or the hero's own heading. Its own key rather than a field in OPTIONS_KEY — that
// one is the dial's advanced options, set on a screen this control is nowhere near, and a
// rose tapped mid-run has no business rewriting a record of what the player chose there.
// Absent on a first launch, which is the sheet turning: see hooks/use-persisted-rose.ts.
export const ARCADE_ROSE_KEY = 'nine.arcade-rose.v1'
// Lifetime totals — runs, hits, day streaks — behind the achievements. Deliberately not
// part of STATS_KEY: that one is versioned on the scoring mechanics and dropped whenever
// they change, and a thousand lifetime hits is a thousand lifetime hits whatever the
// points were worth at the time.
export const CAREER_KEY = 'nine.career.v1'
// Which achievements have been earned, and when. The device's copy is what the app
// shows; the server's is the backup that outlives a reinstall.
export const ACHIEVEMENTS_KEY = 'nine.achievements.v1'
// Every run the device remembers, published or not — see lib/local-scores.ts. Replaces
// the separate pending queue and daily-bests stores, which held the same runs twice.
export const LOCAL_SCORES_KEY = 'nine.scores.v1'
// Finished runs whose lifetime counters have not reached the server yet — see
// lib/run-totals.ts. Separate from LOCAL_SCORES_KEY because the two answer different
// questions: that store keeps the best run per board per day, and a counter needs every
// run, including the ones that beat nothing.
export const RUN_TOTALS_KEY = 'nine.run-totals.v1'
// Where the player stood on every board the last time the app looked, with the Prague
// day it looked on — see lib/lost-medals.ts. Only ever compared against a fresh answer
// from the same question, so it holds no truth of its own: losing it costs one greeting,
// not a record.
export const SEEN_STANDINGS_KEY = 'nine.seen-standings.v1'
// The medals taken off the player in the last week, with whoever the board named at the
// time — see lib/medal-history.ts. Written by the same launch-time diff that announces
// them under the title, and read by the medals screen behind that line. Local only: it is
// a record of what was said, not of what is true, and the boards themselves are the truth.
export const MEDAL_HISTORY_KEY = 'nine.medal-history.v1'
export const SEEN_NEWS_KEY = 'nine.seen-news.v1'
// The last day whose winnings have already been announced. A day, not a list of windows:
// everything closed after it is owed, and everything on or before it has been told. Local
// rather than server-side, like SEEN_NEWS_KEY — a reinstall loses the telling, never the
// winnings themselves, which are derived from the boards.
export const SEEN_WINNINGS_KEY = 'nine.seen-winnings.v1'
// The run the app was last closed on, live or paused — see lib/saved-run.ts. Written
// when a run is put down and cleared the moment there is no longer one to come back to,
// so a key that exists always means a run in progress. Versioned on the shape of what is
// stored, not on the scoring mechanics: a run is only ever read back by the build that
// wrote it minutes earlier, and a key it cannot parse is simply skipped.
export const RUN_KEY = 'nine.run.v1'
// Whether the player has read the How to Play guide — set when they close it, by either
// button at the bottom. The one thing that reads it is the GRADUATE achievement, which
// used to ask the same question of a hands-on walkthrough that opened from the same
// screen. See lib/how-to-play.ts.
export const HOW_TO_PLAY_KEY = 'nine.how-to-play.v1'
// Whether this device has had its opening tutorial run — the welcome that a first launch
// drops straight into. The stored flag outlives that one run: it is also what keeps
// Trainee's invitation to a scored board coming back. See lib/welcome.ts.
export const WELCOME_KEY = 'nine.welcome.v1'
// Absent until the player picks a language in options; while it is absent the app is in
// English. The device's own language is never consulted — see hooks/use-locale.tsx.
export const LOCALE_KEY = 'nine.locale.v1'

// Keys no build reads any more, cleared once on boot so the retired data does not sit on
// the device forever. Anything listed here is gone for good: the pending queue is on the
// list because an unpublished score from the old mechanics would otherwise publish itself
// onto the boards on the next reconnection.
export const RETIRED_KEYS = [
  'nine.stats.v3',
  'nine.tutorial.v1',
  'nine.pending-scores.v1',
  'nine.daily-bests.v1',
]
