import type { Period } from '@/lib/announcements'
import type { Difficulty, Mode } from '@/machines/modes'

// Every event the app sends, with the shape it sends. One table, so an event cannot be
// added in a component with a name that nearly matches one already in the warehouse —
// `run_finished` and `runFinished` are two funnels that each look broken.
//
// Deliberately short. Each of these is something a decision could hang on; a dial press
// is not, and it is also the highest-volume thing in the app, so the aggregate it
// produces — hits, accuracy — rides on `run_finished` instead.
export type AnalyticsEvents = {
  run_started: {
    mode: Mode
    difficulty: Difficulty
    // What put the player into this run, which is the whole question behind the
    // challenge button: did they choose the board or accept the one offered?
    from: 'menu' | 'play_again' | 'challenge' | 'restart'
  }
  run_finished: {
    mode: Mode
    difficulty: Difficulty
    score: number
    hits: number
    strikes: number
    // Board records the run took, biggest first, and the celebration it earned.
    records: readonly Period[]
    screen: 'crown' | 'bird' | 'wash' | 'plain'
    personal_best: boolean
  }
  challenge_offered: { mode: Mode; difficulty: Difficulty; to_mode: Mode; to: Difficulty }
  challenge_accepted: {
    mode: Mode
    difficulty: Difficulty
    to_mode: Mode
    to: Difficulty
  }
  screen_opened: { screen: 'how_to_play' | 'options' | 'news' | 'feedback' }
  multiplayer_room: { action: 'created' | 'joined' | 'finished'; players: number }
  feedback_submitted: {
    message: string
    // What the player was looking at when they wrote it. A message without this is a
    // sentence with no subject.
    mode: Mode
    difficulty: Difficulty
    score: number
    build: string
  }
}

export type AnalyticsEvent = keyof AnalyticsEvents

// The build the event came from, so a regression can be pinned to a release. Set by the
// web build script; unknown in development, which is itself worth seeing in the data.
export const BUILD_ID = process.env.EXPO_PUBLIC_BUILD_ID ?? 'dev'
