import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminExtendDialog } from '@/components/overlays/admin-extend-dialog'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSelect } from '@/components/overlays/admin-select'
import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { WhenRow } from '@/components/overlays/admin-when-row'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import {
  cancelSession,
  closeSessionEarly,
  editSession,
  extendSession,
  planSession,
  type AdminSession as Session,
} from '@/lib/admin/sessions'
import { spanStatus, type PastRuns } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import { timeAgo } from '@/lib/time-ago'
import { gradientOf } from '@/modes'
import { CHALLENGES } from '@/modes/challenges/catalog'
import { challengeInk } from '@/modes/challenges/palette'

// Which window is open over the form, if any. Both are confirmations rather than
// questions with more than one answer, and neither is a screen — see `AdminDialog`.
type Asking = 'close' | 'extend' | null

// One session, being planned or being corrected — and one form for both, because they
// differ only in whether there is a row behind it. `session` null is a new one.
//
// There is no span on this form any more. The server times the **queue** onto its noons
// (20261103000000_session_queue.sql), so a new session is a challenge put at the end of
// it and an existing one shows when it runs without offering to move it — its place in
// the queue is changed from the list, a step at a time.
const TITLE = msg`CHALLENGES`

// The mark beside each name in the challenge field, at the size the field's one line
// holds without growing.
const MARK_SIZE = 20

export function AdminSession({
  session,
  pastRuns,
  now,
  onChanged,
  onBack,
}: {
  session: Session | null
  // How many sessions of each challenge have closed and when the last one did, by
  // registry id — read off the rows the list already loaded, so the field's figures cost
  // no read of their own.
  pastRuns: ReadonlyMap<string, PastRuns>
  // The list's own clock, which the runs above were read against — so "1 mth ago" is
  // measured from the same moment that decided the session had closed.
  now: number
  onChanged: () => void
  // Where BACK, SAVE and CANCEL SESSION all end up. A session is opened from the list
  // and finished with on the list — closing the whole admin screen from here would take
  // away the thing the edit was about to be read against.
  onBack: () => void
}) {
  const { t } = useLingui()
  const [modeId, setModeId] = useState<string | null>(session?.modeId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState<Asking>(null)

  // Read once, the way the list reads its own: a window opening or closing while this
  // form is up must not change what the form will let the admin do halfway through it.
  const [openedAt] = useState(() => Date.now())

  // Whether a running window's two acts are on offer. About the clock, not the board:
  // EXTEND and CLOSE EARLY are things you do to a window that is open right now.
  const status = session === null ? null : spanStatus(session, openedAt)
  const live = status === 'live'

  // Whether the form may still rewrite this session. About the **board**, not the clock,
  // and it has to be: the server refuses a challenge or a span change once anybody has
  // scored, whatever the session's status, and allows both on a live session nobody has
  // touched — which is how an admin corrects a booking a minute after it opened. A form
  // locked on liveness would shut the door the server leaves open.
  const locked = session !== null && session.played > 0

  // Whether the challenge is still the form's to change. Not once anybody has scored, and
  // not once the session is over either, played or not: a past row is the record of what
  // ran, and re-pointing it would rewrite the run counts beside every challenge and the
  // auto-planner's idea of which one has gone longest without. Deleting an unplayed past
  // row stays on offer — that is `locked`'s, below — because taking a mistake away is not
  // rewriting history.
  const readOnly = locked || status === 'expired'

  // The challenge is the one thing left to say, so it is the one thing SAVE waits for.
  const canSave = modeId !== null && !busy

  const save = async () => {
    if (modeId === null) return
    setBusy(true)
    const res =
      session === null ? await planSession(modeId) : await editSession(session.id, modeId)
    setBusy(false)
    if (res.error !== null) {
      setError(res.error)
      return
    }
    onChanged()
    onBack()
  }

  // The three writes a row can take, all finishing the same way: back to the list, which
  // is the thing the change was about.
  const write = async (run: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const res = await run()
    setBusy(false)
    setAsking(null)
    if (res.error !== null) {
      setError(res.error)
      return
    }
    onChanged()
    onBack()
  }

  return (
    <AdminScreen
      title={t(TITLE)}
      error={error}
      footer={
        <View className="gap-2">
          {/* Nothing worth saving once the challenge is not the form's to change. */}
          {!readOnly && (
            <PrimaryButton
              id="admin.session_save"
              onPress={() => {
                void save()
              }}
              disabled={!canSave}
              label={<Trans>SAVE</Trans>}
            />
          )}
          {/* The two acts a running window allows, in the order they are reached for:
              giving it more time is the ordinary one, and shutting it is not. */}
          {live && (
            <>
              <PrimaryButton
                id="admin.session_extend"
                onPress={() => {
                  setAsking('extend')
                }}
                disabled={busy}
                label={<Trans>EXTEND</Trans>}
              />
              <PrimaryButton
                id="admin.session_close_early"
                tone="danger"
                onPress={() => {
                  setAsking('close')
                }}
                disabled={busy}
                label={<Trans>CLOSE EARLY</Trans>}
              />
            </>
          )}
          {/* Still offered whatever state the session is in, expired included — an admin
              who booked the wrong thing can take it away, and a guard stopping them would
              be preserving the mistake instead. What it no longer offers is deleting a
              **board**: the server refuses a row anybody has scored on, live or not, and
              a live row outright. Closing early is what a running window gets instead.

              Named for what it does to a queued row — the ones behind it move up a slot —
              and for what it is to one that already ran. The same RPC either way. */}
          {session !== null && !live && !locked && (
            <PrimaryButton
              id="admin.session_cancel"
              tone="danger"
              onPress={() => {
                void write(() => cancelSession(session.id))
              }}
              disabled={busy}
              label={
                status === 'upcoming' ? (
                  <Trans>REMOVE FROM QUEUE</Trans>
                ) : (
                  <Trans>CANCEL SESSION</Trans>
                )
              }
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
        <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
          <Trans>CHALLENGE</Trans>
        </Text>
        {/* Every challenge ever written, not only the ones whose compiled window happens
            to be open — the whole point of a session is that when a challenge is on stops
            being a build-time fact, so a picker filtered by the old windows would offer
            the one thing nobody needs to plan.

            Each with its mark and its own colours, which is how a player knows it on the
            card, how many times it has already run and how long ago it last did — the
            figures an admin choosing the next one is choosing by. */}
        <AdminSelect
          title={<Trans>CHALLENGE</Trans>}
          // A booking for a challenge this build does not carry names it by its id, the
          // way the list does, rather than claiming nothing is chosen.
          placeholder={modeId ?? <Trans>CHOOSE A CHALLENGE</Trans>}
          value={modeId}
          onSelect={setModeId}
          disabled={busy || readOnly}
          options={CHALLENGES.map((challenge) => {
            // Sessions, not runs: a run is one game, and this counts closed sessions.
            const runs = pastRuns.get(challenge.id)
            const sessions = runs?.count ?? 0
            return {
              value: challenge.id,
              icon: (
                <ChallengeMark
                  modeId={challenge.id}
                  color={challengeInk(gradientOf(challenge.id)[1])}
                  size={MARK_SIZE}
                />
              ),
              label: <ChallengeTitle modeId={challenge.id} className={TYPE.buttonSm} />,
              note:
                runs === undefined
                  ? undefined
                  : (timeAgo(runs.lastClosedAt, now) ?? undefined),
              detail: <Plural value={sessions} one="# SESSION" other="# SESSIONS" />,
            }
          })}
        />

        {/* When it runs, stated rather than offered: the queue sets it. A new session has
            no row yet and so no time to state — it lands at the end of the queue, and the
            list it returns to shows where. If it is live, EXTEND in the footer is the one
            way the end still moves. */}
        {session !== null && (
          <View className="mt-4 gap-2">
            <WhenRow label={<Trans>STARTS</Trans>} at={formatDayTime(session.opensAt)} />
            <WhenRow label={<Trans>ENDS</Trans>} at={formatDayTime(session.closesAt)} />
          </View>
        )}
      </ScrollView>

      {asking === 'extend' && (
        <AdminExtendDialog
          busy={busy}
          onConfirm={(minutes) => {
            if (session === null) return
            void write(() => extendSession(session.id, minutes))
          }}
          onDismiss={() => {
            setAsking(null)
          }}
        />
      )}

      {asking === 'close' && (
        <AdminDialog
          title={<Trans>CLOSE THIS CHALLENGE NOW?</Trans>}
          onDismiss={() => {
            setAsking(null)
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
              if (session === null) return
              void write(() => closeSessionEarly(session.id))
            }}
            label={<Trans>CLOSE EARLY</Trans>}
          />
        </AdminDialog>
      )}
    </AdminScreen>
  )
}
