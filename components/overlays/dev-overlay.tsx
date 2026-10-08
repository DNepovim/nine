import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { FlatList, Text, View } from 'react-native'

import { PrimaryButton } from '@/components/primary-button'
import { ScreenLayer } from '@/components/screen'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { CHALLENGES } from '@/modes/challenges/catalog'
import type { ModeDefinition } from '@/modes/types'

// Live, upcoming or over — read once per open the way the intro reads `openedAt`, so a
// window crossing while this screen is up does not relabel a row out from under a tap
// already on its way to RUN.
type ChallengeStatus = 'live' | 'upcoming' | 'expired'

function statusOf(mode: ModeDefinition, now: number): ChallengeStatus {
  if (mode.window === null) return 'live'
  if (now < mode.window.from) return 'upcoming'
  if (now >= mode.window.until) return 'expired'
  return 'live'
}

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  live: 'LIVE NOW',
  upcoming: 'UPCOMING',
  expired: 'EXPIRED',
}

function ChallengeRow({
  mode,
  now,
  onRun,
}: {
  mode: ModeDefinition
  now: number
  onRun: (modeId: string) => void
}) {
  const { t } = useLingui()
  const status = statusOf(mode, now)
  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-dim/10 py-3">
      <View className="flex-1">
        <Text selectable={false} className={cn(TYPE.prose, 'text-primary')}>
          {t(mode.label)}
        </Text>
        <Text selectable={false} className={cn(TYPE.value, 'mt-0.5 text-dim')}>
          {t(mode.description)}
        </Text>
        <Text selectable={false} className={cn(TYPE.labelSm, 'mt-1 text-dim')}>
          {STATUS_LABEL[status]} · {mode.id}
        </Text>
      </View>
      <PrimaryButton
        id="dev.run"
        onPress={() => {
          onRun(mode.id)
        }}
        hitSlop={8}
        variant="compact"
        label={<Trans>RUN</Trans>}
      />
    </View>
  )
}

// Every challenge ever written, playable on demand regardless of whether its window is
// open — the registry's own `openModes` is what the intro uses to hide the ones that
// are not, and this screen exists precisely to reach the ones that are. No leaderboard
// anywhere here: a challenge is outside `SCORED_MODES`, so the run this starts submits
// nothing — see lib/score-submission.ts.
export function DevOverlay({
  onRunChallenge,
  onClose,
}: {
  onRunChallenge: (modeId: string) => void
  onClose: () => void
}) {
  const [openedAt] = useState(() => Date.now())
  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <Text selectable={false} className={cn(TYPE.screenTitle, 'mb-1 text-primary')}>
        <Trans>DEV</Trans>
      </Text>
      <Text selectable={false} className={cn(TYPE.label, 'mb-6 text-dim')}>
        <Trans>EVERY CHALLENGE, ANY WINDOW — NO BOARD KEPT</Trans>
      </Text>

      <FlatList
        data={CHALLENGES}
        keyExtractor={(mode) => mode.id}
        renderItem={({ item }) => (
          <ChallengeRow mode={item} now={openedAt} onRun={onRunChallenge} />
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text selectable={false} className={cn(TYPE.prose, 'text-dim')}>
            <Trans>No challenges have been written yet.</Trans>
          </Text>
        }
      />

      <PrimaryButton
        id="dev.done"
        onPress={onClose}
        className="mt-4 self-center"
        style={{ width: 224 }}
        label={<Trans>DONE</Trans>}
      />
    </ScreenLayer>
  )
}
