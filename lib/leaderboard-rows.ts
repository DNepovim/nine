import type { LeaderboardRow } from '@/lib/leaderboard'

export type DisplayRow = {
  key: string
  rank: number
  nickname: string
  score: number
  isUser: boolean
  unpublished: boolean
  // When the record was set, or null for the local row — a score that has not reached
  // the board has no board timestamp, and the row says it is unpublished instead.
  achievedAt: string | null
}

const LIMIT = 5

// Merges the player's unpublished local best into the server rows, ranked by score
// like any other entry. Ties go to the server row: a published score of the same
// value was really earned on the board, so it keeps the better rank.
export function displayRows(
  rows: LeaderboardRow[],
  userId: string | null,
  unpublished: { score: number; label: string } | null,
): DisplayRow[] {
  const server: DisplayRow[] = rows.map((row) => ({
    key: row.user_id,
    rank: 0,
    nickname: row.nickname,
    score: row.best_score,
    isUser: row.user_id === userId,
    unpublished: false,
    achievedAt: row.achieved_at,
  }))

  if (unpublished === null) {
    return server.slice(0, LIMIT).map((row, i) => ({ ...row, rank: i + 1 }))
  }

  const above = server.filter((row) => row.score >= unpublished.score)
  const below = server.filter((row) => row.score < unpublished.score)
  const local: DisplayRow = {
    key: 'unpublished',
    rank: 0,
    nickname: unpublished.label,
    score: unpublished.score,
    isUser: true,
    unpublished: true,
    achievedAt: null,
  }

  return [...above, local, ...below]
    .slice(0, LIMIT)
    .map((row, i) => ({ ...row, rank: i + 1 }))
}
