import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'

import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSegments } from '@/components/overlays/admin-segments'
import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { AdminSessions } from '@/components/overlays/admin-sessions'
import { Note, Tile, TileGrid, washOf } from '@/components/overlays/admin-tile'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { ChallengePage } from '@/components/overlays/challenge-page'
import { LiveDot, PlannedDot } from '@/components/overlays/live-dot'
import { PrimaryButton } from '@/components/primary-button'
import { useFlag } from '@/hooks/use-flags'
import { listChallengeRatings, type ChallengeRating } from '@/lib/admin/ratings'
import { listSessions, type AdminSession } from '@/lib/admin/sessions'
import { pastRunsByMode, spanStatus, type SpanStatus } from '@/lib/challenge-session'
import { dayAndMonth } from '@/lib/format-date'
import type { OpenSession } from '@/lib/session-board'
import { timeAgo } from '@/lib/time-ago'
import { gradientOf, measureOf } from '@/modes'
import { CHALLENGES } from '@/modes/challenges/catalog'
import { challengeInk } from '@/modes/challenges/palette'

// The CHALLENGES section of the admin hub: every challenge written, and when each is on.
//
// One door where there were two — CHALLENGES PLANNER and CHALLENGES LAB were two tiles on
// the hub about the same thing, and an admin deciding what runs next wants the gallery
// and the queue a tab apart rather than a hub apart. The tabs are the FEATURES screen's
// own control, for the reason that screen has one: two views of one question.
//
// GALLERY is what the lab was — a tile per challenge, each opening its page, PLAY on it
// for whoever holds `challengeLab`. PLANNER is the queue, unchanged.
type Tab = 'gallery' | 'planner'

const TABS = [
  { value: 'gallery', label: 'GALLERY', icon: 'grid-outline' },
  { value: 'planner', label: 'PLANNER', icon: 'calendar-outline' },
] as const satisfies readonly { value: Tab; label: string; icon: string }[]

const TITLE = msg`CHALLENGES`

// The mark in a tile's corner where the hub draws its icon: the hub's icon size, so the
// two grids sit on the same line.
const MARK_SIZE = 22

// The status dot in a tile's other corner — larger than a table row's, since a tile is
// read from further off.
const DOT_SIZE = 8

// The session a challenge's page and PLAY speak for, in order of what matters most: one
// on now, then the next one booked, then the last one there was.
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

export function AdminChallenges({
  onOpenChallenge,
  onBack,
}: {
  // PLAY on a challenge's page. Up to the app root, which owns the dialog that deals it.
  onOpenChallenge: (modeId: string, session: OpenSession | null) => void
  onBack: () => void
}) {
  const { t } = useLingui()
  const canPlay = useFlag('challengeLab')
  const [tab, setTab] = useState<Tab>('gallery')
  // The challenge whose page is open over the gallery. State here, the way the planner
  // holds its form: reached from the gallery, and BACK returns to it.
  const [page, setPage] = useState<string | null>(null)
  const [sessions, setSessions] = useState<readonly AdminSession[]>([])
  const [ratings, setRatings] = useState<ReadonlyMap<string, ChallengeRating>>(new Map())
  const [openedAt, setOpenedAt] = useState(() => Date.now())

  // Read whenever the gallery comes up, not once: the planner a tab away books and moves
  // the sessions its dots and dates are read from. Failures are swallowed — the gallery
  // is complete without the figures, and a challenge can still be opened and played.
  useEffect(() => {
    if (tab !== 'gallery') return
    void (async () => {
      const [read, rated] = await Promise.all([listSessions(), listChallengeRatings()])
      setOpenedAt(Date.now())
      setSessions(read.rows)
      setRatings(rated)
    })()
  }, [tab])

  const tabs = (
    <AdminSegments
      id="admin.challenges_tab"
      className="mb-2.5"
      value={tab}
      onSelect={setTab}
      options={TABS}
    />
  )

  if (tab === 'planner') return <AdminSessions tabs={tabs} onBack={onBack} />

  const sessionsOf = (modeId: string) =>
    sessions.filter((session) => session.modeId === modeId)

  if (page !== null) {
    return (
      <ChallengePage
        modeId={page}
        rating={ratings.get(page)}
        onPlay={
          canPlay
            ? () => {
                const shown = shownSession(sessionsOf(page), openedAt)
                onOpenChallenge(page, shown === null ? null : asOpenSession(shown))
              }
            : undefined
        }
        onBack={() => {
          setPage(null)
        }}
      />
    )
  }

  const runs = pastRunsByMode(sessions, openedAt)

  const tiles = CHALLENGES.map((mode) => {
    const own = sessionsOf(mode.id)
    const live = own.some((session) => spanStatus(session, openedAt) === 'live')
    const next = own
      .filter((session) => spanStatus(session, openedAt) === 'upcoming')
      .sort((a, b) => a.opensAt - b.opensAt)[0]
    const ran = runs.get(mode.id)
    const ago = ran === undefined ? null : timeAgo(ran.lastClosedAt, openedAt)
    const count = ran?.count ?? 0
    const rating = ratings.get(mode.id)
    const average = rating?.average.toFixed(1)
    const { day, month } = dayAndMonth(next?.opensAt ?? 0)
    const opens = `${day} ${month}`

    return (
      <Tile
        key={mode.id}
        id="admin.challenge"
        wash={washOf(mode.id)}
        mark={
          <ChallengeMark
            modeId={mode.id}
            color={challengeInk(gradientOf(mode.id)[1])}
            size={MARK_SIZE}
          />
        }
        // Red and breathing for one on now; green and still for one in the queue. A
        // challenge that is both — on today and booked again — shows the one on now.
        corner={
          live ? (
            <LiveDot size={DOT_SIZE} />
          ) : next === undefined ? undefined : (
            <PlannedDot size={DOT_SIZE} />
          )
        }
        heading={<ChallengeTitle modeId={mode.id} wrap />}
        note={
          <Note
            lines={[
              next === undefined ? null : <Trans key="next">Next {opens}</Trans>,
              ago === null ? (
                <Trans key="never">Never run</Trans>
              ) : (
                <Trans key="ran">Last {ago}</Trans>
              ),
              <Plural key="count" value={count} one="# session" other="# sessions" />,
              average === undefined ? (
                <Trans key="unrated">Not rated</Trans>
              ) : (
                <Trans key="rated">Rated {average}</Trans>
              ),
            ].filter((line) => line !== null)}
          />
        }
        onPress={() => {
          setPage(mode.id)
        }}
      />
    )
  })

  return (
    <AdminScreen
      title={t(TITLE)}
      footer={
        <PrimaryButton
          id="admin.back"
          tone="quiet"
          onPress={onBack}
          label={<Trans>BACK</Trans>}
        />
      }
    >
      {tabs}
      <ScrollView showsVerticalScrollIndicator={false}>
        <TileGrid tiles={tiles} />
      </ScrollView>
    </AdminScreen>
  )
}
