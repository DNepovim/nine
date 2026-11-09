import { Ionicons } from '@expo/vector-icons'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminCandidatesDialog } from '@/components/overlays/admin-candidates-dialog'
import { AdminPills } from '@/components/overlays/admin-pills'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSession } from '@/components/overlays/admin-session'
import { ChallengeTitle, WhenBlock } from '@/components/overlays/admin-session-cells'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { DOT_COLOR } from '@/components/overlays/live-dot'
import { PrimaryButton } from '@/components/primary-button'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { refreshOpenSessions } from '@/hooks/use-open-sessions'
import { listChallengeStates } from '@/lib/admin/challenge-states'
import {
  listSessions,
  planSession,
  type AdminSession as Session,
} from '@/lib/admin/sessions'
import {
  pastRunsByMode,
  queueOrder,
  shownByStatus,
  spanStatus,
  type SpanStatus,
} from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatCountdown, formatWindowLength } from '@/lib/duration'
import { loadOpenSessions, type OpenSession } from '@/lib/session-board'
import { sessionFigure } from '@/lib/session-figure'
import { loadVoteOptions, type VoteOption } from '@/lib/session-ratings'
import { votingSession } from '@/lib/session-voting'

// When a challenge is on: every session ever planned, newest start first.
//
// The second half of the admin hub, and the half that did not exist before — a
// challenge's window used to be two timestamps in the bundle. Nothing here resolves a
// session into the rules a run is played under; that is the next phase. What this screen
// decides is only what the server holds.
//
// A session is one row with two **candidates** and one date, and the list says only what
// that row can say at a glance: a running one its figures, a planned one its candidates —
// and, for the one being voted on, how the vote stands and how long is left to cast it.
// The detail is a press away, and there is no reordering: the queue is the order the
// sessions were booked in.
//
// The form is state here rather than a screen of its own for the reason `AdminAccess`
// holds its person and its role: a session is reached from this list and goes back to
// it. Planning is a dialog over the list instead.
type Editing = Session | null

const TITLE = msg`CHALLENGES`

// Which sessions are listed, and in the order a planner reads them: what is on now, what
// is coming, what already ran.
//
// Three rather than the four there were. The fourth was ALL, and once these became
// toggles it was the union of the other three — a pill that is the sum of its neighbours
// is not a filter. Lighting all three says what it said, and the pairs it could never
// say (LIVE and PAST, which is everything except what is still to come) are now sayable.
const FILTERS: readonly SpanStatus[] = ['live', 'upcoming', 'expired']

// What the screen opens on: what is on now and what is coming. The record below them is
// a press away and is not what somebody opening this screen came to see.
const LIT_ON_ARRIVAL: readonly SpanStatus[] = ['live', 'upcoming']

// The pills are the gallery's — a glyph and a count, each in a colour — for the same
// reason the gallery's are: three words and their counts do not fit a phone's width in
// one line. Running and booked wear the dots' own colours, so a pill reads as the dot it
// stands for; what is over is the quiet one.
const FILTER = {
  live: { icon: 'flash', tint: DOT_COLOR.running },
  upcoming: { icon: 'calendar-outline', tint: DOT_COLOR.planned },
  expired: { icon: 'time-outline', tint: DIM_INK },
} as const satisfies Record<
  SpanStatus,
  { icon: ComponentProps<typeof Ionicons>['name']; tint: string }
>

export function AdminSessions({
  tabs,
  onBack,
}: {
  // The CHALLENGES screen's GALLERY / PLANNER row, drawn over the filters: the planner is
  // one tab of that screen, and owns its own footer and form.
  tabs: ReactNode
  onBack: () => void
}) {
  const { t } = useLingui()
  const [rows, setRows] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  // The PLAN SESSION dialog, the challenges held back (which no field offers), where the
  // vote stands and the running sessions' leaders, for the rows' figures.
  const [planning, setPlanning] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [votes, setVotes] = useState<readonly VoteOption[]>([])
  const [leaders, setLeaders] = useState<ReadonlyMap<string, OpenSession>>(new Map())
  const [lit, setLit] = useState<ReadonlySet<SpanStatus>>(() => new Set(LIT_ON_ARRIVAL))

  // One counter, the way every other admin list has one: the list is a snapshot, and a
  // write on the form behind it has to be able to tell this to read again.
  const [epoch, setEpoch] = useState(0)

  // Read once per *read* rather than per render: a window closing on its own while this
  // screen is up must not relabel a row under a thumb already travelling towards it,
  // which is why this is not a ticker. The countdowns are read against the same moment.
  //
  // It is re-seeded with `epoch`, because a write on the detail can change a window's
  // status from inside this screen. Frozen at mount, a session closed early reloads with
  // `closes_at` already behind us and still reads `live` against the old clock — keeping its
  // dot and still counting under the LIVE filter. The clock has to move when the rows do.
  const [openedAt, setOpenedAt] = useState(() => Date.now())

  // A failed read keeps the rows on screen rather than blanking the planner for a write
  // that landed.
  const load = async () => {
    const [res, held, options, open] = await Promise.all([
      listSessions(),
      listChallengeStates(),
      loadVoteOptions(),
      loadOpenSessions(),
    ])
    setOpenedAt(Date.now())
    if (res.error === null) setRows(res.rows)
    if (held !== null) {
      setPending(
        new Set([...held].flatMap(([id, state]) => (state === 'pending' ? [id] : []))),
      )
    }
    setVotes(options)
    setLeaders(new Map(open.rows.map((row) => [row.id, row])))
    setError(res.error)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // `epoch` bumps after the form's writes as well. Only the first read has nothing to
    // draw, and `loading` is never set back to true, so a save does not blank the list.
  }, [epoch])

  // After any write: read the list again, and tell the intro's card, which reads its
  // sessions once a launch — a booking is the thing that has to reach it without one.
  const changed = () => {
    setEpoch((n) => n + 1)
    refreshOpenSessions()
  }

  // The one session being voted on: the only planned row that shows votes and a clock.
  const voting = votingSession(
    rows.filter((row) => !pending.has(row.modeId)),
    openedAt,
  )

  if (editing !== null) {
    return (
      <AdminSession
        session={editing}
        voting={voting?.id === editing.id}
        pastRuns={pastRunsByMode(rows, openedAt)}
        now={openedAt}
        pending={pending}
        onChanged={changed}
        onBack={() => {
          setEditing(null)
        }}
      />
    )
  }

  // One pass for all three pills rather than one pass each. The list is tens of rows, so
  // this is not about the clock — it is that `spanStatus` was being asked the same
  // question about the same row three times on every render, which reads as though the
  // three counts were three different questions.
  const counts = rows.reduce<Record<SpanStatus, number>>(
    (tally, session) => {
      tally[spanStatus(session, openedAt)] += 1
      return tally
    },
    { live: 0, upcoming: 0, expired: 0 },
  )

  // Live, then the queue in the order it runs, then the past newest first — see
  // `queueOrder`. The server hands the rows back newest first, which is the right order
  // for everything but the queue, and the queue is what this screen is now for.
  const shown = shownByStatus(queueOrder(rows, openedAt), lit, openedAt)
  const votesOf = (modeId: string) =>
    votes.find((option) => option.modeId === modeId)?.votes

  // A running session's line: what leads it, who is on it and how long it has left.
  const liveLine = (session: Session) => {
    const open = leaders.get(session.id)
    const leader = open?.leader ?? null
    const best =
      open === undefined || leader === null
        ? '—'
        : sessionFigure(open.measure, {
            score: leader.score,
            hits: leader.hits,
            timeMs: leader.timeMs,
          })
    return (
      <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
        {best}
        {' · '}
        <Plural value={session.played} one="# player" other="# players" />
        {' · '}
        <Trans>{formatCountdown(session.closesAt - openedAt)} left</Trans>
      </Text>
    )
  }

  // One session per row: a date and what is on it.
  //
  // A row whose challenge this build has never heard of is drawn rather than hidden, and
  // drawn as what it is — the raw id and NOT IN THIS BUILD, because `labelOf` would
  // answer GAME for it and a list of sessions all called GAME is worse than useless.
  // Still pressable: a row booked for a challenge that has been taken out of the catalog
  // is exactly the row somebody needs to open and cancel.
  const tableRows: readonly AdminTableRow[] = shown.map((session) => {
    const status = spanStatus(session, openedAt)
    const candidates = [
      session.modeId,
      ...(session.altModeId === null ? [] : [session.altModeId]),
    ]
    const voted = voting?.id === session.id
    // What the name cell says, by where the session stands: a running one its figures, a
    // planned one its candidates (with the vote and the clock on the one being voted on),
    // a finished one how long it ran. A map and not a chain, so a fourth status breaks the
    // build here instead of falling into the last branch.
    const nameCell = {
      live: () => (
        <View>
          <ChallengeTitle modeId={session.modeId} />
          {liveLine(session)}
        </View>
      ),
      upcoming: () => (
        <View className="gap-1 py-2">
          {candidates.map((modeId) => (
            <View
              key={modeId}
              className="w-full flex-row items-baseline justify-between gap-3"
            >
              <ChallengeTitle modeId={modeId} />
              {voted && (
                <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                  <Plural value={votesOf(modeId) ?? 0} one="# VOTE" other="# VOTES" />
                </Text>
              )}
            </View>
          ))}
          {voted && (
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              <Trans>opens in {formatCountdown(session.opensAt - openedAt)}</Trans>
            </Text>
          )}
        </View>
      ),
      expired: () => (
        <View>
          <ChallengeTitle modeId={session.modeId} />
          <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
            {formatWindowLength(session.closesAt - session.opensAt)}
          </Text>
        </View>
      ),
    } as const satisfies Record<SpanStatus, () => ReactNode>
    return {
      key: session.id,
      // Dimmed once it is over. An expired session is kept — it is the record of what
      // ran — but it is not what a reader scanning this list is looking for.
      faded: status === 'expired',
      cells: [
        <WhenBlock at={session.opensAt} live={status === 'live'} />,
        nameCell[status](),
      ],
      onPress: () => {
        setEditing(session)
      },
      // No chevron: the planner's rows are all doors, and the lane is worth more to the
      // name than a mark every row would wear.
      leads: false,
    }
  })

  return (
    <AdminScreen
      title={t(TITLE)}
      error={error}
      footer={
        <View className="gap-2">
          <PrimaryButton
            id="admin.session_new"
            onPress={() => {
              setPlanning(true)
            }}
            label={<Trans>PLAN SESSION</Trans>}
          />
          <PrimaryButton
            id="admin.back"
            tone="quiet"
            onPress={onBack}
            label={<Trans>BACK</Trans>}
          />
        </View>
      }
    >
      {tabs}
      <AdminPills
        id="admin.filter"
        className="mb-2.5"
        compact
        mode="toggle"
        lit={lit}
        onToggle={(option) => {
          // The set is this screen's, so the new one is worked out here rather than in
          // the control — which is handed the pill that was pressed and nothing else.
          setLit((was) => {
            const next = new Set(was)
            if (next.has(option)) next.delete(option)
            else next.add(option)
            return next
          })
        }}
        options={FILTERS.map((option) => ({
          value: option,
          label: String(counts[option]),
          icon: FILTER[option].icon,
          tint: FILTER[option].tint,
        }))}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <AdminTable
          rowId="admin.session"
          loading={loading}
          columns={[
            // The live dot's lane and the date beside it.
            { width: 47 },
            { label: 'CHALLENGE', tone: 'name' },
          ]}
          rows={tableRows}
          empty={
            // Three answers rather than two, because "nothing to show" now has a third
            // cause: every filter turned off. Saying *that* rather than "nothing planned"
            // is the difference between a list that looks broken and one that is obeying.
            isEmptyArray([...lit]) ? (
              <Trans>No filters are on.</Trans>
            ) : rows.length === 0 ? (
              <Trans>No sessions planned yet.</Trans>
            ) : (
              <Trans>Nothing in these states.</Trans>
            )
          }
        />
      </ScrollView>

      {planning && (
        <AdminCandidatesDialog
          title={<Trans>PLAN SESSION</Trans>}
          pastRuns={pastRunsByMode(rows, openedAt)}
          now={openedAt}
          pending={pending}
          onSave={async (first, second) => {
            const res = await planSession(first, second)
            if (res.error === null) changed()
            return res
          }}
          onDismiss={() => {
            setPlanning(false)
          }}
        />
      )}
    </AdminScreen>
  )
}
