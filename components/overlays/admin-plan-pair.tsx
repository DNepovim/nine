import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { challengeOptions } from '@/components/overlays/admin-challenge-options'
import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminSelect } from '@/components/overlays/admin-select'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { planPair } from '@/lib/admin/sessions'
import type { PastRuns } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'

// PLAN SESSION: two candidates, booked together at the end of the queue as a **pair** —
// the next two the players will be asked to choose between. A dialog and not a screen: it
// asks two things and the list behind it is what the answer changes.
export function AdminPlanPair({
  pastRuns,
  now,
  pending,
  onPlanned,
  onDismiss,
}: {
  pastRuns: ReadonlyMap<string, PastRuns>
  now: number
  pending: ReadonlySet<string>
  onPlanned: () => void
  onDismiss: () => void
}) {
  const [first, setFirst] = useState<string | null>(null)
  const [second, setSecond] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = challengeOptions({ pastRuns, now, pending })
  // Two different challenges: the same one twice is not a choice. Said on the dialog, ahead
  // of the server, which refuses it as well.
  const same = first !== null && first === second
  const canSave = first !== null && second !== null && !same && !busy

  const save = async () => {
    if (first === null || second === null) return
    setBusy(true)
    const res = await planPair(first, second)
    setBusy(false)
    if (res.error !== null) {
      setError(res.error)
      return
    }
    onPlanned()
    onDismiss()
  }

  return (
    <AdminDialog title={<Trans>PLAN SESSION</Trans>} onDismiss={onDismiss} held>
      <View className="gap-2.5">
        <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
          <Trans>FIRST CANDIDATE</Trans>
        </Text>
        <AdminSelect
          title={<Trans>FIRST CANDIDATE</Trans>}
          placeholder={<Trans>CHOOSE A CHALLENGE</Trans>}
          value={first}
          onSelect={setFirst}
          disabled={busy}
          options={options}
        />
        <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
          <Trans>SECOND CANDIDATE</Trans>
        </Text>
        <AdminSelect
          title={<Trans>SECOND CANDIDATE</Trans>}
          placeholder={<Trans>CHOOSE A CHALLENGE</Trans>}
          value={second}
          onSelect={setSecond}
          disabled={busy}
          options={options}
        />
        {(same || error !== null) && (
          <Text selectable={false} className={cn(TYPE.hint, 'text-red-500')}>
            {same ? <Trans>Pick two different challenges.</Trans> : error}
          </Text>
        )}
        <PrimaryButton
          id="admin.plan_pair_save"
          disabled={!canSave}
          onPress={() => {
            void save()
          }}
          label={<Trans>SAVE</Trans>}
        />
        <PrimaryButton
          id="admin.plan_pair_cancel"
          tone="quiet"
          onPress={onDismiss}
          label={<Trans>CANCEL</Trans>}
        />
      </View>
    </AdminDialog>
  )
}
