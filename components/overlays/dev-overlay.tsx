import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { FlatList, Text, View } from 'react-native'

import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
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
        <Text
          selectable={false}
          className="font-mono text-[12px] font-black tracking-[1px] text-primary"
        >
          {t(mode.label)}
        </Text>
        <Text
          selectable={false}
          className="mt-0.5 font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
        >
          {t(mode.description)}
        </Text>
        <Text
          selectable={false}
          className="mt-1 font-mono text-[9px] font-bold tracking-[1px] text-dim"
        >
          {STATUS_LABEL[status]} · {mode.id}
        </Text>
      </View>
      <TrackedPressable
        id="dev.run"
        onPress={() => {
          onRun(mode.id)
        }}
        hitSlop={8}
        className="rounded-xl bg-strong px-4 py-2"
      >
        <Text
          selectable={false}
          className="font-mono text-[11px] font-black tracking-[1.5px] text-on-strong"
        >
          <Trans>RUN</Trans>
        </Text>
      </TrackedPressable>
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
      <Text
        selectable={false}
        className="mb-1 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        <Trans>DEV</Trans>
      </Text>
      <Text
        selectable={false}
        className="mb-6 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
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
          <Text selectable={false} className="font-mono text-[12px] font-medium text-dim">
            <Trans>No challenges have been written yet.</Trans>
          </Text>
        }
      />

      <TrackedPressable
        id="dev.done"
        onPress={onClose}
        className="mt-4 items-center self-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </TrackedPressable>
    </ScreenLayer>
  )
}
