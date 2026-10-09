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
// The last day the server was asked what this player is owed and answered nothing. A
// brake, not a record of payment: what has been paid is the watermark on the player's own
// profile, and it moves only when they accept. This exists because a player who never
// places on a board would otherwise ask about a span that only grows, on every launch.
//
// A new string rather than a new meaning on `nine.seen-winnings.v1`, which held the last
// day *announced* and was what the money used to hang on. A v1 value read under these
// rules would be a past date claiming the server was asked then — true of the old
// question, not of this one. The old key is retired below and cleared on boot.
export const ASKED_WINNINGS_KEY = 'nine.asked-winnings.v1'
// The Monday of the last week whose recap has already been told. A Monday, not a list and
// not a date the telling happened on: a recap only ever speaks for the week that has just
// closed, so one week behind the current one is owed and anything older has expired
// unheard. Absent means a first-ever launch, which is marked and stays quiet — a new player
// should meet the game, not a report on a week they were not here for. Local, like the two
// markers above: a reinstall loses the telling, and there is nothing else to lose.
export const SEEN_RECAP_KEY = 'nine.seen-recap.v1'
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
// Whether an answer to this player's feedback has ever reached them — set when they
// dismiss the reply dialog. The one thing that reads it is the HEARD BACK achievement,
// and it has to be stored because the question cannot be asked again: a reply is marked
// seen as it is dismissed and `my_feedback_replies` only ever returns unseen ones, so
// the server's answer to "did you get one" is no from the second launch onwards. See
// lib/feedback-answered.ts.
export const FEEDBACK_ANSWERED_KEY = 'nine.feedback-answered.v1'
// Whether this device has had its opening tutorial run — the welcome that a first launch
// drops straight into. The stored flag outlives that one run: it is also what keeps
// Trainee's invitation to a scored board coming back. See lib/welcome.ts.
export const WELCOME_KEY = 'nine.welcome.v1'
// Absent until the player picks a language in options; while it is absent the app is in
// English. The device's own language is never consulted — see hooks/use-locale.tsx.
export const LOCALE_KEY = 'nine.locale.v1'
// Whether the player has answered the session-recording ask — 'granted' or 'denied'.
// Absent means unanswered, not declined: recording stays off either way (PostHog's own
// default), and only an absent key brings the banner back. See hooks/use-replay-consent.ts.
export const REPLAY_CONSENT_KEY = 'nine.replay-consent.v1'

// Whether this player has been asked, once, to put an address on their profile. Set when
// the one-time card is answered *or* dismissed, because the question has been put either
// way and a card that comes back every launch is a card that gets dismissed faster.
//
// It gates the asking and nothing else. Whether an address is waiting to be confirmed is
// a fact about the account, read off the session — a player who skipped this card and
// added an address months later still gets told to confirm it.
export const EMAIL_PROMPT_KEY = 'nine.email-prompt.v1'
// Left behind when this device's session is refused rather than merely unreachable: the
// one thing that happens is somebody restoring this profile onto another phone, which
// takes it off this one. Read once by the intro and cleared as it is read, the way
// `consumeUpdateReload` handles its own note — a line explaining where the profile went
// is worth saying once and is a puzzle on the third launch.
export const PROFILE_MOVED_KEY = 'nine.moved.v1'

// When a verification code last went out from this device, as epoch milliseconds.
//
// On disk rather than in memory because of where the player goes next: reading the code
// means leaving for a mail app, and iOS ends a home-screen web app's process often enough
// that coming back is a cold boot about one time in three. A cooldown held in memory dies
// there, the resend button lights up early, and the server — which counts the same floor
// per user and is not reloading — refuses the press. See `RESEND_COOLDOWN_MS`.
export const EMAIL_SENT_KEY = 'nine.email-sent.v1'
// The address a code card is open on, or absent when none is. Written as the card goes up
// and cleared as it comes down, so the same trip to the mail app comes back to the six
// digits rather than to the intro.
//
// The address alone, with no branch beside it: which of the two things the card is doing
// is derivable — an address parked in `new_email` on the session is one being attached,
// and anything else is a restore — and a stored branch would be a second copy of that
// fact, free to disagree with the session.
export const EMAIL_CODE_KEY = 'nine.email-code.v1'

// Keys no build reads any more, cleared once on boot so the retired data does not sit on
// the device forever. Anything listed here is gone for good: the pending queue is on the
// list because an unpublished score from the old mechanics would otherwise publish itself
// onto the boards on the next reconnection.
export const RETIRED_KEYS = [
  'nine.stats.v3',
  'nine.tutorial.v1',
  'nine.pending-scores.v1',
  'nine.daily-bests.v1',
  // The day winnings were last *announced*, which is what the money used to hang on before
  // the watermark moved to the player's profile. Nothing reads it, and leaving it would be
  // a date on the device that looks like it still means something — see
  // `ASKED_WINNINGS_KEY`, which deliberately took a new string rather than this one.
  'nine.seen-winnings.v1',
]
