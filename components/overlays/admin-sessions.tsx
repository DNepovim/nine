import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminPills } from '@/components/overlays/admin-pills'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSession } from '@/components/overlays/admin-session'
import {
  ChallengeTitle,
  StatusChip,
  WhenBlock,
} from '@/components/overlays/admin-session-cells'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { refreshOpenSessions } from '@/hooks/use-open-sessions'
import { listSessions, type AdminSession as Session } from '@/lib/admin/sessions'
import { shownByStatus, spanStatus, type SpanStatus } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatWindowLength } from '@/lib/duration'

// When a challenge is on: every session ever planned, newest start first.
//
// The second half of the admin hub, and the half that did not exist before — a
// challenge's window used to be two timestamps in the bundle. Nothing here resolves a
// session into the rules a run is played under; that is the next phase. What this screen
// decides is only what the server holds.
//
// The form is state here rather than a screen of its own for the reason `AdminAccess`
// holds its person and its role: a session is reached from this list and goes back to
// it, and one BACK has to work for both a new session and an existing one.
//
// `'new'` rather than a second flag. The form is one form — plan and edit differ in
// whether there is a row behind it, and in nothing a reader can see.
type Editing = Session | 'new' | null

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

// Not translated, the way `STATUS_LABEL` beside it is not: these name the state of a
// database row on a screen whose readers are the people who write the catalog. Shorter
// than the chips they filter, because four of them share one row.
const FILTER_LABEL = {
  live: 'LIVE',
  upcoming: 'PLANNED',
  expired: 'PAST',
} as const satisfies Record<SpanStatus, string>

export function AdminSessions({ onBack }: { onBack: () => void }) {
  const { t } = useLingui()
  const [rows, setRows] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
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
  // behind us and still reads `live` against the old clock — keeping its LIVE chip and
  // its dot, still counting under the LIVE filter, and offering EXTEND on a form whose
  // writes the server now refuses. The clock has to move when the rows do.
  const [openedAt, setOpenedAt] = useState(() => Date.now())

  useEffect(() => {
    void (async () => {
      const res = await listSessions()
      setOpenedAt(Date.now())
      setRows(res.rows)
      setError(res.error)
      setLoading(false)
    })()
    // `epoch` bumps after the form's writes as well. Only the first read has nothing to
    // draw, and `loading` is never set back to true, so a save does not blank the list.
  }, [epoch])

  if (editing !== null) {
    return (
      <AdminSession
        session={editing === 'new' ? null : editing}
        lastClosesAt={
          editing === 'new' && rows.length > 0
            ? rows.reduce((latest, row) => Math.max(latest, row.closesAt), 0)
            : null
        }
        onChanged={() => {
          setEpoch((n) => n + 1)
          // The intro's card reads its sessions once a launch; a booking is the one
          // thing that has to reach it without one.
          refreshOpenSessions()
        }}
        onBack={() => {
          setEditing(null)
        }}
      />
    )
  }

  // One pass for all three chips rather than one pass each. The list is tens of rows, so
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

  const shown = shownByStatus(rows, lit, openedAt)

  // One planned session per row: which challenge, when it opens, how long it runs, and
  // where that span stands against now.
  //
  // A row whose challenge this build has never heard of is drawn rather than hidden, and
  // drawn as what it is — the raw id and NOT IN THIS BUILD, because `labelOf` would
  // answer GAME for it and a list of sessions all called GAME is worse than useless.
  // Still pressable: a row booked for a challenge that has been taken out of the catalog
  // is exactly the row somebody needs to open and cancel.
  const tableRows: readonly AdminTableRow[] = shown.map((session) => {
    const status = spanStatus(session, openedAt)
    return {
      key: session.id,
      // Dimmed once it is over. An expired session is kept — it is the record of what
      // ran — but it is not what a reader scanning this list is looking for.
      faded: status === 'expired',
      cells: [
        <WhenBlock at={session.opensAt} />,
        <View>
          <ChallengeTitle modeId={session.modeId} />
          <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
            {formatWindowLength(session.closesAt - session.opensAt)}
          </Text>
        </View>,
        <StatusChip status={status} />,
      ],
      onPress: () => {
        setEditing(session)
      },
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
              setEditing('new')
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
            { width: 36 },
            { label: 'CHALLENGE', tone: 'name' },
            { width: 72, align: 'right' },
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
    </AdminScreen>
  )
}
