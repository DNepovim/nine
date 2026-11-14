import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { PlayMode } from '@/components/overlays/play-mode-tab'
import { useViewport } from '@/hooks/use-viewport'

const PAGE_OF = { alone: 0, friends: 1 } as const satisfies Record<PlayMode, number>

// The intro's two panels, ALONE and WITH FRIENDS, side by side in one row that slides a
// page at a time. Moved by translateX rather than scrolled — that avoids the Safari
// scrollTo-on-overflow:hidden bug that breaks the tab switch on web.
export function useIntroPaging(playMode: PlayMode) {
  const [panelWidth, setPanelWidth] = useState(0)
  const panelOffset = useSharedValue(0)
  const { width: windowWidth } = useViewport()
  // Screen has px-4 on each side (32px total); use as fallback before onLayout fires.
  const width = panelWidth > 0 ? panelWidth : windowWidth - 32

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelOffset.value }],
  }))

  const slideTo = (pm: PlayMode) => {
    panelOffset.value = withTiming(-PAGE_OF[pm] * width, {
      duration: 280,
      easing: Easing.inOut(Easing.ease),
    })
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    setPanelWidth(w)
    // Snap to current panel instantly on layout (no animation)
    panelOffset.value = -PAGE_OF[playMode] * w
  }

  return { width, panelStyle, slideTo, onLayout }
}
