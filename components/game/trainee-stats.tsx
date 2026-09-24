import { Trans } from '@lingui/react/macro'
import { View } from 'react-native'

import { HitPraiseLine } from '@/components/game/hit-praise-line'
import { RouteHint } from '@/components/game/route-hint'
import { TraineeStat } from '@/components/game/trainee-stat'
import type { HitBatch } from '@/machines/game'
import type { RouteStep } from '@/machines/scoring'

// No hit yet, so nothing to describe. A dash rather than 0%, which would read as
// a bad hit instead of no hit.
const EMPTY = '—'

const percent = (factor: number | null): string =>
  factor === null ? EMPTY : `${Math.round(factor * 100)}%`

// What a learner wants that a score cannot tell them: how many targets they have
// cleared, and how the press they just made actually went. Trainee only — the
// other modes give this space to the board bests.
// Both numbers and route start hidden and are switched on from the pause screen, so the
// block is usually the coach's line alone. Whatever is off costs no height either: the
// spawn canvas below is measured from what is left, so the targets take the room back.
// Takes the batch rather than two pre-picked numbers: choosing the hit is this
// component's business, and pulling it apart at the call site only spread the
// null-handling into a screen that already has plenty.
export function TraineeStats({
  hits,
  batch,
  praise,
  showStats,
  showRoute,
  route,
  routeStart,
  routeTarget,
}: {
  hits: number
  batch: HitBatch
  // What the current celebration is for, or null when none is running.
  praise: string | null
  // What the player has turned on from the pause screen. The coach's line answers to
  // neither: it is the one thing here that says something a player could not have read
  // off the board themselves, so it is what Trainee keeps when everything else is off.
  showStats: boolean
  showRoute: boolean
  // The optimal way to the target the line above is about. Empty for every line that
  // is not a debrief, and for a debrief the coach could not solve.
  route: readonly RouteStep[]
  // The sum the route starts from, shown to its left.
  routeStart: number | null
  // The sum the route reaches, shown to its right — the target itself is gone from the
  // board by then.
  routeTarget: number | null
}) {
  // A batch holds every target one press cleared, and it is that press the player
  // is asking about — so the last one, not an average.
  const last = batch.hits[batch.hits.length - 1] ?? null

  return (
    <View className="mt-1">
      {/* The same gap the route hint keeps below the line, so the three rows sit at
          an even rhythm rather than the words crowding the stats they follow. */}
      {showStats && (
        <View className="mb-1.5 flex-row justify-center gap-6">
          <TraineeStat label={<Trans>HITS</Trans>} value={String(hits)} />
          <TraineeStat
            label={<Trans>ACCURACY</Trans>}
            value={percent(last?.accFactor ?? null)}
          />
          <TraineeStat
            label={<Trans>SPEED</Trans>}
            value={percent(last?.spdFactor ?? null)}
          />
        </View>
      )}
      <HitPraiseLine message={praise} />
      {/* Under the words, as the way to reach what they just described. */}
      {showRoute && <RouteHint route={route} start={routeStart} target={routeTarget} />}
    </View>
  )
}
