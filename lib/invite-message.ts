import type { Mode } from '@/machines/modes'

export const SHARE_URL = 'https://nine.expo.app'

// The labels are the UI's wide caps; an invite lands in someone else's chat thread,
// where shouting reads as an advert rather than a friend.
export const titleCase = (label: string): string =>
  `${label.slice(0, 1)}${label.slice(1).toLowerCase()}`

// Whether the invite has a score worth naming.
//
// A best worth naming turns the invite into a dare, which travels further than a link
// does. Trainee keeps no board, and a board you have never scored on has nothing to
// boast about — both fall back to describing the game rather than the player, so the
// message never brags about a zero.
export const shouldBoast = (mode: Mode, bestScore: number): boolean =>
  mode !== 'trainee' && bestScore > 0

// The board an invite names, from labels the caller has already resolved. Taking the
// words rather than the keys is what keeps this pure: the sentence around it is
// translated where the locale lives, and this stays a thing a test can pin.
export const boardName = (modeLabel: string, difficultyLabel: string): string =>
  `${titleCase(modeLabel)}, ${titleCase(difficultyLabel)}`
