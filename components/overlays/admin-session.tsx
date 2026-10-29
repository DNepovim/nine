import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { DateTimeField } from '@/components/date-time-field'
import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminExtendDialog } from '@/components/overlays/admin-extend-dialog'
import { AdminPills } from '@/components/overlays/admin-pills'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { WhenRow } from '@/components/overlays/admin-when-row'
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
import {
  defaultSpan,
  isValidSpan,
  spanStatus,
  withClosesAt,
  withOpensAt,
  type SessionSpan,
} from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import { CHALLENGES } from '@/modes/challenges/catalog'

// Which window is open over the form, if any. Both are confirmations rather than
// questions with more than one answer, and neither is a screen — see `AdminDialog`.
type Asking = 'close' | 'extend' | null

// One session, being planned or being corrected — and one form for both, because they
// differ only in whether there is a row behind it. `session` null is a new one.
//
// The span lives here rather than in the two fields. That is what lets the start move
// the end: a field holding its own draft could only ever report its own value, and the
// rule that the span is preserved when the start is dragged is a fact about the pair.
const TITLE = msg`CHALLENGES`

export function AdminSession({
  session,
  lastClosesAt,
  onChanged,
  onBack,
}: {
  session: Session | null
  // When the latest booked session closes, or null with none — where a new one's start
  // is prefilled from. Unused when editing.
  lastClosesAt: number | null
  onChanged: () => void
  // Where BACK, SAVE and CANCEL SESSION all end up. A session is opened from the list
  // and finished with on the list — closing the whole admin screen from here would take
  // away the thing the edit was about to be read against.
  onBack: () => void
}) {
  const { t } = useLingui()
  // The first noon after the last booking, for a new one — see `defaultSpan`. Read once on mount:
  // the default is a function of *when the form was opened*, and recomputing it per
  // render would move the fields under the admin at midnight.
  const [span, setSpan] = useState<SessionSpan>(() =>
    session === null
      ? defaultSpan(Date.now(), lastClosesAt)
      : { opensAt: session.opensAt, closesAt: session.closesAt },
  )
  const [modeId, setModeId] = useState<string | null>(session?.modeId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState<Asking>(null)

  // Read once, the way the list reads its own: a window opening or closing while this
  // form is up must not change what the form will let the admin do halfway through it.
  const [openedAt] = useState(() => Date.now())

  // Whether a running window's two acts are on offer. About the clock, not the board:
  // EXTEND and CLOSE EARLY are things you do to a window that is open right now.
  const live = session !== null && spanStatus(session, openedAt) === 'live'

  // Whether the form may still rewrite this session. About the **board**, not the clock,
  // and it has to be: the server refuses a challenge or a span change once anybody has
  // scored, whatever the session's status, and allows both on a live session nobody has
  // touched — which is how an admin corrects a booking a minute after it opened. A form
  // locked on liveness would shut the door the server leaves open.
  const locked = session !== null && session.played > 0

  const valid = isValidSpan(span)
  // The challenge is the one thing a session cannot be saved without. The span always
  // has an answer — it opens on one — so SAVE is shut only for an end that is not after
  // its start, and for a session nobody has said which challenge it is for.
  const canSave = valid && modeId !== null && !busy

  const save = async () => {
    if (modeId === null) return
    setBusy(true)
    const res =
      session === null
        ? await planSession(modeId, span)
        : await editSession(session.id, modeId, span)
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
          {/* Nothing worth saving once anybody has scored: the server refuses both the
              challenge and the span. */}
          {!locked && (
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
              a live row outright. Closing early is what a running window gets instead. */}
          {session !== null && !live && !locked && (
            <PrimaryButton
              id="admin.session_cancel"
              tone="danger"
              onPress={() => {
                void write(() => cancelSession(session.id))
              }}
              disabled={busy}
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
        <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
          <Trans>CHALLENGE</Trans>
        </Text>
        {/* Every challenge ever written, not only the ones whose compiled window happens
            to be open — the whole point of a session is that when a challenge is on stops
            being a build-time fact, so a picker filtered by the old windows would offer
            the one thing nobody needs to plan. */}
        <AdminPills
          id="admin.session_challenge"
          value={modeId}
          onSelect={setModeId}
          // A challenge cannot change once anybody has scored — `busy` is what this
          // control has for "do not answer".
          busy={busy || locked}
          options={CHALLENGES.map((challenge) => ({
            value: challenge.id,
            label: t(challenge.label),
          }))}
        />

        {/* A played session's span is drawn rather than offered. Read-only rows rather
            than pickers that refuse on tap: the fields are the clearest place to say that
            this window is no longer the form's to move, and discovering it by tapping is
            worse than being told. If it is also live, EXTEND is in the footer and is the
            one way the end still moves. */}
        {locked ? (
          <View className="mt-4 gap-2">
            <WhenRow label={<Trans>STARTS</Trans>} at={formatDayTime(span.opensAt)} />
            <WhenRow label={<Trans>ENDS</Trans>} at={formatDayTime(span.closesAt)} />
          </View>
        ) : (
          <View className="mt-4">
            {/* Moving the start takes the end with it, keeping the length the admin set —
                so booking the same window a day later is one change rather than two. The
                end moves alone, because changing it *is* asking for a different length. */}
            <DateTimeField
              label={<Trans>STARTS</Trans>}
              value={span.opensAt}
              onChange={(next) => {
                setSpan((current) => withOpensAt(current, next))
              }}
            />
            <DateTimeField
              label={<Trans>ENDS</Trans>}
              value={span.closesAt}
              // Only the end is marked. The pair is what is wrong, but the end is the half
              // the admin has to move to fix it — the start is whatever they meant it to be.
              invalid={!valid}
              onChange={(next) => {
                setSpan((current) => withClosesAt(current, next))
              }}
            />
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
