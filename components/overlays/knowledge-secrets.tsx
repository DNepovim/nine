import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import { AdminTable } from '@/components/overlays/admin-table'
import { KnowledgeNote } from '@/components/overlays/knowledge-note'
import { achievement, groupIds, type AchievementId } from '@/constants/achievements'
import { POOR_RUN_SCORE } from '@/lib/career'

// The exact condition each secret is unlocked on, as `lib/achievements.ts` checks it.
const CONDITION = {
  theLongWay: <Trans>≥ 30 presses on one target, any mode</Trans>,
  nightShift: <Trans>Run finished 02:00–03:59, phone clock</Trans>,
  gooseEgg: <Trans>Accuracy or Speed run finished with score 0</Trans>,
  inAndOut: <Trans>Any run finished in under 10 s</Trans>,
  roughPatch: (
    <Trans>5 finished Accuracy or Speed runs in a row, each under {POOR_RUN_SCORE}</Trans>
  ),
  scenicRoute: <Trans>Speed, ≥ 20 hits, average speed under 20% (mid-run)</Trans>,
  eternalStudent: <Trans>One Trainee run ≥ 30 min</Trans>,
  touchGrass: <Trans>One run ≥ 60 min, any mode</Trans>,
  roundNumber: <Trans>Finished, score &gt; 0 and divisible by 1 000</Trans>,
  palindrome: <Trans>Finished, score of 4+ digits that reads the same backwards</Trans>,
  nineNineNine: <Trans>Career hits ≥ 999</Trans>,
  goodSport: <Trans>≥ 5 runs with friends, 0 wins ever</Trans>,
  noJoke: <Trans>Run finished on 1 April, phone calendar</Trans>,
  heardBack: <Trans>An admin answered their feedback</Trans>,
} as const satisfies Partial<Record<AchievementId, ReactNode>>

export function KnowledgeSecrets() {
  const { t } = useLingui()
  return (
    <AdminTable
      className="mb-4"
      columns={[{ width: 24 }, { tone: 'name' }]}
      rows={groupIds('secret').map((id) => {
        const def = achievement(id)
        return {
          key: id,
          cells: [def.emblem, t(def.title)],
          note: (
            <KnowledgeNote>
              {id in CONDITION ? CONDITION[id as keyof typeof CONDITION] : t(def.hint)}
            </KnowledgeNote>
          ),
        }
      })}
    />
  )
}
