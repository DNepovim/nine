import { Trans } from '@lingui/react/macro'
import { useMemo, useRef } from 'react'
import { ScrollView, Text } from 'react-native'

import { HowToPlayAchievements } from '@/components/overlays/how-to-play-achievements'
import { HowToPlayArcade } from '@/components/overlays/how-to-play-arcade'
import { HowToPlayChallenges } from '@/components/overlays/how-to-play-challenges'
import { HowToPlayChampions } from '@/components/overlays/how-to-play-champions'
import { HowToPlayContents } from '@/components/overlays/how-to-play-contents'
import { HowToPlayControls } from '@/components/overlays/how-to-play-controls'
import { HowToPlayGoal } from '@/components/overlays/how-to-play-goal'
import { HowToPlayModes } from '@/components/overlays/how-to-play-modes'
import { HowToPlayMultiplayer } from '@/components/overlays/how-to-play-multiplayer'
import { HowToPlayTargets } from '@/components/overlays/how-to-play-targets'
import { HowToPlayTips } from '@/components/overlays/how-to-play-tips'
import { HowToPlayTryIt } from '@/components/overlays/how-to-play-try-it'
import { ModalCard } from '@/components/overlays/modal-card'
import { TYPE } from '@/constants/typography'
import { useFlag } from '@/hooks/use-flags'
import { useViewport } from '@/hooks/use-viewport'
import { cn } from '@/lib/cn'
import { sectionOrder, type SectionKey } from '@/lib/how-to-play-sections'

// ── Dialog ──────────────────────────────────────────────────────────────────

// A jumped-to header lands this far below the top edge rather than flush against it,
// so it reads as a heading with a page under it instead of a cropped line.
const JUMP_MARGIN = 20

export function HowToPlayOverlay({
  onClose,
  onTryTutorial,
}: {
  onClose: () => void
  // Deals the tutorial and closes the guide. The run a first launch offers, and this is
  // the only other door to it — see constants/tutorial.ts.
  onTryTutorial: () => void
}) {
  const { height } = useViewport()

  // Read once and used twice — by the contents list and by the chapter itself — so the
  // list cannot offer a jump to a section that is not on the page.
  const showMultiplayer = useFlag('multiplayer')
  const showArcade = useFlag('arcade')
  const showChallenges = useFlag('challenges')
  const sections = useMemo(
    () => sectionOrder(showMultiplayer, showArcade, showChallenges),
    [showMultiplayer, showArcade, showChallenges],
  )

  const scrollRef = useRef<ScrollView>(null)
  // Filled by each header as it lays out. A ref, not state: these positions are read
  // on a tap and never rendered, so storing them in state would re-render the whole
  // guide six times on mount for nothing.
  const offsets = useRef<Partial<Record<SectionKey, number>>>({})

  const measure = (section: SectionKey, y: number) => {
    offsets.current[section] = y
  }

  const jump = (section: SectionKey) => {
    const y = offsets.current[section]
    // Nothing measured yet — the tap came before layout, so there is nowhere to go.
    if (y === undefined) return
    scrollRef.current?.scrollTo({ y: Math.max(0, y - JUMP_MARGIN), animated: true })
  }

  // The guide is a dialog over whatever asked for it — the intro or the paused run —
  // and the same one the player's profile opens in. It used to be a screen of its own,
  // with its own title band, its own close cross and a swipe in from the left edge to
  // dismiss it; the card brings the first two, and the third went with the screen: an
  // edge gesture is a reading-sized affordance, and there is no screen edge inside a
  // card for a thumb to start from.
  return (
    <ModalCard
      title={<Trans>HOW TO PLAY</Trans>}
      onDismiss={onClose}
      maxHeight={height * 0.85}
    >
      {() => (
        <ScrollView
          ref={scrollRef}
          // The card pads the sides; this adds only the vertical air the page needs.
          // `flexShrink` lets the guide scroll inside the cap rather than claim all of
          // it — see the note in ModalCard's other callers.
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
          style={{ flexGrow: 0, flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* The page's own title is the card's header now; this line stays, since it
              says what the guide is about rather than repeating its name. */}
          <Text selectable={false} className={cn(TYPE.figure, 'text-dim')}>
            <Trans>DIAL THE GRID · MATCH THE NUMBER</Trans>
          </Text>

          <HowToPlayContents sections={sections} onJump={jump} />

          <HowToPlayTryIt onPress={onTryTutorial} />

          {/* Goal */}
          <HowToPlayGoal onMeasure={measure} />

          {/* Controls */}
          <HowToPlayControls onMeasure={measure} />

          {/* Targets & clock */}
          <HowToPlayTargets onMeasure={measure} />

          {/* Modes — scoring and lives live here too: both only mean anything per
              mode, and as their own sections they repeated what the cards say. */}
          <HowToPlayModes onMeasure={measure} />

          {/* Challenges. Gone with the card that leads to them — see the `challenges`
              feature in constants/features.ts.

              Deliberately vague about the rules, and that is the chapter's one hard
              rule: a challenge may change the dial, the clock, the scoring and the
              lives, so anything this said about how one plays would be wrong for the
              next one. What it can promise is the *shape* — a window, one set of
              standings, and rules printed on the card before you start. */}
          {showChallenges && <HowToPlayChallenges onMeasure={measure} />}

          {/* Arcade. Gone with the pill that leads to it — see the arcade flag in
              constants/features.ts. */}
          {showArcade && <HowToPlayArcade onMeasure={measure} />}

          {/* Champions — the marks the boards hand out, explained where a player who
              has just seen one on a row will look for them. */}
          <HowToPlayChampions onMeasure={measure} />

          {/* Achievements — straight after the marks, because the sentence above ends
              on "only ever lent" and this is the opposite kind of reward. */}
          <HowToPlayAchievements onMeasure={measure} />

          {/* Multiplayer. Gone with the tab that leads to it — see the multiplayer
              flag in constants/features.ts. */}
          {showMultiplayer && <HowToPlayMultiplayer onMeasure={measure} />}

          {/* Tips */}
          <HowToPlayTips onMeasure={measure} />
        </ScrollView>
      )}
    </ModalCard>
  )
}
