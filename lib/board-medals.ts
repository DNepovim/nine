import { PERIODS, type Period } from '@/lib/announcements'
import { medalRank } from '@/lib/medals'

// A place the run earned on one period of a board.
export type BoardMedal = { period: Period; rank: 1 | 2 | 3 }

// One row of a board, as the medal count sees it.
export type BoardRow = { score: number; isMine: boolean }

// The medal this run puts on the board, or null for none.
//
// Two things have to be true at once, and they are the whole rule: the run has to be
// what the player now shows on that board, and that row has to land on the podium. A
// medal the player keeps but the run did not earn is not this run's, and a place the
// run would have taken but does not hold is not on the board to see.
//
// So a 4000 behind one's own 5000 is nothing: the board still shows the 5000 and the
// gold that comes with it, and the run changed neither. Rows below the player's own are
// counted out for the same reason — beating a score you already beat wins nothing twice.
//
// `rows` is the board's top five, which is all a podium needs: anything past third is no
// medal either way.
export function runMedal(score: number, rows: readonly BoardRow[]): 1 | 2 | 3 | null {
  // An older, better run of the player's own is what the board is showing.
  if (rows.some((row) => row.isMine && row.score > score)) return null
  const ahead = rows.filter((row) => !row.isMine && row.score > score).length
  return medalRank(ahead + 1, score)
}

// What the run is worth across the three periods of one board, with the periods that
// say nothing new dropped.
//
// A place on a longer board implies the same place on every shorter one: leading all
// time means leading the week and the day too, because the score doing the leading sits
// on those boards as well. So gold, gold, gold is one fact told three times, and only
// EVER is worth the room.
//
// Different metals are different facts and all survive: first today but third all time
// says both that the day is yours and that the game is not, which is two things a player
// wants to know. PERIODS is ordered longest first, so each medal is only ever compared
// with the longer one that would imply it.
export function boardMedals(ranks: Record<Period, 1 | 2 | 3 | null>): BoardMedal[] {
  const kept: BoardMedal[] = []
  for (const period of PERIODS) {
    const rank = ranks[period]
    if (rank === null) continue
    // Only against the last kept: rank can only improve as the window shortens, so a
    // medal that matches any longer period matches the nearest one.
    if (kept.at(-1)?.rank === rank) continue
    kept.push({ period, rank })
  }
  return kept
}
