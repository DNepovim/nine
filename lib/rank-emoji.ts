import { isOneOf } from 'narrowland'

// The podium, shared by everything that ranks players so the three medals cannot
// drift apart between the board and the multiplayer results.
const MEDAL_RANKS = [1, 2, 3] as const
const MEDALS = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
} as const satisfies Record<(typeof MEDAL_RANKS)[number], string>

// The board shows five rows, so fourth and fifth are the last places on it rather
// than merely mid-table — they get a mark of their own instead of a bare number.
const BOARD_RANKS = [1, 2, 3, 4, 5] as const
const BOARD_EMOJI = {
  ...MEDALS,
  4: '🥔',
  5: '🐷',
} as const satisfies Record<(typeof BOARD_RANKS)[number], string>

// A medal for the podium, nothing below it. For places that rank a handful of
// players and have no fixed last place.
export const rankMedal = (rank: number): string | null =>
  isOneOf(rank, MEDAL_RANKS) ? MEDALS[rank] : null

// The board's full set. Null past fifth, where the player's own row can still appear
// below the cut and falls back to its number.
export const rankEmoji = (rank: number): string | null =>
  isOneOf(rank, BOARD_RANKS) ? BOARD_EMOJI[rank] : null
