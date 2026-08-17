import type { Period } from '@/lib/announcements'
import type { RecordScreen } from '@/lib/champions'
import { earnedChallenge } from '@/lib/next-challenge'
import type { Difficulty, ScoredMode } from '@/machines/modes'

// The wordmark over the game-over screen, as two four-letter words. Four and four is
// not a style choice: the title animates as two rows of four letters, and both the
// overlay's copy and the one the dying sequence flies up index their letters by that
// shape (see game-over-title.tsx).
export type TitleWords = readonly [string, string]

// "GAME OVER" told the player the one thing they already knew, in the most final way
// available. These say what the run was worth instead, and every tier is decided from
// what the app already knows the instant the last life goes — records crossed during
// the run, the hits and streaks behind them. Nothing waits on the server, so the
// letters that fly up from the board are the right ones from the first frame.
// What kind of run it was. The tier is decided first, then a line is drawn from that
// tier's pool, the same shape the announcement bar uses — one meaning, several ways of
// saying it, so a player who dies twice in a row is not read the same words twice.
type Tier =
  | 'crown'
  | 'owl'
  | 'eagle'
  | 'allTime'
  | 'board'
  | 'personal'
  | 'cold'
  | 'strong'
  | 'played'

// Three per tier. The cold pool is deliberately the gentlest of the five: it is the
// only one that comments on a run going badly, and it says the run was cold rather
// than the player.
const TITLES = {
  // Holding both Extreme all-time boards at once — the rarest thing in the game.
  crown: [
    ['BEST', 'EVER'],
    ['KING', 'NINE'],
    ['PEAK', 'FORM'],
  ],
  // One mode's Extreme all-time board. Each reads as what its mode asks for: Accuracy
  // is an eye, Speed is a dive.
  owl: [
    ['TRUE', 'SHOT'],
    ['WISE', 'EYES'],
    ['DEAD', 'EYES'],
  ],
  eagle: [
    ['FAST', 'WING'],
    ['HIGH', 'GEAR'],
    ['FREE', 'FALL'],
  ],
  // Any other all-time record: a real one, but not a reign.
  allTime: [
    ['BEST', 'EVER'],
    ['KING', 'NINE'],
    ['PEAK', 'FORM'],
  ],
  board: [
    ['PURE', 'GOLD'],
    ['TOOK', 'GOLD'],
    ['GOLD', 'RUSH'],
  ],
  personal: [
    ['YOUR', 'BEST'],
    ['HIGH', 'MARK'],
    ['PAST', 'SELF'],
  ],
  cold: [
    ['COLD', 'DIAL'],
    ['NEXT', 'TIME'],
    ['HARD', 'LUCK'],
  ],
  strong: [
    ['WELL', 'DONE'],
    ['NICE', 'WORK'],
    ['SURE', 'HAND'],
  ],
  played: [
    ['GOOD', 'GAME'],
    ['NINE', 'DOWN'],
    ['FAIR', 'GAME'],
  ],
} as const satisfies Record<Tier, readonly [TitleWords, ...TitleWords[]]>

// Under this, the run never got going. A hit is worth at most SCORE_BASE (100) and an
// ordinary one lands nearer 50, so these are roughly three hits on Easy and two on
// Extreme — deliberately low, because this title should describe a run that ended
// before it began, not a modest one.
//
// The bar falls as the difficulty rises: the same play yields fewer hits when the
// clock is tighter (Extreme runs at 0.55 of the base timeout and carries a fourth
// target), so holding one number across all three would call an ordinary Extreme run
// cold while letting a genuinely dead Easy run pass.
const COLD_BELOW = {
  easy: 150,
  hard: 120,
  extreme: 90,
} as const satisfies Record<Difficulty, number>

// Read top down and stop at the first that holds — a run that took a board record
// almost always beat the player's own best too, and the bigger claim is the one worth
// putting on screen.
const tierFor = ({
  screen,
  mode,
  medals,
  personalBest,
  difficulty,
  score,
  hits,
  strikes,
}: {
  // How loudly the screen is celebrating — the crown and the birds are its two loudest
  // settings, and each has words of its own.
  screen: RecordScreen
  mode: ScoredMode
  // Board records this run took, any period. Already computed for the medal row.
  medals: readonly Period[]
  // Whether the run beat the player's own stored best on this board.
  personalBest: boolean
  difficulty: Difficulty
  score: number
  hits: number
  strikes: number
}): Tier => {
  // A reign outranks everything, and each mode's is its own claim.
  if (screen === 'crown') return 'crown'
  if (screen === 'bird') return mode === 'accuracy' ? 'owl' : 'eagle'
  // Both record tiers outrank the cold one on purpose. A first score on an empty
  // board can take it while barely scoring at all, and being told the run was cold in
  // the same breath as taking a record would read as the game arguing with itself.
  if (medals.includes('ever')) return 'allTime'
  if (medals.length > 0) return 'board'
  if (personalBest) return 'personal'
  if (score < COLD_BELOW[difficulty]) return 'cold'
  // The same bar the challenge button uses: a run with real streaks in it went well
  // even when it set no record, and the two should never disagree about that.
  if (earnedChallenge(hits, strikes)) return 'strong'
  return 'played'
}

// The title for a finished run. `roll` is a number in [0, 1) picked at the call site,
// exactly as the announcement bar does it: the choice stays pure and testable, and the
// randomness lives where the run ends rather than inside this function.
export function gameOverTitle(
  run: Parameters<typeof tierFor>[0],
  roll: number,
): TitleWords {
  const pool = TITLES[tierFor(run)]
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index] ?? pool[0]
}
