import { Plural, Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSessionVotes } from '@/components/overlays/admin-session-votes'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import {
  listSessionRunCounts,
  listSessionVoters,
  type SessionRunCount,
  type SessionVoter,
} from '@/lib/admin/session-detail'
import {
  cancelSession,
  closeSessionEarly,
  type AdminSession as Session,
} from '@/lib/admin/sessions'
import { spanStatus } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import type { LeaderboardRow } from '@/lib/leaderboard'
import { loadSessionBoard } from '@/lib/session-board'
import { sessionFigure } from '@/lib/session-figure'
import { measureOf } from '@/modes'

// How long the server keeps a run's receipt (`cleanup_run_receipts`). Past it the per-player
// counts are gone, and a RUNS table that read "No runs yet." under a full standings table would
// say the opposite of what happened.
const RECEIPT_DAYS = 30
const DAY_MS = 86_400_000

// A running or finished session's detail: a record, not a form. Its date is the title, the
// challenge it ran is under it with the other candidate smaller beside the final votes, and
// under that the standings, how many runs there were and how many each player made.
//
// The challenge cannot be changed — it is the one being played, or the one that was — and
// the window cannot be lengthened here. What a running session still allows is shutting it
// now; what a finished one nobody played still allows is taking it away.
export function AdminSessionLive({
  session,
  now,
  onChanged,
  onBack,
}: {
  session: Session
  now: number
  onChanged: () => void
  onBack: () => void
}) {
  const [voters, setVoters] = useState<SessionVoter[] | null>(null)
  const [board, setBoard] = useState<LeaderboardRow[]>([])
  const [counts, setCounts] = useState<SessionRunCount[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const live = spanStatus(session, now) === 'live'
  const measure = measureOf(session.modeId)

  // Read once on open. None of the three can fail loudly: the page is complete without a
  // list the server refused or could not give.
  useEffect(() => {
    void (async () => {
      const [v, b, c] = await Promise.all([
        listSessionVoters(session.id),
        loadSessionBoard(session.id),
        listSessionRunCounts(session.id),
      ])
      setVoters(v)
      setBoard(b.rows)
      setCounts(c)
      setLoading(false)
    })()
  }, [session.id])

  const write = async (run: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const res = await run()
    setBusy(false)
    setAsking(false)
    if (res.error !== null) {
      setError(res.error)
      return
    }
    onChanged()
    onBack()
  }

  const boardRows: readonly AdminTableRow[] = board.map((row) => ({
    key: row.user_id,
    cells: [
      String(row.rank),
      row.nickname,
      sessionFigure(measure, {
        score: row.best_score,
        hits: row.hits,
        timeMs: row.time_ms ?? null,
      }),
    ],
  }))
  const runRows: readonly AdminTableRow[] = (counts ?? []).map((row) => ({
    key: row.userId,
    cells: [row.nickname ?? '—', String(row.runs)],
  }))
  const totalRuns = (counts ?? []).reduce((sum, row) => sum + row.runs, 0)

  return (
    <AdminScreen
      error={error}
      heading={
        <Text selectable={false} className={cn(TYPE.screenTitle, 'mb-3 text-primary')}>
          {formatDayTime(session.opensAt)}
        </Text>
      }
      footer={
        <View className="gap-2">
          {live && (
            <PrimaryButton
              id="admin.session_close_early"
              tone="danger"
              disabled={busy}
              onPress={() => {
                setAsking(true)
              }}
              label={<Trans>CLOSE EARLY</Trans>}
            />
          )}
          {/* Still offered for a finished session nobody played — an admin who booked the
              wrong thing can take it away. What it no longer offers is deleting a board:
              the server refuses a row anybody has scored on, and a live row outright. */}
          {!live && session.played === 0 && (
            <PrimaryButton
              id="admin.session_cancel"
              tone="danger"
              disabled={busy}
              onPress={() => {
                void write(() => cancelSession(session.id))
              }}
              label={<Trans>CANCEL SESSION</Trans>}
            />
          )}
          <PrimaryButton
            id="admin.back"
            tone="quiet"
            onPress={onBack}
            label={<Trans>BACK</Trans>}
          />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <AdminSessionVotes session={session} voters={voters} counted />

        <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 mt-5 text-dim')}>
          <Trans>STANDINGS</Trans>
        </Text>
        <AdminTable
          loading={loading}
          columns={[
            { label: '#', width: 28 },
            { label: 'PLAYER', tone: 'name' },
            { label: 'BEST', width: 90, align: 'right', tone: 'figure' },
          ]}
          rows={boardRows}
          empty={<Trans>Nobody has played yet.</Trans>}
        />

        {counts !== null && now - session.closesAt < RECEIPT_DAYS * DAY_MS && (
          <>
            <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 mt-5 text-dim')}>
              <Trans>RUNS</Trans>
              {' · '}
              <Plural value={totalRuns} one="# run" other="# runs" />
            </Text>
            <AdminTable
              loading={loading}
              columns={[
                { label: 'PLAYER', tone: 'name' },
                { label: 'RUNS', width: 60, align: 'right', tone: 'figure' },
              ]}
              rows={runRows}
              empty={<Trans>No runs yet.</Trans>}
            />
          </>
        )}
      </ScrollView>

      {asking && (
        <AdminDialog
          title={<Trans>CLOSE THIS CHALLENGE NOW?</Trans>}
          onDismiss={() => {
            setAsking(false)
          }}
        >
          <Text selectable={false} className={cn(TYPE.hint, 'mb-2.5 text-dim')}>
            <Trans>
              The standings stay exactly as they are and the places settle now. This
              cannot be undone — running it again is a new session, with a board of its
              own.
            </Trans>
          </Text>
          <PrimaryButton
            id="admin.session_close_confirm"
            tone="danger"
            disabled={busy}
            onPress={() => {
              void write(() => closeSessionEarly(session.id))
            }}
            label={<Trans>CLOSE EARLY</Trans>}
          />
        </AdminDialog>
      )}
    </AdminScreen>
  )
}
