import { Trans, useLingui } from '@lingui/react/macro'
import { Text } from 'react-native'

import { AdminTable } from '@/components/overlays/admin-table'
import { KnowledgeFormula } from '@/components/overlays/knowledge-formula'
import { KnowledgeNote } from '@/components/overlays/knowledge-note'
import { KnowledgeSection } from '@/components/overlays/knowledge-section'
import { TYPE } from '@/constants/typography'
import { useBoardLabel } from '@/hooks/use-board-label'
import { list, percent, seconds } from '@/lib/admin/knowledge-figures'
import { cn } from '@/lib/cn'
import { FAST_BAND, speedReward } from '@/machines/scoring'
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  FAST_HIT_THRESHOLD,
  RAMP_FLOOR_RATIO,
  RAMP_HALF_LIFE_HITS,
  rampedTimeout,
  runRules,
  SCORED_MODES,
  spawnInterval,
  streakMultiplier,
} from '@/modes'

// The hit counts the clock tables are read at: one and two half-lives in.
const HALF_LIVES = [RAMP_HALF_LIFE_HITS, RAMP_HALF_LIFE_HITS * 2] as const

// Past every hit a run will ever land: the ramp at its floor.
const FOREVER = Number.POSITIVE_INFINITY

export function KnowledgeMechanics() {
  const { t } = useLingui()
  const boardLabel = useBoardLabel()

  const boards = SCORED_MODES.flatMap((mode) =>
    DIFFICULTY_ORDER.map((difficulty) => ({
      mode,
      difficulty,
      rules: runRules(mode, difficulty),
    })),
  )

  const clockColumns = [
    { label: t`BOARD`, tone: 'name' as const },
    { label: t`START`, width: 50, align: 'right' as const, tone: 'figure' as const },
    ...HALF_LIVES.map((hits) => ({
      label: t`${hits} HITS`,
      width: 56,
      align: 'right' as const,
      tone: 'figure' as const,
    })),
    { label: t`FLOOR`, width: 50, align: 'right' as const, tone: 'figure' as const },
  ]

  const rampRows = (
    read: (rules: (typeof boards)[number]['rules'], hits: number) => number,
  ) =>
    boards.map(({ mode, difficulty, rules }) => ({
      key: `${mode}-${difficulty}`,
      cells: [
        boardLabel(mode, difficulty),
        seconds(read(rules, 0)),
        ...HALF_LIVES.map((hits) => seconds(read(rules, hits))),
        seconds(read(rules, FOREVER)),
      ],
    }))

  // The blend is the mode's own and no rung changes it, so it is read at Hard.
  const [accuracy, speed] = SCORED_MODES.map(
    (mode) => runRules(mode, 'hard').scoring.weights,
  )
  const accBlend = `${percent(accuracy?.acc ?? 0)} / ${percent(accuracy?.spd ?? 0)}`
  const spdBlend = `${percent(speed?.acc ?? 0)} / ${percent(speed?.spd ?? 0)}`

  const fastBand = FAST_BAND
  const fastBonus = Math.round((speedReward(1) - 1) * 100) / 100
  const instant = 1 + fastBonus
  const fastHit = FAST_HIT_THRESHOLD
  const multipliers = [1, 2, 3].map((count) => `×${streakMultiplier(count)}`).join(' → ')
  const floor = RAMP_FLOOR_RATIO
  const slack = Math.round((1 - RAMP_FLOOR_RATIO) * 100) / 100
  const halfLife = RAMP_HALF_LIFE_HITS
  const wasteful = DIFFICULTY_ORDER.map(
    (d) => DIFFICULTIES[d].wastefulThreshold ?? '—',
  ).join(' / ')
  const maxTargets = list(DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d].maxTargets))

  const trainee = runRules('trainee', 'easy')
  const traineeRing = seconds(trainee.clock.base)
  const traineeGap = seconds(trainee.spawn.cap ?? 0)

  return (
    <>
      <KnowledgeSection title={<Trans>POINTS PER HIT</Trans>}>
        <KnowledgeFormula>
          <Trans>points = round(100 × (a × route + s × clock) × strike)</Trans>
        </KnowledgeFormula>
        <KnowledgeNote>
          <Trans>
            a / s: Accuracy {accBlend}, Speed {spdBlend}.
          </Trans>
        </KnowledgeNote>
        <KnowledgeFormula>
          <Trans>route = max(0, 1 − (presses − par) ÷ (par + 2))</Trans>
        </KnowledgeFormula>
        <KnowledgeFormula>
          <Trans>clock = time left ÷ ring</Trans>
        </KnowledgeFormula>
        <KnowledgeNote>
          <Trans>
            Above {fastBand}: clock + {fastBonus} × (clock − {fastBand}) ÷ (1 − {fastBand}
            ), so an instant hit is {instant}.
          </Trans>
        </KnowledgeNote>
      </KnowledgeSection>

      <KnowledgeSection title={<Trans>STRIKE</Trans>}>
        <KnowledgeFormula>{multipliers}</KnowledgeFormula>
        <KnowledgeNote>
          <Trans>
            Builds: Accuracy presses = par; Speed clock ≥ {fastHit}. Breaks: a hit that
            does not, or any target expiring.
          </Trans>
        </KnowledgeNote>
      </KnowledgeSection>

      <KnowledgeSection title={<Trans>SPEED-UP</Trans>}>
        <KnowledgeFormula>
          <Trans>
            ramp(x) = x × ({floor} + {slack} × 0.5 ^ (hits ÷ {halfLife}))
          </Trans>
        </KnowledgeFormula>
        <KnowledgeNote>
          <Trans>
            Speed: ring = ramp(ring), gap = ring ÷ 3. Accuracy: ring fixed, gap =
            ramp(ring ÷ 3).
          </Trans>
        </KnowledgeNote>
        <Text selectable={false} className={cn(TYPE.sectionLabel, 'mt-1 text-dim')}>
          <Trans>RING</Trans>
        </Text>
        <AdminTable columns={clockColumns} rows={rampRows(rampedTimeout)} />
        <Text selectable={false} className={cn(TYPE.sectionLabel, 'mt-1 text-dim')}>
          <Trans>GAP</Trans>
        </Text>
        <AdminTable
          columns={clockColumns}
          rows={rampRows((rules, hits) => spawnInterval(rules, hits))}
        />
      </KnowledgeSection>

      <KnowledgeSection title={<Trans>LIVES</Trans>}>
        <KnowledgeFormula>
          <Trans>3 lives; −1 per expired target</Trans>
        </KnowledgeFormula>
        <KnowledgeNote>
          <Trans>
            Accuracy also −1 when route &lt; {wasteful}. Max targets {maxTargets}. Both
            for Easy / Hard / Extreme.
          </Trans>
        </KnowledgeNote>
      </KnowledgeSection>

      <KnowledgeSection title={<Trans>TRAINEE</Trans>}>
        <KnowledgeFormula>
          <Trans>
            ring {traineeRing} (player-set), gap = min(ring ÷ 3, {traineeGap})
          </Trans>
        </KnowledgeFormula>
        <KnowledgeNote>
          <Trans>No lives, no speed-up, no strike. A hit that clears the board ×2.</Trans>
        </KnowledgeNote>
      </KnowledgeSection>
    </>
  )
}
