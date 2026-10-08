import { Trans } from '@lingui/react/macro'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'

import { CodeDigit } from '@/components/overlays/code-digit'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

import { CodeKeyboard } from './code-keyboard'

// How long the boxes hold the red flash before the wrong code clears itself —
// long enough to register as "that was rejected", short enough that the keyboard
// feels responsive again rather than locked.
const WRONG_CLEAR_DELAY_MS = 300
const WRONG_COLOR = '#E5534B'

export function GameCodeInput({
  value,
  onChange,
  accentColors,
  joinError,
}: {
  value: string
  onChange: (v: string) => void
  accentColors: [string, string]
  joinError: string | null
}) {
  const accentColor = accentColors[0]
  // An empty slot: the secondary ink at a quarter strength, so it is the same grey as
  // every other quiet mark on the screen rather than a hex of its own.
  const empty = DIM_INK + '40'
  const [wrong, setWrong] = useState(false)
  const prevJoinError = useRef(joinError)

  // A join failure — not just any non-null error, a *new* one — flashes the boxes
  // red and clears itself. `menuOverlay` leaves the code on screen after the 4th
  // digit rather than clearing it (see its own comment), so this is what retires it.
  useEffect(() => {
    if (joinError === prevJoinError.current) return
    prevJoinError.current = joinError
    if (joinError === null) return
    setWrong(true)
    const timer = setTimeout(() => {
      setWrong(false)
      onChange('')
    }, WRONG_CLEAR_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [joinError, onChange])

  return (
    <View className="mb-8 mt-4 items-center">
      <Text
        selectable={false}
        className="mb-4 font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
      >
        <Trans>JOIN WITH CODE</Trans>
      </Text>
      <View className="flex-row gap-3">
        {[0, 1, 2, 3].map((i) => {
          const digit = value[i] ?? ''
          const color = wrong ? WRONG_COLOR : digit ? accentColor : empty
          return (
            <View
              key={i}
              className="w-13 h-17 border-2 rounded-[10px] items-center justify-center"
              style={{
                borderColor: wrong
                  ? WRONG_COLOR + 'CC'
                  : digit
                    ? accentColor + '80'
                    : empty,
                backgroundColor: wrong
                  ? WRONG_COLOR + '1F'
                  : digit
                    ? accentColor + '12'
                    : undefined,
              }}
            >
              <CodeDigit digit={digit} color={color} size={28} />
            </View>
          )
        })}
      </View>
      {joinError !== null ? (
        <Text
          selectable={false}
          className={cn(TYPE.label, 'mt-3')}
          style={{ color: '#E5534B' }}
        >
          {joinError}
        </Text>
      ) : (
        <View className="h-7" />
      )}
      <CodeKeyboard value={value} onChange={onChange} accentColors={accentColors} />
    </View>
  )
}
