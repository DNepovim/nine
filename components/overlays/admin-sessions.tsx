import { Ionicons } from '@expo/vector-icons'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { GradientText } from '@/components/gradient-text'
import { AdminPills } from '@/components/overlays/admin-pills'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSession } from '@/components/overlays/admin-session'
import {
  AdminChip,
  AdminTable,
  type AdminTableRow,
} from '@/components/overlays/admin-table'
import { TeaserModal } from '@/components/overlays/admin-teaser-modal'
import { LiveDot } from '@/components/overlays/live-dot'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { listSessions, type AdminSession as Session } from '@/lib/admin/sessions'
import {
  shownByStatus,
  spanStatus,
  STATUS_LABEL,
  type SpanStatus,
} from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatWindowLength } from '@/lib/duration'
import { dayAndMonth } from '@/lib/format-date'
import { gradientOf, labelOf, modeById } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

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

// How loud each status is drawn. LIVE is the filled one and the only one with a mark
// beside it — it is the row that is in front of players this minute, and the only one on
// this list where that is true.
const STATUS_TONE: Record<SpanStatus, 'filled' | 'strong' | 'quiet'> = {
  live: 'filled',
  upcoming: 'strong',
  expired: 'quiet',
}

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

// The date a session opens, as a block: the day as a figure with its month under it.
//
// The whole range used to be spelled out on one line — `15 Oct 12:00 → 16 Oct 12:00`,
// which is four facts in a row where a reader scanning the list wants one. The day it
// starts is what a session is filed under; how long it runs is said once, under the name,
// by `formatWindowLength`; and the exact minutes are on the form behind the row, which is
// where somebody who cares about them is going.
function WhenBlock({ at }: { at: number }) {
  const { day, month } = dayAndMonth(at)
  return (
    <View className="w-9 items-center">
      <Text selectable={false} className={cn(TYPE.figureLarge, 'text-primary')}>
        {day}
      </Text>
      <Text selectable={false} className={cn(TYPE.caption, '-mt-0.5 text-dim')}>
        {month}
      </Text>
    </View>
  )
}

export function AdminSessions({ onBack }: { onBack: () => void }) {
  const { t } = useLingui()
  const [rows, setRows] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [lit, setLit] = useState<ReadonlySet<SpanStatus>>(() => new Set(LIT_ON_ARRIVAL))
  const [tuning, setTuning] = useState(false)

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
        onChanged={() => {
          setEpoch((n) => n + 1)
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
    const known = modeById(session.modeId) !== null
    return {
      key: session.id,
      // Dimmed once it is over. An expired session is kept — it is the record of what
      // ran — but it is not what a reader scanning this list is looking for.
      faded: status === 'expired',
      cells: [
        <WhenBlock at={session.opensAt} />,
        <View>
          {/* The challenge's own name in the challenge's own colours, which is the one
              place on these screens a hue carries a word. A session list reads as a list
              of dates otherwise — and a challenge *is* its colour on the intro, on its
              card and on the screen a run of it ends on, so it is what the row is
              recognised by here too.

              Through `challengeInk` rather than the raw pair: the second stop is the
              bright end of the arc and measures about 1.7:1 on this surface, so a name
              lerped onto it would fade out as it was read. See the note at that function
              — the same bargain `NAME_INK` strikes for a nickname. */}
          {known ? (
            <GradientText
              text={t(labelOf(session.modeId))}
              from={challengeInk(gradientOf(session.modeId)[0])}
              to={challengeInk(gradientOf(session.modeId)[1])}
              numberOfLines={1}
              className={TYPE.cardTitleSm}
            />
          ) : (
            <Text
              selectable={false}
              numberOfLines={1}
              className={cn(TYPE.cardTitleSm, 'text-dim')}
            >
              {session.modeId}
            </Text>
          )}
          <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
            {formatWindowLength(session.closesAt - session.opensAt)}
          </Text>
          {!known && (
            <Text selectable={false} className={cn(TYPE.hint, 'text-red-500')}>
              ⚠ <Trans>NOT IN THIS BUILD</Trans>
            </Text>
          )}
        </View>,
        <AdminChip
          label={STATUS_LABEL[status]}
          tone={STATUS_TONE[status]}
          icon={status === 'live' ? <LiveDot /> : undefined}
        />,
      ],
      onPress: () => {
        setEditing(session)
      },
    }
  })

  return (
    <AdminScreen
      // A heading rather than a title, because the row has a second thing in it now: the
      // general teaser figure used to sit above the filters as a labelled field, which put
      // a number somebody sets once a year in front of the list every time they opened it.
      // Behind a cog it is still one press away and no longer in the way.
      heading={
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <Text selectable={false} className={cn(TYPE.screenTitle, 'text-primary')}>
            {t(TITLE)}
          </Text>
          <TrackedPressable
            id="admin.session_settings"
            onPress={() => {
              setTuning(true)
            }}
            // 40 square, the thumb target the rest of these screens settled on, with the
            // glyph smaller than its box rather than the box shrunk to the glyph.
            className="h-10 w-10 items-center justify-center rounded-xl border border-muted bg-surface"
          >
            <Ionicons name="settings-outline" size={18} color={DIM_INK} />
          </TrackedPressable>
        </View>
      }
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

      {tuning && (
        <TeaserModal
          onDismiss={() => {
            setTuning(false)
          }}
        />
      )}
    </AdminScreen>
  )
}
