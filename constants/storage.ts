// AsyncStorage keys for persisted state.

// Bumped to v4 when the scoring mechanics changed: a best set under the old rules is not
// comparable to one set under the new ones, so it is not a best worth keeping. A missing
// key simply skips HYDRATE_STATS, which is why nothing has to migrate.
export const STATS_KEY = 'nine.stats.v4'
export const DIFFICULTY_KEY = 'nine.difficulty.v1'
export const MODE_KEY = 'nine.mode.v1'
export const OPTIONS_KEY = 'nine.options.v1'
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
export const SEEN_NEWS_KEY = 'nine.seen-news.v1'
// The last day whose winnings have already been announced. A day, not a list of windows:
// everything closed after it is owed, and everything on or before it has been told. Local
// rather than server-side, like SEEN_NEWS_KEY — a reinstall loses the telling, never the
// winnings themselves, which are derived from the boards.
export const SEEN_WINNINGS_KEY = 'nine.seen-winnings.v1'
export const TUTORIAL_KEY = 'nine.tutorial.v1'
// Whether this device has had its opening Trainee run — the welcome that a first launch
// drops straight into, in place of the tutorial that used to take the screen over. The
// stored flag outlives that one run: it is also what keeps Trainee's invitation to a
// scored board coming back. See lib/welcome.ts.
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
  'nine.pending-scores.v1',
  'nine.daily-bests.v1',
]
