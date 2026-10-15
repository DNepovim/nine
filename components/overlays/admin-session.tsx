import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { DateTimeField } from '@/components/date-time-field'
import { AdminPills } from '@/components/overlays/admin-pills'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import {
  cancelSession,
  editSession,
  planSession,
  type AdminSession as Session,
} from '@/lib/admin/sessions'
import {
  defaultSpan,
  isValidSpan,
  withClosesAt,
  withOpensAt,
  type SessionSpan,
} from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { CHALLENGES } from '@/modes/challenges/catalog'

// One session, being planned or being corrected — and one form for both, because they
// differ only in whether there is a row behind it. `session` null is a new one.
//
// The span lives here rather than in the two fields. That is what lets the start move
// the end: a field holding its own draft could only ever report its own value, and the
// rule that the span is preserved when the start is dragged is a fact about the pair.
const TITLE = msg`CHALLENGES`

export function AdminSession({
  session,
  onChanged,
  onBack,
}: {
  session: Session | null
  onChanged: () => void
  // Where BACK, SAVE and CANCEL SESSION all end up. A session is opened from the list
  // and finished with on the list — closing the whole admin screen from here would take
  // away the thing the edit was about to be read against.
  onBack: () => void
}) {
  const { t } = useLingui()
  // Tomorrow at noon through the day after at noon, for a new one. Read once on mount:
  // the default is a function of *when the form was opened*, and recomputing it per
  // render would move the fields under the admin at midnight.
  const [span, setSpan] = useState<SessionSpan>(() =>
    session === null
      ? defaultSpan(Date.now())
      : { opensAt: session.opensAt, closesAt: session.closesAt },
  )
  const [modeId, setModeId] = useState<string | null>(session?.modeId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const cancel = async () => {
    if (session === null) return
    setBusy(true)
    const res = await cancelSession(session.id)
    setBusy(false)
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
          <PrimaryButton
            id="admin.session_save"
            onPress={() => {
              void save()
            }}
            disabled={!canSave}
            label={<Trans>SAVE</Trans>}
          />
          {/* Offered whatever state the session is in, expired included. An expired
              session is the record of what ran and nothing deletes one on its own — but
              an admin who booked the wrong thing can take it away, and a guard stopping
              them would be preserving the mistake instead. */}
          {session !== null && (
            <PrimaryButton
              id="admin.session_cancel"
              tone="danger"
              onPress={() => {
                void cancel()
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
          options={CHALLENGES.map((challenge) => ({
            value: challenge.id,
            label: t(challenge.label),
          }))}
        />

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
      </ScrollView>
    </AdminScreen>
  )
}
