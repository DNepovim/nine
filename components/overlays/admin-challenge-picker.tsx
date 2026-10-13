import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { CHALLENGES } from '@/modes/challenges/catalog'

// Which challenge a session airs. Every challenge ever written, not only the ones whose
// compiled window happens to be open — the whole point of a session is that when a
// challenge is on stops being a build-time fact, so a picker filtered by the old windows
// would offer the one thing nobody needs to plan.
//
// Pills rather than a dropdown, which is the shape the admin screens already use for a
// one-of-several choice: the role picker on the person screen and the tab row above it.
// The catalog holds one challenge today and will hold a couple of dozen; a row that
// wraps is the right failure for that, and a native picker per platform is not.
export function AdminChallengePicker({
  modeId,
  onSelect,
}: {
  // Null before anything is chosen, which is how a new session opens. The form's SAVE
  // stays shut until this is answered.
  modeId: string | null
  onSelect: (modeId: string) => void
}) {
  const { t } = useLingui()
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {CHALLENGES.map((challenge) => {
        const active = challenge.id === modeId
        return (
          <TrackedPressable
            key={challenge.id}
            id="admin.session_challenge"
            onPress={() => {
              onSelect(challenge.id)
            }}
            className={cn(
              'rounded-lg border px-3 py-1.5',
              active ? 'border-strong bg-strong' : 'border-dim/30',
            )}
          >
            <Text
              selectable={false}
              className={cn(TYPE.label, active ? 'text-on-strong' : 'text-dim')}
            >
              {t(challenge.label)}
            </Text>
          </TrackedPressable>
        )
      })}
    </View>
  )
}
