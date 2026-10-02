import type { AchievementId } from '@/constants/achievements'
import type { Stage } from '@/lib/achievements'
import type { Period } from '@/lib/announcements'
import { type Difficulty, type ModeId } from '@/modes'
import type { InstallTarget } from '@/types/install'

// Every event the app sends, with the shape it sends. One table, so an event cannot be
// added in a component with a name that nearly matches one already in the warehouse —
// `run_finished` and `runFinished` are two funnels that each look broken.
//
// Deliberately short. Each of these is something a decision could hang on; a dial press
// is not, and it is also the highest-volume thing in the app, so the aggregate it
// produces — hits, accuracy — rides on `run_finished` instead.
export type AnalyticsEvents = {
  run_started: {
    mode: ModeId
    difficulty: Difficulty
    // What put the player into this run, which is the whole question behind the
    // challenge button: did they choose the board or accept the one offered? 'welcome' is
    // the one nobody chose — the tutorial a first launch opens into by itself — and
    // 'guide' is that same tutorial asked for, from TRY IT at the end of How to Play.
    // 'dev' is the one other than a player's own choice: a challenge started from the dev
    // screen rather than offered or picked on the intro.
    from: 'menu' | 'play_again' | 'challenge' | 'restart' | 'welcome' | 'guide' | 'dev'
  }
  run_finished: {
    mode: ModeId
    difficulty: Difficulty
    score: number
    hits: number
    strikes: number
    // Board records the run took, biggest first, and the celebration it earned.
    records: readonly Period[]
    screen: 'crown' | 'bird' | 'wash' | 'plain'
    personal_best: boolean
  }
  challenge_offered: {
    mode: ModeId
    difficulty: Difficulty
    to_mode: ModeId
    to: Difficulty
  }
  challenge_accepted: {
    mode: ModeId
    difficulty: Difficulty
    to_mode: ModeId
    to: Difficulty
  }
  screen_opened: {
    screen:
      | 'how_to_play'
      | 'options'
      | 'news'
      | 'feedback'
      | 'join_room'
      | 'achievements'
      | 'medals'
      | 'dev'
      | 'admin'
  }
  multiplayer_room: { action: 'created' | 'joined' | 'finished'; players: number }
  // The way, which runs on its own engine and so has no mode or difficulty to carry —
  // every other field in `run_started`/`run_finished` describes a board this has none of.
  arcade_run_started: Record<string, never>
  arcade_run_finished: {
    // The deepest crossroad reached — what the end-of-run screen shows as the score.
    depth: number
    strikes: number
    playedMs: number
  }
  // `stage` is null for an achievement with none — see `Award` in lib/achievements.ts.
  achievement_unlocked: { id: AchievementId; stage: Stage | null }
  // The home-screen install funnel. 'installed' fires on the browser's own confirmation
  // (the `appinstalled` event), not on the button tap that only opens the native dialog —
  // that tap is 'accepted', and the dialog can still be dismissed from there.
  install_prompt: {
    action: 'shown' | 'accepted' | 'dismissed' | 'installed'
    target: InstallTarget
  }
}

export type AnalyticsEvent = keyof AnalyticsEvents

// The build the event came from, so a regression can be pinned to a release. Set by the
// web build script; unknown in development, which is itself worth seeing in the data.
export const BUILD_ID = process.env.EXPO_PUBLIC_BUILD_ID ?? 'dev'
