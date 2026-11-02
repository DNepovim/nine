import { Trans } from '@lingui/react/macro'
import { useEffect, useState, type ReactNode } from 'react'
import { Image, Text, useWindowDimensions, View } from 'react-native'

import { GLYPH, TYPE } from '@/constants/typography'
import { ViewportProvider } from '@/hooks/use-viewport'
import { cn } from '@/lib/cn'
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

// The note on the desk beside the phone, asking to be played on a real one. It only
// appears where the desk has room for it beside the frame — squeezed in, it would crowd
// the phone it is pointing away from.
const HINT_WIDTH = 200
const HINT_GAP = 40

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
  const frameWidth = width + BEZEL * 2
  const hintFits = (windowWidth - frameWidth) / 2 >= HINT_WIDTH + HINT_GAP * 2

  return (
    <View className="flex-1 items-center justify-center bg-card">
      {/* Faint enough that it reads as a texture rather than a picture. */}
      <Image
        source={{ uri: BACKDROP(seed) }}
        resizeMode="cover"
        className="absolute inset-0 opacity-10"
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
      {hintFits && (
        // Anchored to the centre and pushed out past the frame's half, so it sits beside
        // the phone whatever else shares the row (the dev gallery column).
        <View
          className="absolute"
          style={{
            left: '50%',
            marginLeft: frameWidth / 2 + HINT_GAP,
            width: HINT_WIDTH,
          }}
        >
          <PlayOnPhoneHint />
        </View>
      )}
    </View>
  )
}

function PlayOnPhoneHint() {
  // Read after mount: the static export renders without a window, and the address is
  // only a convenience — the note reads fine for the instant before it arrives.
  const [host, setHost] = useState<string | null>(null)
  useEffect(() => {
    setHost(window.location.host)
  }, [])

  return (
    <View className="gap-3">
      <Text className={GLYPH['3xl']}>📱</Text>
      <Text className={cn(TYPE.cardTitleSm, 'text-primary')}>
        <Trans>BETTER ON YOUR PHONE</Trans>
      </Text>
      <Text className={cn(TYPE.proseSm, 'text-dim')}>
        <Trans>
          Nine is made for a thumb, not a mouse. Open it on your phone and add it to your
          home screen — it plays like an app.
        </Trans>
      </Text>
      {host !== null && (
        <Text selectable className={cn(TYPE.value, 'text-primary')}>
          {host}
        </Text>
      )}
    </View>
  )
}
