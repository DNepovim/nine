import { useState } from 'react'
import { Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { MODE_GRADIENT } from '@/machines/game'

const TRACK = 4
const HANDLE = 22
// Room above the track for the bubble that rides the handle, and below it for the two
// end labels, so the row claims a fixed height whatever the value is.
const BUBBLE_ROW = 18
const LABEL_ROW = 14

// A value picked by dragging, with its ends named and the current one riding the handle.
//
// Hand-rolled: the app carries no slider dependency, and the one control that needs one
// is not worth a package. Gesture work on the UI thread, the value in React state — the
// step is coarse enough that a redraw per step is nothing, and a controlled value cannot
// drift from the handle the way a shared one can.
export function ValueSlider({
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  // How a value is written, for both ends and the bubble — the slider itself knows
  // nothing about seconds, or about what it is setting.
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  const [width, setWidth] = useState(0)
  // The same measurement, readable from a worklet. Kept beside the state rather than
  // derived from it because a gesture cannot read React state.
  const trackWidth = useSharedValue(0)
  // What the drag last reported, so a finger crossing a step fires once instead of on
  // every frame it spends there.
  const lastSent = useSharedValue(value)

  const tint = MODE_GRADIENT.trainee[0]
  const span = max - min
  const ratio = span <= 0 ? 0 : Math.min(1, Math.max(0, (value - min) / span))
  const handleX = ratio * width

  const pick = (x: number) => {
    'worklet'
    if (trackWidth.value <= 0) return
    const atRatio = Math.min(1, Math.max(0, x / trackWidth.value))
    const stepped = Math.round((min + atRatio * span) / step) * step
    // Clamped after snapping, not before: the ends are whatever the mode table says and
    // need not sit on a step boundary, so rounding alone would put the nearest stop
    // outside the range and leave both ends unreachable.
    const picked = Math.min(max, Math.max(min, stepped))
    if (picked === lastSent.value) return
    lastSent.value = picked
    scheduleOnRN(onChange, picked)
  }

  // Begin as well as update, so a tap anywhere on the track jumps there rather than
  // asking for a drag that starts on the handle.
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet'
      pick(e.x)
    })
    .onUpdate((e) => {
      'worklet'
      pick(e.x)
    })

  return (
    <View className="w-full">
      {/* The value rides above the handle, centred on it and clamped to the track so it
          cannot hang off either end. */}
      <View style={{ height: BUBBLE_ROW }}>
        {width > 0 && (
          <Text
            selectable={false}
            className="absolute font-mono text-[11px] font-black tracking-[1px]"
            style={{
              color: tint,
              left: Math.min(width - 24, Math.max(-6, handleX - 18)),
              width: 48,
              textAlign: 'center',
            }}
          >
            {format(value)}
          </Text>
        )}
      </View>

      <GestureDetector gesture={pan}>
        {/* The touch target is the whole row, not the 4pt track inside it. */}
        <View
          className="justify-center"
          style={{ height: HANDLE }}
          onLayout={(e) => {
            const next = e.nativeEvent.layout.width
            setWidth(next)
            trackWidth.value = next
          }}
        >
          <View className="w-full rounded-full bg-muted" style={{ height: TRACK }} />
          <View
            className="absolute rounded-full"
            style={{ height: TRACK, width: handleX, backgroundColor: tint }}
          />
          <View
            className="absolute rounded-full border-2 bg-surface"
            style={{
              width: HANDLE,
              height: HANDLE,
              borderRadius: HANDLE / 2,
              borderColor: tint,
              left: Math.max(0, Math.min(width - HANDLE, handleX - HANDLE / 2)),
            }}
          />
        </View>
      </GestureDetector>

      <View className="flex-row justify-between" style={{ height: LABEL_ROW }}>
        <Text
          selectable={false}
          className="font-mono text-[9px] font-bold tracking-[1px] text-dim"
        >
          {format(min)}
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[9px] font-bold tracking-[1px] text-dim"
        >
          {format(max)}
        </Text>
      </View>
    </View>
  )
}
