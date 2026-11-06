import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import { useEffect, useState, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminPair } from '@/components/overlays/admin-pair'
import { AdminPills } from '@/components/overlays/admin-pills'
import { AdminPlanPair } from '@/components/overlays/admin-plan-pair'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSession } from '@/components/overlays/admin-session'
import {
  ChallengeTitle,
  QueueMoves,
  WhenBlock,
} from '@/components/overlays/admin-session-cells'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { refreshOpenSessions } from '@/hooks/use-open-sessions'
import { listChallengeStates } from '@/lib/admin/challenge-states'
import {
  listSessions,
  movePair,
  type QueueStep,
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
import { formatWindowLength } from '@/lib/duration'
import { formatDayTime } from '@/lib/format-date'
import { pairsOf, withVotes, type DrawnPair } from '@/lib/session-pairs'
import { loadVoteOptions, type VoteOption } from '@/lib/session-ratings'

// When a challenge is on: every session ever planned, newest start first.
//
// The second half of the admin hub, and the half that did not exist before — a
// challenge's window used to be two timestamps in the bundle. Nothing here resolves a
// session into the rules a run is played under; that is the next phase. What this screen
// decides is only what the server holds.
//
// The form is state here rather than a screen of its own for the reason `AdminAccess`
// holds its person and its role: a session is reached from this list and goes back to
// it. Planning is a dialog over the list instead — two candidates at once, a **pair**.
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

// Not translated: these name the state of a database row on a screen whose readers are
// the people who write the catalog.
const FILTER_LABEL = {
  live: 'LIVE',
  upcoming: 'PLANNED',
  expired: 'PAST',
} as const satisfies Record<SpanStatus, string>

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
  // A step in the queue is in flight. Every arrow waits on it, not only the pressed one:
  // a second tap lands on a list whose order the first is about to change.
  const [moving, setMoving] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  // The pair whose detail is open: one item of the queue, with its own screen.
  const [editingPair, setEditingPair] = useState<DrawnPair<Session> | null>(null)
  // The PLAN SESSION dialog, the challenges held back (which no field offers) and where the
  // vote stands, for the first pair's counts.
  const [planning, setPlanning] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [votes, setVotes] = useState<readonly VoteOption[]>([])
  const [lit, setLit] = useState<ReadonlySet<SpanStatus>>(() => new Set(LIT_ON_ARRIVAL))

  // One counter, the way every other admin list has one: the list is a snapshot, and a
  // write on the form behind it has to be able to tell this to read again.
  const [epoch, setEpoch] = useState(0)

  // Read once per *read* rather than per render: a window closing on its own while this
  // screen is up must not relabel a row under a thumb already travelling towards it,
  // which is why this is not a ticker.
  //
  // But it is re-seeded with `epoch`, and that is new. CLOSE EARLY and EXTEND let this
  // screen change a window's status from inside itself, which nothing here could do
  // before. Frozen at mount, a session closed early reloads with `closes_at` already
  // behind us and still reads `live` against the old clock — keeping its dot,
  // still counting under the LIVE filter, and offering EXTEND on a form whose writes the
  // server now refuses. The clock has to move when the rows do.
  const [openedAt, setOpenedAt] = useState(() => Date.now())

  // One read, shared by the load below and by a step in the queue. `shown` is an error the
  // caller already has — a refused step — which a good read must not wipe. A failed read
  // keeps the rows on screen rather than blanking the planner for a write that landed.
  const load = async (shown: string | null = null) => {
    const [res, held, options] = await Promise.all([
      listSessions(),
      listChallengeStates(),
      loadVoteOptions(),
    ])
    setOpenedAt(Date.now())
    if (res.error === null) setRows(res.rows)
    if (held !== null) {
      setPending(
        new Set([...held].flatMap(([id, state]) => (state === 'pending' ? [id] : []))),
      )
    }
    setVotes(options)
    setError(shown ?? res.error)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // `epoch` bumps after the form's writes as well. Only the first read has nothing to
    // draw, and `loading` is never set back to true, so a save does not blank the list.
  }, [epoch])

  // After any write: read the list again, and tell the intro's card, which reads its
  // sessions once a launch — a booking, and now a step in the queue, are the things that
  // have to reach it without one.
  const changed = () => {
    setEpoch((n) => n + 1)
    refreshOpenSessions()
  }

  // A step reads the list itself rather than bumping `epoch`, for two reasons the effect
  // cannot serve. A refused step's error ("no longer in the queue") has to survive the
  // good read after it. And `moving` has to stay up until the new order is drawn: arrows
  // that come back over the old order invite a second tap aimed at a row that has
  // already moved.
  const move = async (id: string, delta: QueueStep) => {
    setMoving(true)
    const step = await movePair(id, delta)
    await load(step.error)
    setMoving(false)
    refreshOpenSessions()
  }

  if (editingPair !== null) {
    return (
      <AdminPair
        pair={editingPair}
        pastRuns={pastRunsByMode(rows, openedAt)}
        now={openedAt}
        pending={pending}
        onChanged={changed}
        onBack={() => {
          setEditingPair(null)
        }}
      />
    )
  }

  if (editing !== null) {
    return (
      <AdminSession
        session={editing}
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
  const ordered = queueOrder(rows, openedAt)
  const shown = shownByStatus(ordered, lit, openedAt)

  // One planned session per row: which challenge, when it opens, how long it runs, and
  // where that span stands against now.
  //
  // A row whose challenge this build has never heard of is drawn rather than hidden, and
  // drawn as what it is — the raw id and NOT IN THIS BUILD, because `labelOf` would
  // answer GAME for it and a list of sessions all called GAME is worse than useless.
  // Still pressable: a row booked for a challenge that has been taken out of the catalog
  // is exactly the row somebody needs to open and cancel.
  // A live or past row. The queue is drawn as pairs, below.
  const rowOf = (session: Session): AdminTableRow => {
    const status = spanStatus(session, openedAt)
    return {
      key: session.id,
      // Dimmed once it is over. An expired session is kept — it is the record of what
      // ran — but it is not what a reader scanning this list is looking for.
      faded: status === 'expired',
      cells: [
        <WhenBlock at={session.opensAt} live={status === 'live'} />,
        <View>
          <ChallengeTitle modeId={session.modeId} />
          <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
            {formatWindowLength(session.closesAt - session.opensAt)}
          </Text>
        </View>,
        // The queue's steps live on the pairs below; a live or past row has none.
        null,
      ],
      onPress: () => {
        setEditing(session)
      },
      // No chevron: the planner's rows are all doors, and the lane is worth more to the
      // name than a mark every row would wear.
      leads: false,
    }
  }

  // The queue, two at a time. A pair is one item: one door to its detail, one set of steps,
  // and both challenges in it — the one with more votes on top, and for the first pair, the
  // vote's two, each one's count.
  const queuedPairs = pairsOf(
    shown.filter((session) => spanStatus(session, openedAt) === 'upcoming'),
  )
  const pairRows: readonly AdminTableRow[] = queuedPairs.map((pair, index) => {
    const drawn = withVotes(pair, index === 0 ? votes : [])
    const lines = [
      { session: drawn.top, count: drawn.topVotes },
      { session: drawn.bottom, count: drawn.bottomVotes },
    ]
    return {
      key: pair.first.id,
      cells: [
        <WhenBlock at={pair.first.opensAt} live={false} />,
        <View className="gap-1.5 py-2">
          {lines.map(({ session, count }) =>
            session === null ? null : (
              <View key={session.id}>
                <ChallengeTitle modeId={session.modeId} />
                <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
                  {formatDayTime(session.opensAt)}
                  {count === null ? null : (
                    <>
                      {' · '}
                      <Plural value={count} one="# VOTE" other="# VOTES" />
                    </>
                  )}
                </Text>
              </View>
            ),
          )}
        </View>,
        <QueueMoves
          busy={moving}
          onUp={
            index === 0
              ? null
              : () => {
                  void move(pair.first.id, -1)
                }
          }
          onDown={
            index === queuedPairs.length - 1
              ? null
              : () => {
                  void move(pair.first.id, 1)
                }
          }
        />,
      ],
      onPress: () => {
        setEditingPair(drawn)
      },
      leads: false,
    }
  })

  // Live first, then the queue as pairs, then the past — the order `queueOrder` laid out.
  const status = (session: Session) => spanStatus(session, openedAt)
  const tableRows: readonly AdminTableRow[] = [
    ...shown.filter((session) => status(session) === 'live').map(rowOf),
    ...pairRows,
    ...shown.filter((session) => status(session) === 'expired').map(rowOf),
  ]

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
          label: `${FILTER_LABEL[option]} ${counts[option]}`,
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
            // The queue's two steps, stacked, on a planned row only.
            { width: 40, align: 'right' },
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
        <AdminPlanPair
          pastRuns={pastRunsByMode(rows, openedAt)}
          now={openedAt}
          pending={pending}
          onPlanned={changed}
          onDismiss={() => {
            setPlanning(false)
          }}
        />
      )}
    </AdminScreen>
  )
}
