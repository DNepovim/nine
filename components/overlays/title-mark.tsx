import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { GAME_SCALE } from '@/constants/colors'
import type { ChampionMark } from '@/lib/champions'
import { MODE_GRADIENT } from '@/machines/game'

// The mark's own line height, and so the height of the box the bubble hangs off.
const MARK_HEIGHT = 30

// Fits inside the narrowest phone the intro is drawn on, with room to spare on either
// side — a bubble that reached the screen's edges would read as a panel rather than as
// something pointing at one emoji.
const BUBBLE_WIDTH = 264

// The caret over the bubble, drawn as a rotated square whose upper half sticks out past
// the card's edge. React Native has no border-triangle worth the arithmetic, and a square
// on its corner is the same shape once the card covers the bottom of it.
const CARET = 10

// Air between the mark and the caret's tip — small, and bounded by the greeting rather
// than chosen for looks. The line under the mark starts 4px below it, so a wider gap
// leaves the top of that line showing above the card, which reads as a half-drawn row
// rather than as a line something is covering. The caret's own half reaches back up out
// of the card, so the mark still has room around it.
const GAP = 4

// It closes itself. Nothing here is acted on, and a tooltip left open over the title
// after the player has moved on to picking a mode is just something in the way.
const HOLD_MS = 6000

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// What each mark says, in the player's own terms — this is the one place a mark is
// always the reader's, so it speaks to them rather than about whoever wears it.
//
// Each one brags on the player's behalf before it explains itself: the bird is held up,
// and then the player is put above it. A line that only said which board it came from
// would be a caption, and the mark is a reward.
//
// The colours are the ones the guide's champions section gives the same three marks: a
// bird wears its mode, and the crown steps off the mode scale onto the game scale's
// amber, because it is not about one mode.
const MARK_COPY = {
  '🦉': {
    tint: MODE_GRADIENT.accuracy[0],
    title: msg`THE OWL`,
    body: msg`An owl can hear a mouse under half a metre of snow. You are the more exact one — Extreme Accuracy's all-time record is yours.`,
  },
  '🦅': {
    tint: MODE_GRADIENT.speed[0],
    title: msg`THE EAGLE`,
    body: msg`An eagle dives at 240 km/h. You are the quicker one — Extreme Speed's all-time record is yours.`,
  },
  '👑': {
    tint: GAME_SCALE[4],
    title: msg`THE CROWN`,
    body: msg`The owl's ear and the eagle's dive, and you out-do both: the all-time record on Extreme Accuracy and Extreme Speed at once.`,
  },
} as const satisfies Record<
  ChampionMark,
  { tint: string; title: MessageDescriptor; body: MessageDescriptor }
>

// The mark this player wears everywhere their name does, worn here over the title
// itself, with a bubble explaining it.
//
// The mark arrives unannounced — a board changes hands while the app is shut and an emoji
// the player has never seen is suddenly sitting over NINE — so it has to be able to say
// what it is. The guide's champions section says the same thing at length; this is the
// answer to a tap on the mark, which is where the question is actually asked.
//
// The bubble hangs below. The mark sits at the very top of the screen's content, so there
// is nothing above it to open into — what is above is the edge of the phone. Below there
// is the greeting and the title, which the bubble covers for as long as it is up. It is
// absolutely placed, so nothing on the screen moves to make room for it.
export function TitleMark({ mark }: { mark: ChampionMark }) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const { tint, title, body } = MARK_COPY[mark]

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      setOpen(false)
    }, HOLD_MS)
    return () => {
      clearTimeout(id)
    }
  }, [open])

  return (
    // Lifted above the title beside it: the bubble is a child of this box, and siblings
    // later in the tree paint over earlier ones, so without this it would open behind
    // the four letters it is meant to float over.
    <View className="z-50 mb-1 items-center" style={{ height: MARK_HEIGHT }}>
      <Pressable
        onPress={() => {
          setOpen((wasOpen) => !wasOpen)
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t(title)}
      >
        <Text selectable={false} className="letter-float-1 text-[26px] leading-[30px]">
          {mark}
        </Text>
      </Pressable>

      {open && (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(140)}
          className="absolute items-center"
          style={{ top: MARK_HEIGHT + GAP, width: BUBBLE_WIDTH }}
        >
          {/* Any tap closes it. There is nothing in here to act on, so an X to aim at
              would be a control standing between the player and the screen. */}
          <Pressable
            onPress={() => {
              setOpen(false)
            }}
          >
            <View
              className="rounded-2xl bg-card px-3.5 py-2.5"
              style={{ ...shadow, borderWidth: 1, borderColor: `${tint}55` }}
            >
              <Text
                selectable={false}
                className="mb-1 font-mono text-[10px] font-black tracking-[2px]"
                style={{ color: tint }}
              >
                {t(title)}
              </Text>
              <Text
                selectable={false}
                className="font-mono text-[11px] leading-[16px] text-dim"
              >
                {t(body)}
              </Text>
            </View>
            {/* Pulled up by half its side so the card's edge cuts it in two, and
                centred by hand rather than by `self-center`: an absolute child is out of
                the card's flow, and alignment has nothing left to act on. The two borders
                it wears are the two the rotation leaves facing the mark. */}
            <View
              className="absolute rotate-45 bg-card"
              style={{
                width: CARET,
                height: CARET,
                top: -CARET / 2,
                left: '50%',
                marginLeft: -CARET / 2,
                borderLeftWidth: 1,
                borderTopWidth: 1,
                borderColor: `${tint}55`,
              }}
            />
          </Pressable>
        </Animated.View>
      )}
    </View>
  )
}
