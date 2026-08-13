import type { LeaderboardRow, MyRankRow } from '@/lib/leaderboard'

const LIMIT = 5

type Result = { rows: LeaderboardRow[]; myRank: MyRankRow }

// Folds the player's own best into a fetched board so a run that just finished shows
// immediately, without waiting for the submit to land or Realtime to catch up.
//
// Three sources can each hold the truth — the score just played, the rank the server
// reported, and the row already on the board — so the highest of them wins, carrying
// its own hit count. Crucially this also *upgrades* a row the player already occupies:
// bailing out whenever the server listed them is what made a new best invisible to
// anyone already on the board.
export function withMyBest(
  rows: LeaderboardRow[],
  myRank: MyRankRow | null,
  userId: string,
  nickname: string,
  score: number,
  hits: number,
  // When the score being folded in was set — the run that just ended, so the caller's
  // clock. Taken as an argument rather than read here so this stays pure.
  achievedAt: string,
): Result {
  const existing = rows.find((row) => row.user_id === userId)

  // Each candidate carries its own timestamp, so the row shows when the score that
  // actually won was set rather than always claiming it was just now. MyRankRow has no
  // timestamp of its own, so it borrows the caller's — it only wins when the server
  // knows a better score than both the run just played and the row on the board.
  const candidates = [
    ...(myRank === null
      ? []
      : [{ score: myRank.best_score, hits: myRank.hits, at: achievedAt }]),
    ...(existing === undefined
      ? []
      : [
          {
            score: existing.best_score,
            hits: existing.hits,
            at: existing.achieved_at,
          },
        ]),
  ]
  const winner = candidates.reduce(
    (best, next) => (next.score > best.score ? next : best),
    { score, hits, at: achievedAt },
  )

  const others = rows.filter((row) => row.user_id !== userId)
  // Ties go to the other player: an equal score already on the board keeps the
  // better rank.
  const above = others.filter((row) => row.best_score >= winner.score)
  const below = others.filter((row) => row.best_score < winner.score)

  const mine: LeaderboardRow = {
    rank: above.length + 1,
    user_id: userId,
    nickname,
    best_score: winner.score,
    hits: winner.hits,
    achieved_at: winner.at,
  }

  const merged = [...above, mine, ...below]
    .slice(0, LIMIT)
    .map((row, i) => ({ ...row, rank: i + 1 }))

  // Only the fetched top rows are known here, so this rank is a lower bound — the
  // same limitation the server-reported rank had before any of this.
  const rank = above.length + 1

  return {
    rows: merged,
    myRank: {
      rank,
      total: Math.max(myRank?.total ?? 0, rank),
      best_score: winner.score,
      hits: winner.hits,
    },
  }
}
