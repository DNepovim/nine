import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminScreen } from '@/components/overlays/admin-screen'
import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { listSessions, type AdminSession } from '@/lib/admin/sessions'
import { spanStatus, type SpanStatus } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import type { OpenSession } from '@/lib/session-board'
import { measureOf } from '@/modes'
import { CHALLENGES } from '@/modes/challenges/catalog'

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
  extendedAt: session.extendedAt,
  leader: null,
  measure: measureOf(session.modeId),
})

// Every challenge ever written, playable on demand regardless of whether its window is
// open — the registry's own `openModes` is what the intro uses to hide the ones that
// are not, and this screen exists precisely to reach the ones that are. No leaderboard
// anywhere here: a challenge is outside `SCORED_MODES`, so the run this starts submits
// nothing — see lib/score-submission.ts.
//
// Behind the `challengeLab` feature, which is the key `dev` became: the link that opens
// this screen now appears for anybody holding any dev feature, of which this is the
// first. See `DEV_FEATURES` in constants/features.ts.
const TITLE = msg`CHALLENGES LAB`

export function DevOverlay({
  onOpenChallenge,
  onClose,
}: {
  onOpenChallenge: (modeId: string, session: OpenSession | null) => void
  onClose: () => void
}) {
  const { t } = useLingui()
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

  // One row per challenge, in the planner's own table without its date column: the
  // name in its own colours with what it is and where its session stands under it,
  // and nothing beside it. Pressing a row deals the challenge.
  const rows: readonly AdminTableRow[] = CHALLENGES.map((mode) => {
    const shown = shownSession(
      sessions.filter((session) => session.modeId === mode.id),
      openedAt,
    )
    return {
      key: mode.id,
      cells: [
        // Padded here rather than in `AdminTable`, whose rows every admin list shares:
        // three lines to a row read as one block without air above and below them.
        <View className="py-3">
          <ChallengeTitle modeId={mode.id} />
          <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
            {t(mode.description)}
          </Text>
          <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
            <SessionLine session={shown} now={openedAt} />
          </Text>
        </View>,
      ],
      onPress: () => {
        onOpenChallenge(mode.id, shown === null ? null : asOpenSession(shown))
      },
    }
  })

  return (
    <AdminScreen
      title={t(TITLE)}
      footer={
        <PrimaryButton
          id="dev.done"
          tone="quiet"
          onPress={onClose}
          label={<Trans>DONE</Trans>}
        />
      }
    >
      <Text selectable={false} className={cn(TYPE.caption, 'mb-2.5 text-dim')}>
        <Trans>EVERY CHALLENGE, ANY WINDOW — NO BOARD KEPT</Trans>
      </Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AdminTable
          rowId="dev.run"
          columns={[{ label: 'CHALLENGE', tone: 'name' }]}
          rows={rows}
          empty={<Trans>No challenges have been written yet.</Trans>}
        />
      </ScrollView>
    </AdminScreen>
  )
}
