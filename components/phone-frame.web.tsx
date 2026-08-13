import { useState, type ReactNode } from 'react'
import { Image, useWindowDimensions, View } from 'react-native'

import { ViewportProvider } from '@/hooks/use-viewport'
import { isDesktopViewport } from '@/lib/desktop'

// A game built for a phone, stretched to a 27-inch browser, is a dial the size of a
// dinner plate with the score marooned in the far corner. So above phone width the
// app keeps its own shape and sits in a frame in the middle of the window — a plain
// bezel with rounded corners, no notch or buttons, since the point is to bound the
// app rather than to draw a particular handset.
//
// Below that the window *is* a phone, and the frame would only steal space from it.
//
// Tall and narrow like the devices the game is played on, capped so it does not grow
// into a monitor-sized slab on a big screen, and inset so the desk is visible round it.
const ASPECT = 0.48 // width ÷ height
const MAX_HEIGHT = 900
const GUTTER = 48
const BEZEL = 10

// The desk the phone lies on: a photograph, blurred and faded almost to a wash.
//
// Lorem Picsum is the one keyless random-photo endpoint still standing — Unsplash
// Source, the usual answer, was retired and now answers 503. The blur is asked of the
// server rather than done here, so nothing has to be filtered client-side and the
// image arrives at a few tens of kilobytes.
//
// The seed is drawn once per mount: the photo differs between visits, but a backdrop
// that reshuffled on every resize would be exactly the distraction this is trying not
// to be. Nothing depends on it loading — offline, or if the host is down, the request
// fails quietly and the plain surface underneath is what shows.
const BACKDROP = (seed: string) => `https://picsum.photos/seed/${seed}/1920/1080?blur=4`

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [seed] = useState(() => Math.random().toString(36).slice(2))

  if (!isDesktopViewport(windowWidth, windowHeight)) {
    return <>{children}</>
  }

  // Whichever of the two runs out first decides the size; the aspect is then exact,
  // so the frame never distorts to fill a window it does not fit.
  const height = Math.min(
    MAX_HEIGHT,
    windowHeight - GUTTER,
    (windowWidth - GUTTER) / ASPECT,
  )
  const width = height * ASPECT

  return (
    <View className="flex-1 items-center justify-center bg-card">
      {/* Faint enough that it reads as a texture rather than a picture, and fainter
          again in the dark theme, where a lit photograph carries further. */}
      <Image
        source={{ uri: BACKDROP(seed) }}
        resizeMode="cover"
        className="absolute inset-0 opacity-10 dark:opacity-5"
      />
      <View
        className="overflow-hidden rounded-[46px] bg-strong"
        style={{
          width: width + BEZEL * 2,
          height: height + BEZEL * 2,
          padding: BEZEL,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 18 },
          shadowRadius: 36,
        }}
      >
        <View className="flex-1 overflow-hidden rounded-[36px] bg-surface">
          {/* Inside the bezel the frame is the whole world: what the app measures as
              the screen has to be this box, not the window it is floating in. */}
          <ViewportProvider width={width} height={height}>
            {children}
          </ViewportProvider>
        </View>
      </View>
    </View>
  )
}
