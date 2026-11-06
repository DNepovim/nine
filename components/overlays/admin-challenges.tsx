import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text } from 'react-native'

import { AdminPills } from '@/components/overlays/admin-pills'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSegments } from '@/components/overlays/admin-segments'
import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { AdminSessions } from '@/components/overlays/admin-sessions'
import { Note, Tile, TileGrid, washOf } from '@/components/overlays/admin-tile'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { ChallengePage } from '@/components/overlays/challenge-page'
import { DOT_COLOR, TileDot } from '@/components/overlays/live-dot'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { useFlag } from '@/hooks/use-flags'
import { refreshOpenSessions } from '@/hooks/use-open-sessions'
import { listChallengeStates, setChallengeState } from '@/lib/admin/challenge-states'
import { listChallengeRatings, type ChallengeRating } from '@/lib/admin/ratings'
import { listSessions, type AdminSession } from '@/lib/admin/sessions'
import { pastRunsByMode, spanStatus, type SpanStatus } from '@/lib/challenge-session'
import {
  CHALLENGE_DOTS,
  challengeDotOf,
  tallyDots,
  type ChallengeDot,
  type ChallengeState,
} from '@/lib/challenge-state'
import { cn } from '@/lib/cn'
import { dayAndMonth } from '@/lib/format-date'
import type { OpenSession } from '@/lib/session-board'
import { loadVoteOptions, type VoteOption } from '@/lib/session-ratings'
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

// The gallery's filter: the four things its one dot says, each a glyph and a count in the
// dot's colour — the words RUNNING, PLANNED, LIVE and PENDING do not fit four to a line.
const DOT_ICON = {
  running: 'flash',
  planned: 'calendar-outline',
  live: 'radio-button-on',
  pending: 'pause',
} as const satisfies Record<ChallengeDot, string>

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
  // Which challenges are held back (a missing id is live) and where the vote stands, for
  // the dots and the challenge page.
  const [states, setStates] = useState<ReadonlyMap<string, ChallengeState>>(new Map())
  const [votes, setVotes] = useState<readonly VoteOption[]>([])
  // The dots turned on; all of them to begin with.
  const [lit, setLit] = useState<ReadonlySet<ChallengeDot>>(() => new Set(CHALLENGE_DOTS))

  // Read whenever the gallery comes up, not once: the planner a tab away books and moves
  // the sessions its dots and dates are read from. Failures are swallowed — the gallery
  // is complete without the figures, and a challenge can still be opened and played.
  const load = async () => {
    const [read, rated, held, options] = await Promise.all([
      listSessions(),
      listChallengeRatings(),
      listChallengeStates(),
      loadVoteOptions(),
    ])
    setOpenedAt(Date.now())
    setSessions(read.rows)
    setRatings(rated)
    if (held !== null) setStates(held)
    setVotes(options)
  }

  useEffect(() => {
    if (tab !== 'gallery') return
    void load()
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
        state={states.get(page) ?? 'live'}
        planned={sessionsOf(page)
          .filter((session) => spanStatus(session, openedAt) === 'upcoming')
          .sort((a, b) => a.opensAt - b.opensAt)}
        votes={votes}
        onState={async (state) => {
          const res = await setChallengeState(page, state)
          // Read again either way: a refusal leaves the truth on the screen, and a removal
          // changes the planned dates the page lists.
          await load()
          refreshOpenSessions()
          return res
        }}
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

  // Each challenge with the one dot it wears. Worked out before the tiles so the filter's
  // counts and the tiles agree: every challenge is in exactly one pill.
  const drawn = CHALLENGES.map((mode) => {
    const own = sessionsOf(mode.id)
    const running = own.some((session) => spanStatus(session, openedAt) === 'live')
    const next = own
      .filter((session) => spanStatus(session, openedAt) === 'upcoming')
      .sort((a, b) => a.opensAt - b.opensAt)[0]
    const kind = challengeDotOf({
      state: states.get(mode.id) ?? 'live',
      running,
      planned: next !== undefined,
    })
    return { mode, next, kind }
  })
  const counts = tallyDots(drawn.map((entry) => entry.kind))

  const tiles = drawn
    .filter((entry) => lit.has(entry.kind))
    .map(({ mode, next, kind }) => {
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
          // One dot for everything: red and breathing for one on now, green and still for
          // one in the queue, blue for one that is live with nothing booked, black for one
          // held back. See `challengeDotOf` for which wins.
          corner={<TileDot kind={kind} size={DOT_SIZE} />}
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
      <AdminPills
        id="admin.challenge_filter"
        className="mb-2.5"
        compact
        mode="toggle"
        lit={lit}
        onToggle={(option) => {
          setLit((was) => {
            const next = new Set(was)
            if (next.has(option)) next.delete(option)
            else next.add(option)
            return next
          })
        }}
        options={CHALLENGE_DOTS.map((option) => ({
          value: option,
          label: String(counts[option]),
          icon: DOT_ICON[option],
          tint: DOT_COLOR[option],
        }))}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {tiles.length === 0 ? (
          <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
            {lit.size === 0 ? (
              <Trans>No filters are on.</Trans>
            ) : (
              <Trans>Nothing in these states.</Trans>
            )}
          </Text>
        ) : (
          <TileGrid tiles={tiles} />
        )}
      </ScrollView>
    </AdminScreen>
  )
}
