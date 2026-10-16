import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminNumberField } from '@/components/overlays/admin-number-field'
import { PrimaryButton } from '@/components/primary-button'

// How much more time, in the two units an admin actually thinks in.
//
// Hours and minutes rather than one figure, because "an hour and a half" is two fields
// and one sum, and the sum belongs here rather than in `extendSession` — the server takes
// minutes, which is the only unit that does not need a second one beside it to be exact.
//
// No ceiling. The overlap rule is the real limit, and it is the server's: an extension
// that would run into another booking of the same challenge is refused there, with the
// same message planning and editing give. A cap here would be a second, worse opinion
// about the same question.
function minutesFrom(hours: string, minutes: string): number {
  const h = Number.parseInt(hours, 10)
  const m = Number.parseInt(minutes, 10)
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m)
}

export function AdminExtendDialog({
  busy,
  onConfirm,
  onDismiss,
}: {
  busy: boolean
  onConfirm: (minutes: number) => void
  onDismiss: () => void
}) {
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')

  const total = minutesFrom(hours, minutes)

  return (
    <AdminDialog title={<Trans>GIVE MORE TIME</Trans>} onDismiss={onDismiss}>
      <View className="mb-2.5 flex-row gap-2">
        <AdminNumberField
          label={<Trans>HOURS</Trans>}
          value={hours}
          onChange={setHours}
        />
        <AdminNumberField
          label={<Trans>MINUTES</Trans>}
          value={minutes}
          onChange={setMinutes}
        />
      </View>
      {/* Shut on nothing typed, which the server would refuse anyway — it wants a positive
          figure. Better refused here, where the admin can see which field is empty. */}
      <PrimaryButton
        id="admin.session_extend_confirm"
        disabled={busy || total <= 0}
        onPress={() => {
          onConfirm(total)
        }}
        label={<Trans>CONFIRM</Trans>}
      />
    </AdminDialog>
  )
}
