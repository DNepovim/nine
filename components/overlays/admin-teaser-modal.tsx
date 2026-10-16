import { Trans } from '@lingui/react/macro'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminNumberField } from '@/components/overlays/admin-number-field'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { loadSettings, setSetting, TEASER_MINUTES } from '@/lib/admin/settings'
import { cn } from '@/lib/cn'
import { minutesAsHours } from '@/lib/duration'

// The one general figure the planner carries: how long before it opens a session starts
// announcing itself, for every session that does not say otherwise.
//
// Behind the cog on the planner's own title row rather than in a settings section of its
// own, which is the shape the hub would have grown for one number — and rather than a
// field above the list, which is where it started: a figure somebody sets once and then
// leaves alone does not belong in front of the list every time the screen opens. The
// second general figure is what earns a section; until then this belongs to the screen it
// is about, one press away.
//
// **Hours here, minutes in the column** — see `minutesAsHours`, which owns that
// conversion and the one consequence worth knowing about it.
//
// Committed by its own button rather than on blur, which is the one thing that changed
// when this became a window: a dialog is answered by answering it, so the figure is saved
// by the same press that closes it. See `AdminDialog`.
export function TeaserModal({ onDismiss }: { onDismiss: () => void }) {
  // The field's text, not the figure. Held as a string so a half-typed value is the
  // admin's to finish — parsing per keystroke would turn "1" into an hour the moment they
  // started typing "12".
  const [hours, setHours] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  // Whatever the server last refused, said out loud. A dialog has no error slot the way
  // `AdminScreen` does, so it carries its own — and it has to, because every failure here
  // is otherwise silent: a read that fails leaves the field disabled with no figure in it,
  // and a write that fails leaves the window open having apparently done nothing.
  const [error, setError] = useState<string | null>(null)

  // Dropped the way every other async read in the app is — `use-session-card.ts` and
  // `use-board.ts` both keep one. This window is dismissable while its read is in flight.
  const dropped = useRef(false)

  useEffect(() => {
    dropped.current = false
    void (async () => {
      const res = await loadSettings()
      if (dropped.current) return
      if (res.error !== null) {
        setError(res.error)
        return
      }
      const minutes = res.values.get(TEASER_MINUTES)
      if (minutes === undefined) {
        // A row the migration seeds and nothing deletes. If it is gone the resolve falls
        // back to its own literal, so the app is unharmed — but this window cannot set
        // what it cannot read, and saying so beats a disabled field.
        setError(`no ${TEASER_MINUTES} setting on the server`)
        return
      }
      setSaved(minutes)
      setHours(minutesAsHours(minutes))
    })()
    return () => {
      dropped.current = true
    }
  }, [])

  const typed = Number.parseInt(hours, 10)
  const valid = !Number.isNaN(typed) && typed >= 0

  const commit = async () => {
    if (!valid) return
    const minutes = typed * 60
    if (minutes === saved) {
      onDismiss()
      return
    }
    setBusy(true)
    setError(null)
    const res = await setSetting(TEASER_MINUTES, minutes)
    setBusy(false)
    if (res.error !== null) {
      setError(res.error)
      return
    }
    setSaved(minutes)
    onDismiss()
  }

  return (
    <AdminDialog title={<Trans>ANNOUNCE AHEAD</Trans>} onDismiss={onDismiss}>
      <Text selectable={false} className={cn(TYPE.hint, 'mb-2.5 text-dim')}>
        <Trans>
          How long before it opens a challenge starts announcing itself, for every session
          that does not set its own.
        </Trans>
      </Text>
      {error !== null && (
        <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-red-500')}>
          {error}
        </Text>
      )}
      <View className="mb-2.5">
        <AdminNumberField
          label={<Trans>HOURS</Trans>}
          value={hours}
          onChange={setHours}
          editable={!busy && saved !== null}
        />
      </View>
      <PrimaryButton
        id="admin.session_settings_save"
        disabled={busy || saved === null || !valid}
        onPress={() => {
          void commit()
        }}
        label={<Trans>SAVE</Trans>}
      />
    </AdminDialog>
  )
}
