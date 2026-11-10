import { useEffect } from 'react'
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated'

// How far the phone has turned from upright, in radians, read from the browser's motion sensor:
// nought held upright, positive as the top goes to the right. The same contract as the native
// `use-tilt.ts`, and drawn the same way — what a level surface looks like from the phone's
// point of view.
//
// Android reports the acceleration the phone feels, which points up when it is held still;
// iOS reports the opposite sign. Safari is also the one browser that wants the player's leave first, and
// only from a tap, so on iOS the first touch anywhere is what raises that question. Where the
// player says no, or there is no sensor at all (a desktop), the surface stays level.
//
// The native file is `use-tilt.ts`.
//
// @public
const MAX_TILT = Math.PI / 3
// Below this much of gravity in the screen's plane the phone is lying flat, in m/s².
const FLAT = 2.5
const SETTLE = { damping: 18, stiffness: 90, mass: 1 } as const

type MotionWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export function useTilt(): SharedValue<number> {
  const tilt = useSharedValue(0)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return
    const { requestPermission } = DeviceMotionEvent as MotionWithPermission
    const sign = requestPermission ? -1 : 1

    const onMotion = (event: DeviceMotionEvent) => {
      const gravity = event.accelerationIncludingGravity
      if (gravity?.x == null || gravity.y == null) return
      const across = sign * gravity.x
      const along = sign * gravity.y
      if (Math.hypot(across, along) < FLAT) {
        tilt.value = withSpring(0, SETTLE)
        return
      }
      const roll = Math.atan2(-across, along)
      tilt.value = withSpring(Math.max(-MAX_TILT, Math.min(MAX_TILT, roll)), SETTLE)
    }
    const listen = () => {
      window.addEventListener('devicemotion', onMotion)
    }

    const ask = () => {
      requestPermission?.call(DeviceMotionEvent).then(
        (state) => {
          if (state === 'granted') listen()
        },
        () => {},
      )
    }
    if (requestPermission) window.addEventListener('pointerup', ask, { once: true })
    else listen()

    return () => {
      window.removeEventListener('pointerup', ask)
      window.removeEventListener('devicemotion', onMotion)
    }
  }, [])

  return tilt
}
