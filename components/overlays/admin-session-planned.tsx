import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminCandidatesDialog } from '@/components/overlays/admin-candidates-dialog'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSessionVotes } from '@/components/overlays/admin-session-votes'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { listSessionVoters, type SessionVoter } from '@/lib/admin/session-detail'
import {
  cancelSession,
  editSession,
  type AdminSession as Session,
} from '@/lib/admin/sessions'
import type { PastRuns } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import { votesFor } from '@/lib/session-voting'

// A planned session's detail. Its date is the title, its ballot is what it shows — the
// challenge ahead and the other under it — and, while it is the one being **voted on**,
// the votes, a pie of them and who cast each. A planned session that is not being voted on
// yet shows the same names with none of that: no vote has been asked for.
//
// There is no select here. The two challenges are read, not edited in place; EDIT CHALLENGE
// opens the dialog with them filled in, which is also where an edit that would throw votes
// away asks first.
export function AdminSessionPlanned({
  session,
  voting,
  pastRuns,
  now,
  pending,
  onChanged,
  onBack,
}: {
  session: Session
  voting: boolean
  pastRuns: ReadonlyMap<string, PastRuns>
  now: number
  pending: ReadonlySet<string>
  onChanged: () => void
  onBack: () => void
}) {
  const [voters, setVoters] = useState<SessionVoter[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only the session being voted on has anyone to list.
  useEffect(() => {
    if (!voting) return
    void (async () => {
      setVoters(await listSessionVoters(session.id))
    })()
  }, [session.id, voting])

  // The votes are read again as the dialog opens, so the figure it asks about is the votes
  // there are now and not the ones there were when this screen did — and a read that has not
  // come back is waited for rather than skipped, which would have saved with no warning.
  const openEdit = async () => {
    if (voting) {
      setBusy(true)
      setVoters(await listSessionVoters(session.id))
      setBusy(false)
    }
    setEditing(true)
  }

  const remove = async () => {
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

  // The votes a change would throw away: those for whichever candidate leaves. What the
  // dialog asks about before it saves.
  const discards = (first: string, second: string | null) =>
    [session.modeId, session.altModeId].reduce(
      (lost, modeId) =>
        modeId === null || modeId === first || modeId === second
          ? lost
          : lost + votesFor(voters ?? [], modeId),
      0,
    )

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
          <PrimaryButton
            id="admin.session_edit_candidates"
            disabled={busy}
            onPress={() => {
              void openEdit()
            }}
            label={<Trans>EDIT CHALLENGE</Trans>}
          />
          <PrimaryButton
            id="admin.session_cancel"
            tone="danger"
            disabled={busy}
            onPress={() => {
              void remove()
            }}
            label={<Trans>REMOVE FROM QUEUE</Trans>}
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <AdminSessionVotes
          session={session}
          voters={voters}
          counted={voting}
          pie={voting}
          list={voting}
        />
      </ScrollView>

      {editing && (
        <AdminCandidatesDialog
          title={<Trans>EDIT CHALLENGE</Trans>}
          pastRuns={pastRuns}
          now={now}
          pending={pending}
          initial={{ first: session.modeId, second: session.altModeId }}
          discards={voting ? discards : undefined}
          onSave={async (first, second) => {
            const res = await editSession(session.id, first, second)
            if (res.error === null) {
              onChanged()
              onBack()
            }
            return res
          }}
          onDismiss={() => {
            setEditing(false)
          }}
        />
      )}
    </AdminScreen>
  )
}
