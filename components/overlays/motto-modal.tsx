import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'

import { cn } from '@/lib/cn'
import { MOTTO_MAX, mottoLength, normalizeMotto } from '@/lib/motto'

// Writing the motto. Mounted only while it is open, so the field always starts from what
// is stored rather than from whatever was typed and abandoned last time.
//
// A plain `Modal` rather than the app's `ModalCard`, and the one place that is the right
// call: this opens on top of the profile card with a keyboard under it, and a real
// platform modal is what gets `KeyboardAvoidingView` a window of its own to lift inside.
// The same trade `NicknameModal` makes, for the same reason.
export function MottoModal({
  motto,
  onSave,
  onCancel,
}: {
  motto: string | null
  // Null removes the motto. Resolves once the write has landed; the parent closes this.
  onSave: (motto: string | null) => Promise<{ error: string | null }>
  onCancel: () => void
}) {
  // `t` rather than <Trans>: a placeholder and an error string are strings, not nodes.
  const { t } = useLingui()
  const [value, setValue] = useState(motto ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const next = normalizeMotto(value)
  const used = mottoLength(next)
  const tooLong = used > MOTTO_MAX
  // Clearing the field on a player who has one is how a motto is taken down — there is no
  // separate delete, and the button says so rather than leaving them to guess.
  const removing = motto !== null && next === ''

  const handleSave = async () => {
    if (tooLong) {
      setError(t`That is longer than ${MOTTO_MAX} characters.`)
      return
    }
    setSaving(true)
    const res = await onSave(next === '' ? null : next)
    setSaving(false)
    if (res.error !== null) setError(t`Something went wrong, try again`)
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        className="flex-1 items-center justify-center bg-black/60 px-8"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="w-full max-w-xs rounded-2xl bg-card p-6">
          <Text
            selectable={false}
            className="mb-1 font-mono text-[11px] font-black tracking-[2px] text-primary"
          >
            <Trans>YOUR MOTTO</Trans>
          </Text>
          <Text
            selectable={false}
            className="mb-4 font-mono text-[9px] font-bold tracking-[0.5px] text-dim"
          >
            <Trans>One line under your name, for anyone who opens your profile.</Trans>
          </Text>

          <TextInput
            value={value}
            onChangeText={(typed) => {
              setValue(typed)
              setError(null)
            }}
            placeholder={t`e.g. I dial faster than I think`}
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSave()
            }}
            className="mb-2 rounded-lg border border-dim/30 bg-background px-3 py-2 font-mono tracking-[0.3px] text-primary"
            // Mobile Safari zooms the whole page in on focus for any input under 16px —
            // the one web quirk with no CSS opt-out, only a bigger font. Native has no
            // such behaviour, so it keeps the smaller size the rest of the card uses.
            // Same trade the nickname and feedback inputs make.
            style={{ fontSize: Platform.OS === 'web' ? 16 : 13 }}
          />

          {/* Counted rather than capped with `maxLength`: that prop counts UTF-16 units,
              so it would stop a player two emoji short of the fifty characters the
              database will actually take. The count here and the constraint there are
              the same unit. */}
          <Text
            selectable={false}
            className={cn(
              'mb-3 text-right font-mono text-[9px] font-bold tracking-[0.5px]',
              tooLong ? 'text-red-500' : 'text-dim',
            )}
          >
            {used}/{MOTTO_MAX}
          </Text>

          {error !== null && (
            <Text
              selectable={false}
              className="mb-3 font-mono text-[9px] font-bold tracking-[0.5px] text-red-500"
            >
              {error}
            </Text>
          )}

          <View className="mt-2 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 items-center rounded-xl bg-card py-3"
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px] text-dim"
              >
                <Trans>CANCEL</Trans>
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void handleSave()
              }}
              disabled={saving || tooLong}
              className={cn(
                'flex-1 items-center rounded-xl bg-primary py-3',
                (saving || tooLong) && 'opacity-50',
              )}
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px] text-on-strong"
              >
                {saving && <Trans>SAVING…</Trans>}
                {!saving && removing && <Trans>REMOVE</Trans>}
                {!saving && !removing && <Trans>SAVE</Trans>}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
