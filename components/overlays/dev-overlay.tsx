import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'

import { PrimaryButton } from '@/components/primary-button'
import { ScreenLayer } from '@/components/screen'
import { TYPE } from '@/constants/typography'
import { listSessions, type AdminSession } from '@/lib/admin/sessions'
import { spanStatus, STATUS_LABEL } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import { CHALLENGES } from '@/modes/challenges/catalog'
import type { ModeDefinition } from '@/modes/types'

// A challenge's own compiled window, as a span. `window` null is a permanent mode, which
// no challenge is — but the type allows it, and a mode with no window is always open.
const PERMANENT = { opensAt: 0, closesAt: Number.POSITIVE_INFINITY }
const compiledSpan = (mode: ModeDefinition) =>
  mode.window === null
    ? PERMANENT
    : { opensAt: mode.window.from, closesAt: mode.window.until }

function ChallengeRow({
  mode,
  sessions,
  now,
  onRun,
}: {
  mode: ModeDefinition
  // The sessions planned for this challenge, newest start first. Empty for one nobody
  // has booked — which is every challenge until an admin plans one.
  sessions: readonly AdminSession[]
  now: number
  onRun: (modeId: string) => void
}) {
  const { t } = useLingui()
  const status = spanStatus(compiledSpan(mode), now)
  return (
    <View className="border-b border-dim/10 py-3">
      <View className="flex-row items-center justify-between gap-3">
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

      {/* What an admin has booked for this challenge, under what the build says about it.
          The two are independent in this phase — a session changes what admin holds and
          nothing about which window the app honours — and printing them together is what
          makes a plan verifiable from outside the planner that made it. */}
      {sessions.length > 0 && (
        <View className="mt-2 border-l border-dim/20 pl-3">
          <Text selectable={false} className={cn(TYPE.labelSm, 'mb-1 text-dim')}>
            <Trans>PLANNED</Trans>
          </Text>
          {sessions.map((session) => (
            <Text
              key={session.id}
              selectable={false}
              className={cn(TYPE.value, 'text-dim')}
            >
              {formatDayTime(session.opensAt)} → {formatDayTime(session.closesAt)} ·{' '}
              {STATUS_LABEL[spanStatus(session, now)]}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

// Every challenge ever written, playable on demand regardless of whether its window is
// open — the registry's own `openModes` is what the intro uses to hide the ones that
// are not, and this screen exists precisely to reach the ones that are. No leaderboard
// anywhere here: a challenge is outside `SCORED_MODES`, so the run this starts submits
// nothing — see lib/score-submission.ts.
//
// Behind the `challengeLab` feature, which is the key `dev` became: the link that opens
// this screen now appears for anybody holding any dev feature, of which this is the
// first. See `DEV_FEATURES` in constants/features.ts.
export function DevOverlay({
  onRunChallenge,
  onClose,
}: {
  onRunChallenge: (modeId: string) => void
  onClose: () => void
}) {
  const [openedAt] = useState(() => Date.now())
  const [sessions, setSessions] = useState<readonly AdminSession[]>([])

  // Read once on open, and failures are swallowed on purpose: the sessions are extra
  // information about a list that is already complete without them. A tester who cannot
  // reach the server should still be able to deal themselves a challenge.
  useEffect(() => {
    void (async () => {
      const res = await listSessions()
      setSessions(res.rows)
    })()
  }, [])

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
          <ChallengeRow
            mode={item}
            sessions={sessions.filter((session) => session.modeId === item.id)}
            now={openedAt}
            onRun={onRunChallenge}
          />
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
