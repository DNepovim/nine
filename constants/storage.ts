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
export const SEEN_NEWS_KEY = 'nine.seen-news.v1'
export const TUTORIAL_KEY = 'nine.tutorial.v1'
// Absent until the player picks a language in options. While it is absent the device's
// own preference decides on every launch, so changing the phone's language changes the
// app's — which stops being true the moment they choose for themselves.
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
