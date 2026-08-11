import { View } from 'react-native'

import { HitPraiseLine } from '@/components/game/hit-praise-line'
import { TraineeStat } from '@/components/game/trainee-stat'
import type { HitBatch } from '@/machines/game'

// No hit yet, so nothing to describe. A dash rather than 0%, which would read as
// a bad hit instead of no hit.
const EMPTY = '—'

const percent = (factor: number | null): string =>
  factor === null ? EMPTY : `${Math.round(factor * 100)}%`

// What a learner wants that a score cannot tell them: how many targets they have
// cleared, and how the press they just made actually went. Trainee only — the
// other modes give this space to the board bests.
// Takes the batch rather than two pre-picked numbers: choosing the hit is this
// component's business, and pulling it apart at the call site only spread the
// null-handling into a screen that already has plenty.
export function TraineeStats({
  hits,
  batch,
  praise,
}: {
  hits: number
  batch: HitBatch
  // What the current celebration is for, or null when none is running.
  praise: string | null
}) {
  // A batch holds every target one press cleared, and it is that press the player
  // is asking about — so the last one, not an average.
  const last = batch.hits[batch.hits.length - 1] ?? null

  return (
    <View className="mt-1">
      <View className="flex-row justify-center gap-6">
        <TraineeStat label="HITS" value={String(hits)} />
        <TraineeStat label="ACCURACY" value={percent(last?.accFactor ?? null)} />
        <TraineeStat label="SPEED" value={percent(last?.spdFactor ?? null)} />
      </View>
      <HitPraiseLine message={praise} />
    </View>
  )
}
