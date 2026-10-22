import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSegments } from '@/components/overlays/admin-segments'
import { AdminTable } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { achievement, groupIds, type AchievementId } from '@/constants/achievements'
import { TYPE } from '@/constants/typography'
import { POOR_RUN_SCORE } from '@/lib/career'
import { cn } from '@/lib/cn'
import { WIN_PERIODS, WIN_RANKS, winFactor } from '@/lib/winnings'
import { FAST_BAND, speedReward } from '@/machines/scoring'
import {
  codeOf,
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
  type Difficulty,
  type ScoredMode,
} from '@/modes'

// How things are counted, as formulas: the fifth door off the admin hub, and the only one
// that reads nothing from the server. A reference for whoever answers players, not a
// guide for players — so a line is a formula and a short note, never a paragraph.
//
// **Every figure is worked out, not typed.** The weights come off `DIFFICULTIES`, the
// podium off `winFactor`, the clocks off `runRules` and the ramp — so retuning a mode
// retunes this screen with it. Two exceptions, both priced in SQL with no client copy to
// read: a session's podium shares (`session_podium_share`) and its grace
// (`session_score_grace`). Those are written out below and have to move with them.
type Page = 'fortune' | 'secrets' | 'mechanics'

const PAGES: readonly Page[] = ['fortune', 'secrets', 'mechanics']

const PAGE_LABEL = {
  fortune: msg`FORTUNE`,
  secrets: msg`SECRETS`,
  mechanics: msg`MECHANICS`,
} as const

const TITLE = msg`KNOWLEDGE`

// The hit counts the clock tables are read at: one and two half-lives in.
const HALF_LIVES = [RAMP_HALF_LIFE_HITS, RAMP_HALF_LIFE_HITS * 2] as const

// Past every hit a run will ever land: the ramp at its floor.
const FOREVER = Number.POSITIVE_INFINITY

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`
const percent = (share: number): string => `${Math.round(share * 100)}%`
const list = (values: readonly number[]): string => values.join(' / ')

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <View className="mb-4 gap-1">
      <Text selectable={false} className={cn(TYPE.heading, 'text-primary')}>
        {title}
      </Text>
      {children}
    </View>
  )
}

// One formula, in the figure role so it reads as arithmetic rather than prose.
function Formula({ children }: { children: ReactNode }) {
  return <Text className={cn(TYPE.figure, 'text-primary')}>{children}</Text>
}

// What a formula's terms are, or where it does not apply.
function Note({ children }: { children: ReactNode }) {
  return <Text className={cn(TYPE.proseSm, 'text-dim')}>{children}</Text>
}

// A board's name in the tables: the mode's code and the rung's, as the medal line has it.
function useBoardLabel() {
  const { t } = useLingui()
  return (mode: ScoredMode, difficulty: Difficulty) =>
    `${t(codeOf(mode))} · ${t(DIFFICULTIES[difficulty].code)}`
}

// ── Fortune ──────────────────────────────────────────────────────────────────────────

function FortunePage() {
  const weights = list(DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d].scoreWeight))
  // The two shares `winFactor` multiplies, read back out of it at Hard, where the
  // difficulty half is ×1.
  const periods = list(WIN_PERIODS.map((period) => winFactor(period, 'hard', 1)))
  const places = list(WIN_RANKS.map((rank) => winFactor('week', 'hard', rank)))

  return (
    <>
      <Section title={<Trans>FORTUNE</Trans>}>
        <Formula>
          <Trans>Σ runs (score × w) + Σ sessions ((best + bonus) × w) + Σ winnings</Trans>
        </Formula>
        <Note>
          <Trans>
            w = {weights} for Easy / Hard / Extreme. Runs: every finished Accuracy or
            Speed run, not only the best. Nothing else adds.
          </Trans>
        </Note>
      </Section>

      <Section title={<Trans>SESSION BONUS</Trans>}>
        <Formula>
          <Trans>bonus = best × 1 / 0.5 / 0.2 for 1st / 2nd / 3rd</Trans>
        </Formula>
        <Note>
          <Trans>
            best = the player's best run of the session. Paid 10 minutes after the close,
            automatically.
          </Trans>
        </Note>
      </Section>

      <Section title={<Trans>WINNINGS</Trans>}>
        <Formula>
          <Trans>winning = score in window × w × period × place</Trans>
        </Formula>
        <Note>
          <Trans>
            period = {periods} for day / week. place = {places} for 1st / 2nd / 3rd. Joins
            the fortune only after CLAIM.
          </Trans>
        </Note>
      </Section>
    </>
  )
}

// ── Secrets ──────────────────────────────────────────────────────────────────────────

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

function SecretsPage() {
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
            <Note>
              {id in CONDITION ? CONDITION[id as keyof typeof CONDITION] : t(def.hint)}
            </Note>
          ),
        }
      })}
    />
  )
}

// ── Mechanics ────────────────────────────────────────────────────────────────────────

function MechanicsPage() {
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
      <Section title={<Trans>POINTS PER HIT</Trans>}>
        <Formula>
          <Trans>points = round(100 × (a × route + s × clock) × strike)</Trans>
        </Formula>
        <Note>
          <Trans>
            a / s: Accuracy {accBlend}, Speed {spdBlend}.
          </Trans>
        </Note>
        <Formula>
          <Trans>route = max(0, 1 − (presses − par) ÷ (par + 2))</Trans>
        </Formula>
        <Formula>
          <Trans>clock = time left ÷ ring</Trans>
        </Formula>
        <Note>
          <Trans>
            Above {fastBand}: clock + {fastBonus} × (clock − {fastBand}) ÷ (1 − {fastBand}
            ), so an instant hit is {instant}.
          </Trans>
        </Note>
      </Section>

      <Section title={<Trans>STRIKE</Trans>}>
        <Formula>{multipliers}</Formula>
        <Note>
          <Trans>
            Builds: Accuracy presses = par; Speed clock ≥ {fastHit}. Breaks: a hit that
            does not, or any target expiring.
          </Trans>
        </Note>
      </Section>

      <Section title={<Trans>SPEED-UP</Trans>}>
        <Formula>
          <Trans>
            ramp(x) = x × ({floor} + {slack} × 0.5 ^ (hits ÷ {halfLife}))
          </Trans>
        </Formula>
        <Note>
          <Trans>
            Speed: ring = ramp(ring), gap = ring ÷ 3. Accuracy: ring fixed, gap =
            ramp(ring ÷ 3).
          </Trans>
        </Note>
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
      </Section>

      <Section title={<Trans>LIVES</Trans>}>
        <Formula>
          <Trans>3 lives; −1 per expired target</Trans>
        </Formula>
        <Note>
          <Trans>
            Accuracy also −1 when route &lt; {wasteful}. Max targets {maxTargets}. Both
            for Easy / Hard / Extreme.
          </Trans>
        </Note>
      </Section>

      <Section title={<Trans>TRAINEE</Trans>}>
        <Formula>
          <Trans>
            ring {traineeRing} (player-set), gap = min(ring ÷ 3, {traineeGap})
          </Trans>
        </Formula>
        <Note>
          <Trans>No lives, no speed-up, no strike. A hit that clears the board ×2.</Trans>
        </Note>
      </Section>
    </>
  )
}

const PAGE_BODY: Record<Page, () => ReactNode> = {
  fortune: FortunePage,
  secrets: SecretsPage,
  mechanics: MechanicsPage,
}

export function AdminKnowledge({ onBack }: { onBack: () => void }) {
  const { t } = useLingui()
  const [page, setPage] = useState<Page>('fortune')
  const Body = PAGE_BODY[page]

  return (
    <AdminScreen
      title={t(TITLE)}
      footer={
        <PrimaryButton id="admin.back" onPress={onBack} label={<Trans>BACK</Trans>} />
      }
    >
      <AdminSegments
        id="admin.tab"
        className="mb-2.5"
        value={page}
        onSelect={setPage}
        options={PAGES.map((option) => ({ value: option, label: t(PAGE_LABEL[option]) }))}
      />
      {/* Keyed by the page so a switch starts at the top rather than wherever the last
          page was scrolled to. */}
      <ScrollView key={page} showsVerticalScrollIndicator={false}>
        <Body />
      </ScrollView>
    </AdminScreen>
  )
}
