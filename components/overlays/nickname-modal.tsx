import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { Platform, Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { useOnline } from '@/hooks/use-online'
import { NICK_MAX, NICK_MIN, nicknameProblem } from '@/lib/nickname'

// The card itself, with no window of its own — `CardModal` is the host, for the keyboard's
// sake. See there. Saving hands over to `EmailDialog`, which brings its own.
export function NicknameModal({
  onSave,
  onSkip,
}: {
  onSave: (name: string) => Promise<{ error: string | null }>
  onSkip: () => void
}) {
  // `t` rather than <Trans>: a TextInput placeholder takes a string, not a node.
  const { t } = useLingui()
  const online = useOnline()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // A nickname is claimed on the server or not at all — the name has to be checked
  // against everyone else's. So with the connection down there is nothing to press:
  // SAVE dims and the line under the field says why, rather than letting the player
  // type a name and meet a failure at the end of it. SKIP still works, because
  // dismissing this costs nothing and needs no network.
  const canSave = online && !saving

  const handleSave = async () => {
    if (!canSave) return
    const trimmed = value.trim()
    const problem = nicknameProblem(trimmed)
    if (problem !== null) {
      // The emoji case gets its own line: the general rule names what is allowed without
      // ever saying what was wrong, and a player who typed a rocket reads it as an
      // invitation to try a different picture.
      setError(
        problem === 'emoji'
          ? 'No emoji — letters, numbers and _ only'
          : `${NICK_MIN}–${NICK_MAX} chars, letters/numbers/underscore only`,
      )
      return
    }
    setSaving(true)
    const res = await onSave(trimmed)
    setSaving(false)
    if (res.error === 'already_taken') {
      setError('That nickname is taken — try another')
      return
    }
    if (res.error) {
      setError('Something went wrong, try again')
      return
    }
    setValue('')
    setError(null)
  }

  const handleSkip = () => {
    setValue('')
    setError(null)
    onSkip()
  }

  return (
    <>
      <Text
        selectable={false}
        className="mb-1 font-mono text-[11px] font-black tracking-[2px] text-primary"
      >
        <Trans>WHO DO YOU WANT TO BE?</Trans>
      </Text>
      <Text
        selectable={false}
        className="mb-4 font-mono text-[9px] font-bold tracking-[0.5px] text-dim"
      >
        <Trans>Your name appears on the leaderboard.</Trans>
      </Text>

      <TextInput
        value={value}
        onChangeText={(t) => {
          setValue(t)
          setError(null)
        }}
        placeholder={t`e.g. ACE_9`}
        placeholderTextColor={DIM_INK}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={NICK_MAX}
        returnKeyType="done"
        onSubmitEditing={() => {
          void handleSave()
        }}
        className="mb-2 rounded-lg border border-dim/30 bg-background px-3 py-2 font-mono font-bold tracking-[1px] text-primary"
        // Mobile Safari zooms the whole page in on focus for any input under 16px —
        // the one web quirk with no CSS opt-out, only a bigger font. Native has no
        // such behaviour, so it keeps the smaller size the rest of the card uses.
        // Same trade the feedback sheet's input makes.
        style={{ fontSize: Platform.OS === 'web' ? 16 : 13 }}
      />

      {error !== null && (
        <Text
          selectable={false}
          className="mb-3 font-mono text-[9px] font-bold tracking-[0.5px] text-red-500"
        >
          {error}
        </Text>
      )}

      {error === null && !online && (
        <Text
          selectable={false}
          className="mb-3 font-mono text-[9px] font-bold tracking-[0.5px] text-dim"
        >
          <Trans>No connection — a nickname can only be claimed online.</Trans>
        </Text>
      )}

      <View className="mt-2 flex-row gap-3">
        <TrackedPressable
          id="nickname.skip"
          onPress={handleSkip}
          className="flex-1 items-center rounded-xl bg-card py-3"
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[1.5px] text-dim"
          >
            <Trans>SKIP</Trans>
          </Text>
        </TrackedPressable>

        <TrackedPressable
          id="nickname.save"
          onPress={() => {
            void handleSave()
          }}
          disabled={!canSave}
          className="flex-1 items-center rounded-xl bg-primary py-3"
          style={{ opacity: canSave ? 1 : 0.5 }}
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[1.5px] text-on-strong"
          >
            {saving ? 'SAVING…' : 'SAVE'}
          </Text>
        </TrackedPressable>
      </View>
    </>
  )
}
