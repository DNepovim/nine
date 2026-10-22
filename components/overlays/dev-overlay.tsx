import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'

import { PrimaryButton } from '@/components/primary-button'
import { ScreenLayer } from '@/components/screen'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { listSessions, type AdminSession } from '@/lib/admin/sessions'
import { spanStatus, type SpanStatus } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import type { OpenSession } from '@/lib/session-board'
import { measureOf } from '@/modes'
import { CHALLENGES } from '@/modes/challenges/catalog'
import type { ModeDefinition } from '@/modes/types'

// The session a row speaks for, in order of what matters most: one on now, then the
// next one booked, then the last one there was. The line under the name and the dialog
// the play button opens both read this, so the two always mean the same session.
function shownSession(
  sessions: readonly AdminSession[],
  now: number,
): AdminSession | null {
  const of = (status: SpanStatus) =>
    sessions.filter((session) => spanStatus(session, now) === status)
  const live = of('live')[0]
  if (live !== undefined) return live
  const next = of('upcoming').sort((a, b) => a.opensAt - b.opensAt)[0]
  if (next !== undefined) return next
  return of('expired').sort((a, b) => b.closesAt - a.closesAt)[0] ?? null
}

function SessionLine({ session, now }: { session: AdminSession | null; now: number }) {
  if (session === null) return <Trans>NO SESSION YET</Trans>
  const status = spanStatus(session, now)
  if (status === 'live') {
    const until = formatDayTime(session.closesAt)
    return <Trans>SESSION IS LIVE UNTIL {until}</Trans>
  }
  if (status === 'upcoming') {
    const opens = formatDayTime(session.opensAt)
    return <Trans>SESSION IS PLANNED FOR {opens}</Trans>
  }
  const closed = formatDayTime(session.closesAt)
  return <Trans>LAST SESSION WAS {closed}</Trans>
}

// The planner's row in the shape the challenge dialog reads. What the planner does not
// carry is filled with what a dialog cannot tell apart: no leader (the dialog reads the
// standings themselves), and the measure the challenge's rules give.
const asOpenSession = (session: AdminSession): OpenSession => ({
  id: session.id,
  modeId: session.modeId,
  opensAt: session.opensAt,
  closesAt: session.closesAt,
  teaserMinutes: session.teaserMinutes ?? 0,
  extendedAt: session.extendedAt,
  leader: null,
  measure: measureOf(session.modeId),
})

function ChallengeRow({
  mode,
  sessions,
  now,
  onOpen,
}: {
  mode: ModeDefinition
  // The sessions planned for this challenge, newest start first. Empty for one nobody
  // has booked — which is every challenge until an admin plans one.
  sessions: readonly AdminSession[]
  now: number
  onOpen: (modeId: string, session: OpenSession | null) => void
}) {
  const { t } = useLingui()
  const shown = shownSession(sessions, now)
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
            <SessionLine session={shown} now={now} />
          </Text>
        </View>
        <PrimaryButton
          id="dev.run"
          onPress={() => {
            onOpen(mode.id, shown === null ? null : asOpenSession(shown))
          }}
          tone="quiet"
          icon={<Ionicons name="play" size={22} color={DIM_INK} />}
        />
      </View>
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
  onOpenChallenge,
  onClose,
}: {
  onOpenChallenge: (modeId: string, session: OpenSession | null) => void
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
            onOpen={onOpenChallenge}
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
