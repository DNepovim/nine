// The How to Play guide's sections: what each is called and wears, the order they run in,
// and which of them a reader is offered.

import type { Ionicons } from '@expo/vector-icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { ACHIEVEMENT_SCALE, GAME_SCALE } from '@/constants/colors'

export type IoniconName = keyof typeof Ionicons.glyphMap

// The guide's sections, in the order they appear. One table drives both the contents
// list at the top and the headers down the page, so a section can never be listed and
// missing — or present and unlisted. Colours step along the game scale.
export const SECTIONS = {
  goal: { icon: 'flag', title: msg`THE GOAL`, color: GAME_SCALE[0] },
  controls: { icon: 'hand-left', title: msg`CONTROLS`, color: GAME_SCALE[1] },
  targets: { icon: 'timer', title: msg`TARGETS & THE CLOCK`, color: GAME_SCALE[1] },
  modes: { icon: 'grid', title: msg`MODES`, color: GAME_SCALE[2] },
  champions: { icon: 'ribbon', title: msg`CHAMPIONS`, color: GAME_SCALE[2] },
  // The one section that steps off the game scale, because achievements are the one
  // reward that is not a place on a board — the green says so before the words do.
  achievements: { icon: 'trophy', title: msg`ACHIEVEMENTS`, color: ACHIEVEMENT_SCALE[3] },
  // Arcade's own amber, which is the last stop of the scale and the one the pill, the
  // hero and the lit way are all drawn in. Behind the `arcade` flag, like the chapter.
  arcade: { icon: 'git-network', title: msg`ADVENTURE`, color: GAME_SCALE[4] },
  // A challenge borrows the scale's third stop rather than its own colour, which it does
  // now have — a near-black paired with a hue off the violet arc, see
  // `modes/challenges/palette.ts`. That pair cannot do this job: the near-black is the
  // colour text is drawn in, so a chapter accented with it would read as no accent at
  // all, and the hue belongs to whichever challenge is on today rather than to the
  // chapter that explains all of them. This list is the app speaking, like the scale.
  challenges: { icon: 'flame', title: msg`CHALLENGES`, color: GAME_SCALE[3] },
  multiplayer: { icon: 'people', title: msg`MULTIPLAYER`, color: GAME_SCALE[3] },
  tips: { icon: 'bulb', title: msg`TIPS & TRICKS`, color: GAME_SCALE[4] },
} as const satisfies Record<
  string,
  { icon: IoniconName; title: MessageDescriptor; color: string }
>

export type SectionKey = keyof typeof SECTIONS

const ALL_SECTIONS = [
  'goal',
  'controls',
  'targets',
  'modes',
  'challenges',
  'arcade',
  'champions',
  'achievements',
  'multiplayer',
  'tips',
] as const satisfies readonly SectionKey[]

// What the guide actually offers. Multiplayer and arcade each leave with the door that
// leads to them — a chapter telling a player to pick something the intro does not show is
// the guide being wrong, which is worse than the guide being short. Filtered in one place
// so the contents list and the page below it cannot disagree about what is here.
//
// A function rather than the constant it used to be: what the guide offers now depends on
// the reader's role, which is not known when this module is loaded.
export function sectionOrder(
  showMultiplayer: boolean,
  showArcade: boolean,
  showChallenges: boolean,
): readonly SectionKey[] {
  return ALL_SECTIONS.filter((key) => {
    if (key === 'multiplayer') return showMultiplayer
    if (key === 'arcade') return showArcade
    if (key === 'challenges') return showChallenges
    return true
  })
}
