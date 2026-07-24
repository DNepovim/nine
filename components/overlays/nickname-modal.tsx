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

const NICK_RE = /^[\p{L}\p{N}_]{3,16}$/u

export function NicknameModal({
  visible,
  onSave,
  onSkip,
}: {
  visible: boolean
  onSave: (name: string) => Promise<{ error: string | null }>
  onSkip: () => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = value.trim()
    if (!NICK_RE.test(trimmed)) {
      setError('3–16 chars, letters/numbers/underscore only')
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <KeyboardAvoidingView
        className="flex-1 items-center justify-center bg-black/60 px-8"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="w-full max-w-xs rounded-2xl bg-card p-6">
          <Text
            selectable={false}
            className="mb-1 font-mono text-[11px] font-black tracking-[2px] text-primary"
          >
            CHOOSE A NICKNAME
          </Text>
          <Text
            selectable={false}
            className="mb-4 font-mono text-[9px] font-bold tracking-[0.5px] text-dim"
          >
            Your name appears on the leaderboard.
          </Text>

          <TextInput
            value={value}
            onChangeText={(t) => {
              setValue(t)
              setError(null)
            }}
            placeholder="e.g. ACE_9"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={16}
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSave()
            }}
            className="mb-2 rounded-lg border border-dim/30 bg-background px-3 py-2 font-mono text-[13px] font-bold tracking-[1px] text-primary"
          />

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
              onPress={handleSkip}
              className="flex-1 items-center rounded-xl bg-card py-3"
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px] text-dim"
              >
                SKIP
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void handleSave()
              }}
              disabled={saving}
              className="flex-1 items-center rounded-xl bg-primary py-3"
              style={{ opacity: saving ? 0.5 : 1 }}
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px] text-on-strong"
              >
                {saving ? 'SAVING…' : 'SAVE'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
