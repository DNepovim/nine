import { isNonEmptyArray, isOneOf } from 'narrowland'

import { isKnownAchievement } from '@/lib/achievement-store'
import type { AchievementStore, EarnedAchievement } from '@/lib/achievement-store'
import type { Stage } from '@/lib/achievements'
import { captureError } from '@/lib/analytics'
import { isNetworkFailure, noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/machines/modes'

// Every stage this build can name — both axes. A row naming one it cannot place is
// dropped rather than guessed at; see `toStage`.
const ALL_STAGES = [...DIFFICULTY_ORDER, ...SCORED_MODES] as const

// The server's copy of what the player has earned.
//
// The device's copy is what the app shows — the strip, the list and every count read it,
// and an unlock never waits on a round trip. This is the backup that outlives a reinstall
// or a move to a second device, which is the one thing AsyncStorage cannot survive.
//
// Split from the store itself the way `score-submission.ts` is split from
// `local-scores.ts`: the merge rules are pure and testable, and this half is the network.

type AchievementRow = {
  achievement_id: string
  // The board, or '' for an unstaged achievement. Empty rather than null because the
  // column is half the primary key — see the migration. A row naming a stage this build
  // does not know is dropped for the same reason an unknown id is.
  stage: string
  earned_at: string
}

// The server's empty string is the client's null: one identity, two spellings, mapped
// here so nothing above this file has to know the column exists.
const toStage = (value: string): Stage | null | undefined =>
  value === '' ? null : isOneOf(value, ALL_STAGES) ? value : undefined

// Everything the server holds for this player. Null — not an empty store — when the ask
// itself failed, so a flaky read is never mistaken for a player who has earned nothing.
export async function fetchAchievements(
  userId: string,
): Promise<AchievementStore | null> {
  const { data, error } = await supabase
    .from('achievements')
    .select('achievement_id, stage, earned_at')
    .eq('user_id', userId)
  noteRequest(error)
  if (error !== null) return null
  return ((data as AchievementRow[] | null) ?? []).flatMap((row) => {
    const stage = toStage(row.stage)
    return isKnownAchievement(row.achievement_id) && stage !== undefined
      ? [{ id: row.achievement_id, stage, earnedAt: row.earned_at, synced: true }]
      : []
  })
}

// Pushes everything the server has not been told about, in one write.
//
// `ignoreDuplicates` is what makes this safe to repeat: the table has no update and no
// delete, so re-sending a row the server already has is a no-op rather than a rewrite of
// when it was earned. That is also what lets an offline device replay its whole queue
// without having to work out what landed.
export async function pushAchievements(
  userId: string,
  entries: readonly EarnedAchievement[],
): Promise<boolean> {
  if (!isNonEmptyArray(entries)) return true
  const { error } = await supabase.from('achievements').upsert(
    entries.map((entry) => ({
      user_id: userId,
      achievement_id: entry.id,
      stage: entry.stage ?? '',
      earned_at: entry.earnedAt,
    })),
    { onConflict: 'user_id,achievement_id,stage', ignoreDuplicates: true },
  )
  noteRequest(error)
  if (error === null) return true
  if (isNetworkFailure(error.message)) return false
  // Not the connection: the server refused a row it should have taken. Invisible to the
  // player, so it is exactly what error logging is for.
  captureError(new Error(`achievements refused: ${error.message}`), {
    ids: entries.map((entry) => entry.id).join(','),
  })
  return false
}
