import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { isNonEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import { TipBubble, useSelfClosing } from '@/components/overlays/tip-bubble'
import { MarkGlyph } from '@/components/player-mark'
import { TrackedPressable } from '@/components/tracked-pressable'
import { GAME_SCALE } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import type { PlayerMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { gradientOf } from '@/modes'

// How big the mark is drawn where nothing says otherwise — the intro's size, over the
// title. The profile card draws it a little larger, over the name.
const MARK_SIZE = 26

// The leading the mark is set on, and so the difference between the glyph's size and the
// height of the box the bubble hangs off.
const LEADING = 4

// How wide the bubble is drawn wherever there is room for it. It fits inside the
// narrowest phone the intro is drawn on with room to spare on either side — a bubble that
// reached the screen's edges would read as a panel rather than as something pointing at
// one emoji. Where there is less room than this — the profile card on a small phone — the
// bubble gives the difference up rather than hanging off the card.
const BUBBLE_WIDTH = 264

// Air between the mark and the caret's tip — small, and bounded by the greeting rather
// than chosen for looks. The line under the mark starts 4px below it, so a wider gap
// leaves the top of that line showing above the card, which reads as a half-drawn row
// rather than as a line something is covering. The caret's own half reaches back up out
// of the card, so the mark still has room around it.
const GAP = 4

// What each mark says, in two voices — the reader's own mark over the intro's title, and
// somebody else's over the name on their profile. Same fact, same brag, and only the
// person it is about changes: a line that switched to a caption the moment it was not
// yours would make the mark read as smaller on the profile of the player who took it.
//
// Each one brags on the wearer's behalf before it explains itself: the bird is held up,
// and then the player is put above it. A line that only said which board it came from
// would be a caption, and the mark is a reward.
//
// The colours are the ones the guide's champions section gives the same marks: a bird
// wears what it is about — the two board birds their mode, the phoenix the challenges'
// own colour — and the crown steps off onto the game scale's amber, because it is the one
// mark that is about no single thing.
const MARK_COPY = {
  '🦉': {
    tint: gradientOf('accuracy')[0],
    title: msg`THE OWL`,
    mine: msg`An owl can hear a mouse under half a metre of snow. You are the more exact one — Extreme Accuracy's all-time record is yours.`,
    theirs: msg`An owl can hear a mouse under half a metre of snow. This player is the more exact one — Extreme Accuracy's all-time record is theirs.`,
  },
  '🦅': {
    tint: gradientOf('speed')[0],
    title: msg`THE EAGLE`,
    mine: msg`An eagle dives at 240 km/h. You are the quicker one — Extreme Speed's all-time record is yours.`,
    theirs: msg`An eagle dives at 240 km/h. This player is the quicker one — Extreme Speed's all-time record is theirs.`,
  },
  // Took the most recently closed **session**. Not a board and not kept: it moves to
  // whoever wins the next challenge, which is what the wording has to carry — "right now"
  // rather than "has achieved". The tint is the challenges' own colour, the one the guide
  // gives that chapter, so the bubble belongs to the thing it is about.
  '🐦‍🔥': {
    tint: GAME_SCALE[3],
    title: msg`THE PHOENIX`,
    mine: msg`A phoenix burns down and comes back. You took the last challenge, and the mark is yours until somebody takes the next one.`,
    theirs: msg`A phoenix burns down and comes back. This player took the last challenge, and the mark is theirs until somebody takes the next one.`,
  },
  // Last, because it is what the three above add up to.
  '👑': {
    tint: GAME_SCALE[4],
    title: msg`THE CROWN`,
    mine: msg`The owl's ear, the eagle's dive and the phoenix's return — all three at once, and the birds give way to the crown.`,
    theirs: msg`The owl's ear, the eagle's dive and the phoenix's return — all three at once, and the birds give way to the crown.`,
  },
} as const satisfies Record<
  PlayerMark,
  {
    tint: string
    title: MessageDescriptor
    mine: MessageDescriptor
    theirs: MessageDescriptor
  }
>

// The marks a player wears everywhere their name does, drawn large with a bubble
// explaining them: over NINE on the intro, where they are the reader's own, and over the
// name on a profile card, where they are whoever that card is about.
//
// **All of them in one box, rather than one box each.** Two bird standings are
// different claims that can be true at once, so this has to draw two — but the bubble is
// an absolutely placed child and can only be as wide as its parent, which is why that
// parent is full width. Two full-width boxes side by side would each claim the whole row
// and overflow it, so the row of glyphs lives *inside* the one box and the bubble keeps
// the width it needs.
//
// The mark arrives unannounced — a board changes hands while the app is shut and an emoji
// the player has never seen is suddenly sitting over NINE — so it has to be able to say
// what it is. The guide's champions section says the same thing at length; this is the
// answer to a tap on the mark, which is where the question is actually asked. And a mark
// on somebody else's profile raises the same question from the other side, which is why
// the same tap answers it there.
//
// The bubble hangs below. The mark sits at the very top of whatever it crowns, so there
// is nothing above it to open into — what is above is the edge of the phone or the edge
// of the card. Below there is the greeting and the title, or the name and the motto,
// which the bubble covers for as long as it is up. It is absolutely placed, so nothing
// around it moves to make room for it.
// Air between two marks, and the figure the caret does its arithmetic with — a constant
// rather than a `gap-2` class, because the caret has to know it to find the glyph it is
// pointing at.
const MARK_GAP = 8

export function TitleMark({
  marks,
  // Whose marks these are, which is the only thing that changes the words.
  mine,
  size = MARK_SIZE,
  // The drift the intro's title letters ride, which the marks join when they stand among
  // them. Off inside the profile card, where nothing else moves.
  float = false,
  className,
}: {
  marks: readonly PlayerMark[]
  mine: boolean
  size?: number
  float?: boolean
  className?: string
}) {
  const { t } = useLingui()
  // *Which* mark is explaining itself, rather than whether one is. A player wearing both
  // an owl and a phoenix has two different questions to ask, and a boolean could only
  // answer the first one tapped.
  const [open, setOpen] = useSelfClosing<PlayerMark>()

  // After the hooks, never before them: a player wearing nothing draws nothing, and the
  // callers that used to guard this themselves no longer have to.
  if (!isNonEmptyArray(marks)) return null

  const copy = open === null ? null : MARK_COPY[open]
  // How far the caret slides off centre to sit under the glyph that was tapped. The row
  // is centred and every glyph is the same width, so the offset is arithmetic rather than
  // a measurement — which keeps the bubble from needing a layout pass to point straight.
  const caretShift =
    open === null ? 0 : (marks.indexOf(open) - (marks.length - 1) / 2) * (size + MARK_GAP)

  return (
    // Lifted above whatever comes after it: the bubble is a child of this box, and
    // siblings later in the tree paint over earlier ones, so without this it would open
    // behind the four letters — or the name — it is meant to float over.
    //
    // Full width rather than as wide as the glyphs, because an absolutely placed child is
    // laid out inside its parent — the bubble can only be as wide as this box gives it
    // room to be, and a box the width of one emoji would wrap the copy a word per line.
    <View
      className={cn('z-50 w-full items-center', className)}
      style={{ height: size + LEADING }}
    >
      <View className="flex-row items-center" style={{ gap: MARK_GAP }}>
        {marks.map((mark) => (
          <TrackedPressable
            key={mark}
            id="title.press"
            onPress={() => {
              setOpen((up) => (up === mark ? null : mark))
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t(MARK_COPY[mark].title)}
          >
            <MarkGlyph
              mark={mark}
              size={size}
              className={cn(float && 'letter-float-1')}
            />
          </TrackedPressable>
        ))}
      </View>

      {copy !== null && (
        // Its own width, given up where there is less room than that: the intro has the
        // whole screen to open into and gets the full bubble, while inside the profile
        // card on a small phone the bubble comes in to the card's own width.
        <TipBubble
          id="title.secondary"
          top={size + LEADING + GAP}
          width={BUBBLE_WIDTH}
          tint={copy.tint}
          caretShift={caretShift}
          onClose={() => {
            setOpen(null)
          }}
        >
          <Text
            selectable={false}
            className={cn(TYPE.quietAction, 'mb-1')}
            style={{ color: copy.tint }}
          >
            {t(copy.title)}
          </Text>
          <Text selectable={false} className={cn(TYPE.proseSm, 'text-dim')}>
            {t(mine ? copy.mine : copy.theirs)}
          </Text>
        </TipBubble>
      )}
    </View>
  )
}
