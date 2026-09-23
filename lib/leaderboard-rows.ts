import type { LeaderboardRow } from '@/lib/leaderboard'

export type DisplayRow = {
  key: string
  rank: number
  // Whose row it is. Null only for the local unpublished row on a device with no user
  // yet — every server row has one, and it is what a champion's mark is matched on.
  userId: string | null
  nickname: string
  score: number
  isUser: boolean
  unpublished: boolean
  // When the record was set, or null for the local row — a score that has not reached
  // the board has no board timestamp, and the row says it is unpublished instead.
  achievedAt: string | null
  // What the nickname is coloured by. Null where the server has counted nothing for
  // this player — see lib/name-gradient.ts.
  avgAccuracy: number | null
  avgSpeed: number | null
}

const LIMIT = 5

// Merges the player's unpublished local best into the server rows, ranked by score
// like any other entry. Ties go to the server row: a published score of the same
// value was really earned on the board, so it keeps the better rank.
export function displayRows(
  rows: LeaderboardRow[],
  userId: string | null,
  unpublished: { score: number; label: string } | null,
  // How many rows the surface has room for. The game-over screen shows a short board:
  // the player's own score is already the headline above it, so the rest is context
  // rather than a table to read.
  limit: number = LIMIT,
): DisplayRow[] {
  const server: DisplayRow[] = rows.map((row) => ({
    key: row.user_id,
    rank: 0,
    userId: row.user_id,
    nickname: row.nickname,
    score: row.best_score,
    isUser: row.user_id === userId,
    unpublished: false,
    achievedAt: row.achieved_at,
    avgAccuracy: row.avg_acc,
    avgSpeed: row.avg_spd,
  }))

  if (unpublished === null) {
    return server.slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }))
  }

  const above = server.filter((row) => row.score >= unpublished.score)
  const below = server.filter((row) => row.score < unpublished.score)
  // Coloured from the player's own published row where they have one, so their name is
  // the same colour on both of the rows that are theirs. This board is the only place a
  // player can appear twice, and two different-coloured copies of one name would read as
  // two players. Null where they are not on the board at all — a device with no user, or
  // no nickname yet — which is the honest answer rather than a borrowed one.
  const mine = server.find((row) => row.isUser)
  const local: DisplayRow = {
    key: 'unpublished',
    rank: 0,
    userId,
    nickname: unpublished.label,
    score: unpublished.score,
    isUser: true,
    unpublished: true,
    achievedAt: null,
    avgAccuracy: mine?.avgAccuracy ?? null,
    avgSpeed: mine?.avgSpeed ?? null,
  }

  return [...above, local, ...below]
    .slice(0, limit)
    .map((row, i) => ({ ...row, rank: i + 1 }))
}
