import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { Pressable, Text } from 'react-native'

import { Screen } from '@/components/screen'
import { cn } from '@/lib/cn'
import { DARK_MULTIPLAYER_GRADIENT, MULTIPLAYER_GRADIENT } from '@/machines/game'

import { GameCodeInput } from './game-code-input'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

const CODE_LENGTH = 4

// Its own screen rather than a panel on the intro: the code, the keyboard and a
// CTA are the whole of the task here, and giving them the screen the tutorial or
// options gets is what makes JOIN ROOM a destination instead of a field to fill in
// on the way past.
//
// Joining is the button's job now, not the fourth digit's — WITH FRIENDS used to
// submit the moment a code hit length 4, which meant a mistyped digit could send a
// wrong code before the player meant to send anything.
export function JoinRoomOverlay({
  joinError,
  onJoinRoom,
  onClose,
}: {
  joinError: string | null
  onJoinRoom: (code: string) => void
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const ready = code.length === CODE_LENGTH

  return (
    <Screen overlay>
      <Text
        selectable={false}
        className="mb-1 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        ENTER ROOM CODE
      </Text>
      <Text
        selectable={false}
        className="mb-6 text-center font-mono text-[11px] font-bold tracking-[0.5px] text-dim"
      >
        Ask whoever created the room for their 4-digit code.
      </Text>

      <GameCodeInput
        value={code}
        onChange={setCode}
        accentColors={MULTIPLAYER_GRADIENT.accuracy as [string, string]}
        joinError={joinError}
      />

      <Pressable
        onPress={() => {
          onJoinRoom(code)
        }}
        disabled={!ready}
        className={cn('mt-2 w-56 overflow-hidden rounded-2xl', !ready && 'opacity-40')}
        style={shadow}
      >
        <LinearGradient
          colors={[...DARK_MULTIPLAYER_GRADIENT.accuracy]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          className="items-center py-4"
        >
          <Text
            selectable={false}
            className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
          >
            JOIN ROOM
          </Text>
        </LinearGradient>
      </Pressable>

      <Pressable onPress={onClose} hitSlop={10} className="mt-4">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[1.8px] text-dim underline"
        >
          CANCEL
        </Text>
      </Pressable>
    </Screen>
  )
}
