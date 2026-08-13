import { DIFFICULTIES, MODES, type Difficulty, type Mode } from '@/machines/modes'

export const SHARE_URL = 'https://nine.expo.app'

// The labels are the UI's wide caps; an invite lands in someone else's chat thread,
// where shouting reads as an advert rather than a friend.
const titleCase = (label: string): string =>
  `${label.slice(0, 1)}${label.slice(1).toLowerCase()}`

// What the SHARE button sends.
//
// A best worth naming turns the invite into a dare, which travels further than a link
// does. Trainee keeps no board, and a board you have never scored on has nothing to
// boast about — both fall back to describing the game rather than the player, so the
// message never brags about a zero.
export function inviteMessage(
  mode: Mode,
  difficulty: Difficulty,
  bestScore: number,
): string {
  if (mode === 'trainee' || bestScore <= 0) {
    return 'Nine buttons, one number to hit. Come take a run at it.'
  }
  const board = `${titleCase(MODES[mode].label)}, ${titleCase(DIFFICULTIES[difficulty].label)}`
  return `My best at Nine is ${bestScore} — ${board}. Think you can beat it?`
}
