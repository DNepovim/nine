import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { IntroCta } from '@/components/overlays/intro-cta'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { DARK_MULTIPLAYER_GRADIENT, MULTIPLAYER_GRADIENT } from '@/modes'

// The intro's WITH FRIENDS panel: the two doors into a room, and what stands over them
// offline. See `MenuOverlay`, which pages between this and the ALONE panel.
export function IntroFriendsPanel({
  width,
  online,
  onCreateRoom,
  onOpenJoinRoom,
}: {
  // The panel's own width — one page of the intro's two.
  width: number
  online: boolean
  onCreateRoom: () => void
  onOpenJoinRoom: () => void
}) {
  return (
    <View style={{ width, overflow: 'hidden' }} className="relative items-center">
      {/* Just the two doors in: start a room, or walk into one that
          already exists. The code and its keyboard used to live right
          here — they get their own screen now, past JOIN ROOM, so this
          tab is a choice rather than a form. */}
      <View className="items-center gap-4 py-10">
        {/* Fixed to accuracy's pair rather than `focused`: onCreateRoom
            always creates an accuracy room (`useMultiplayerScreens`),
            regardless of which singleplayer mode this tab inherited. */}
        <IntroCta
          id="menu.create_room"
          onPress={onCreateRoom}
          disabled={!online}
          colors={DARK_MULTIPLAYER_GRADIENT.accuracy}
          label={<Trans>CREATE ROOM</Trans>}
        />
        <TrackedPressable
          id="menu.join_room"
          onPress={onOpenJoinRoom}
          disabled={!online}
          className={cn(
            'w-56 items-center rounded-2xl border-2 py-[14px]',
            !online && 'opacity-40',
          )}
          style={{ borderColor: MULTIPLAYER_GRADIENT.accuracy[0] }}
        >
          <Text
            selectable={false}
            className={TYPE.button}
            style={{ color: MULTIPLAYER_GRADIENT.accuracy[0] }}
          >
            <Trans>JOIN ROOM</Trans>
          </Text>
        </TrackedPressable>
      </View>
      {/* Covers both buttons rather than disabling them piece by piece —
          creating or joining a room is a Supabase round trip either way, so
          nothing under here can do anything useful without a connection. */}
      {!online && (
        <View className="absolute inset-0 items-center justify-center gap-3 bg-surface px-6">
          <Ionicons name="cloud-offline-outline" size={32} color={DIM_INK} />
          <Text selectable={false} className={cn(TYPE.heading, 'text-dim')}>
            <Trans>YOU'RE OFFLINE</Trans>
          </Text>
          <Text
            selectable={false}
            className={cn(TYPE.value, 'text-center leading-[16px] text-dim')}
          >
            <Trans>CONNECT TO THE INTERNET TO PLAY WITH FRIENDS</Trans>
          </Text>
        </View>
      )}
    </View>
  )
}
