import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  ACHIEVEMENTS_KEY,
  ARCADE_FOCUS_KEY,
  ARCADE_ROSE_KEY,
  ASKED_WINNINGS_KEY,
  CAREER_KEY,
  DIFFICULTY_KEY,
  EMAIL_CODE_KEY,
  EMAIL_PROMPT_KEY,
  EMAIL_SENT_KEY,
  FEEDBACK_ANSWERED_KEY,
  HOW_TO_PLAY_KEY,
  LOCAL_SCORES_KEY,
  LOCALE_KEY,
  MEDAL_HISTORY_KEY,
  MODE_KEY,
  OPTIONS_KEY,
  PROFILE_MOVED_KEY,
  REPLAY_CONSENT_KEY,
  RUN_KEY,
  RUN_TOTALS_KEY,
  SEEN_NEWS_KEY,
  SEEN_RECAP_KEY,
  SEEN_STANDINGS_KEY,
  STATS_KEY,
  WELCOME_KEY,
} from '@/constants/storage'

// What a restore takes off the device, and what it leaves alone.
//
// Everything in AsyncStorage was written by whoever was signed in at the time, and a
// restore replaces that person. Left where it is, the previous player's history does not
// merely show — it *spreads*: the achievement sync pushes their unlocks up under the
// restored player's id, the local board draws their bests beside the restored ones, and
// the lifetime counters add the two careers together.
//
// Both lists are spelled out rather than derived, and that is the point of the test beside
// this file: every key `constants/storage.ts` exports has to appear in exactly one of
// them, so the next key anybody adds fails the suite until somebody has decided which it
// is. A rule like "anything with `seen` in it stays" would have answered that question
// silently, and wrongly, on about half of these.
//
// The line between them is one question: **does this belong to the player, or to the
// phone?** A record of play is the player's and goes. A preference somebody set, a
// consent they gave, a thing this device has already shown — those are the phone's, and a
// player restoring their profile has not asked to be shown the opening tutorial again or
// to pick their language twice.

export const RESET_KEYS = [
  // Records of play, all of them the previous player's.
  STATS_KEY,
  CAREER_KEY,
  ACHIEVEMENTS_KEY,
  LOCAL_SCORES_KEY,
  RUN_TOTALS_KEY,
  SEEN_STANDINGS_KEY,
  MEDAL_HISTORY_KEY,
  ASKED_WINNINGS_KEY,
  // A run left in progress. It belonged to the player walking away, and resuming it under
  // a new name would file its score on the wrong profile.
  RUN_KEY,
  // Read by the GRADUATE achievement, which is why it is here rather than with the
  // preferences: it is a claim about what somebody did, and achievements are per player.
  HOW_TO_PLAY_KEY,
  // Likewise — HEARD BACK reads it, and the reply it remembers was to somebody else.
  FEEDBACK_ANSWERED_KEY,
  // Whether *this player* has been asked for an address. The restored one plainly has
  // one, so the ask will not fire either way; clearing it keeps the key meaning what it
  // says rather than meaning it about the wrong person.
  EMAIL_PROMPT_KEY,
  // The note that a profile was taken off this device. A profile has just arrived on it.
  PROFILE_MOVED_KEY,
  // A code card left open, which is the restore's own card and is finished with. Same
  // reasoning as the run above: it belonged to the moment the player walked away from,
  // and reopening it after the boot would ask for a code against a flow that has landed.
  EMAIL_CODE_KEY,
] as const

export const KEPT_KEYS = [
  // Preferences, which belong to whoever is holding the phone.
  DIFFICULTY_KEY,
  MODE_KEY,
  OPTIONS_KEY,
  ARCADE_FOCUS_KEY,
  ARCADE_ROSE_KEY,
  LOCALE_KEY,
  REPLAY_CONSENT_KEY,
  // Things this device has already shown. Clearing these would make a restore replay the
  // release notes and last week's recap at somebody who has read both.
  SEEN_NEWS_KEY,
  SEEN_RECAP_KEY,
  // The one that would be actively harmful to clear: without it the next launch drops
  // into the opening tutorial, which is not what a player who just got their career back
  // is asking for.
  WELCOME_KEY,
  // The odd one out, and the only key here that is about neither a preference nor a thing
  // shown: when this device last sent a code. It stays because the floor it mirrors is the
  // server's, and the server has not forgotten — the restore that just landed was itself
  // the most recent send, and clearing this would light the resend button up against a
  // wall that is still standing.
  EMAIL_SENT_KEY,
] as const

// Clears the previous player's half. Called only after a restore has actually landed —
// see `restoreProfile` in hooks/use-supabase-auth.ts, where the ordering is the thing that
// matters: a failed verification must leave the device exactly as it was.
//
// Supabase's own session key is not on either list and must never be: it is where the
// restored session has just been written.
export async function resetLocalPlayer(): Promise<void> {
  await AsyncStorage.multiRemove([...RESET_KEYS])
}
