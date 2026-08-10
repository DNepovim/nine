import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { MenuButton } from '@/components/game/menu-button'
import { ControlsDiagram } from '@/components/guide/controls-diagram'
import { GuideBody } from '@/components/guide/guide-body'
import { GuideBullet } from '@/components/guide/guide-bullet'
import { GuideCard } from '@/components/guide/guide-card'
import { ModeCard } from '@/components/guide/mode-card'
import { SectionHeader } from '@/components/guide/section-header'
import { WeightGrid } from '@/components/guide/weight-grid'
import { GUIDE_ACCENT } from '@/constants/guide'
import { useTheme } from '@/hooks/use-theme'

export function HowToPlayOverlay({
  onClose,
  onStartTutorial,
}: {
  onClose: () => void
  onStartTutorial: () => void
}) {
  const { colorScheme } = useTheme()
  const dotColor = colorScheme === 'dark' ? '#2A2B44' : '#D4D0C8'
  return (
    <View className="absolute inset-0 bg-surface">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 64,
          paddingBottom: 56,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text
          selectable={false}
          className="font-mono text-[22px] font-black tracking-[3px] text-primary"
        >
          HOW TO PLAY
        </Text>
        <Text
          selectable={false}
          className="mt-1 font-mono text-[11px] font-bold tracking-[1px] text-dim"
        >
          DIAL THE GRID · MATCH THE NUMBER
        </Text>

        {/* Hands-on tutorial — the guide below is the reference version. */}
        <Pressable
          onPress={onStartTutorial}
          className="mt-5 flex-row items-center gap-3 rounded-2xl bg-card p-4"
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${GUIDE_ACCENT.goal}26` }}
          >
            <Ionicons name="play" size={17} color={GUIDE_ACCENT.goal} />
          </View>
          <View className="flex-1">
            <Text
              selectable={false}
              className="font-mono text-[13px] font-black tracking-[1.5px] text-primary"
            >
              PLAY THE TUTORIAL
            </Text>
            <Text
              selectable={false}
              className="mt-0.5 font-mono text-[11px] font-medium text-dim"
            >
              Learn by doing — six quick, hands-on steps.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={dotColor} />
        </Pressable>

        {/* Goal */}
        <SectionHeader icon="flag" title="THE GOAL" color={GUIDE_ACCENT.goal} />
        <GuideBody>
          {
            'A glowing target number floats onto the board. Turn the nine dial buttons so the whole grid adds up to exactly that number, and the target pops — a hit.\n\nEvery button holds a digit 0–9, but where it sits decides how much it counts. Each button’s weight is its row order × its column order — rows numbered 1–3 top to bottom, columns 1–3 left to right — so it adds row × column × value to the total.'
          }
        </GuideBody>
        <GuideCard>
          <WeightGrid />
        </GuideCard>
        <GuideBody>
          {
            '\nSo the bottom-right button (row 3 × column 3 = 9) moves the total in big leaps, while the top-left (1 × 1 = 1) nudges it by exactly its digit — perfect for fine-tuning the last few points.'
          }
        </GuideBody>

        {/* Controls */}
        <SectionHeader icon="hand-left" title="CONTROLS" color={GUIDE_ACCENT.controls} />
        <GuideCard>
          <ControlsDiagram />
        </GuideCard>
        <GuideBody>
          {
            '\nTap to count up, swipe up/down to step ±1, and swipe left or right to jump straight to 0 or 9. Tip: turn on “Show sum in buttons” under Options to see each button’s live contribution.'
          }
        </GuideBody>

        {/* Targets & clock */}
        <SectionHeader
          icon="timer"
          title="TARGETS & THE CLOCK"
          color={GUIDE_ACCENT.controls}
        />
        <GuideBody>
          {
            'Each target carries a shrinking ring — its countdown. Land the sum before the ring empties. Several targets can share the board at once (up to 3, or 4 on Extreme), and new ones keep arriving, so pick your order wisely.'
          }
        </GuideBody>

        {/* Modes */}
        <SectionHeader icon="grid" title="MODES" color={GUIDE_ACCENT.modes} />
        <GuideBody>
          {
            'Same grid, different pressure. Difficulty (Easy / Hard / Extreme) tightens the clock and adds targets.'
          }
        </GuideBody>
        <ModeCard
          mode="trainee"
          facts={[
            'Pure practice — no lives, no score, and a relaxed clock.',
            'Buttons show their weight and max, so you can learn the math.',
            'Each target wears a grey badge: the fewest moves needed to hit it from the board as it stands.',
            'That count updates as you dial — and a swipe to 0 or 9 counts as one move, so it drops faster than you might expect.',
          ]}
        />
        <ModeCard
          mode="accuracy"
          facts={[
            'Score rewards precision: solve each target in the fewest moves.',
            'Waste too many moves on a hit (under 20% accuracy) and you lose a life.',
            'Matching every target in its optimal move count builds your streak.',
          ]}
        />
        <ModeCard
          mode="speed"
          facts={[
            'A fast, short clock — the sooner you hit, the more it scores.',
            'Clear the entire board to fire your combo streak.',
            'Let a target run out and you lose a life.',
          ]}
        />

        {/* Scoring */}
        <SectionHeader icon="trophy" title="SCORING" color={GUIDE_ACCENT.scoring} />
        <GuideBody>
          {
            'A hit is worth up to 100 points, blended from two factors and weighted by the mode:'
          }
        </GuideBody>
        <GuideCard>
          <GuideBullet color={GUIDE_ACCENT.goal}>
            Accuracy — how close to the fewest possible moves you were.
          </GuideBullet>
          <GuideBullet color={GUIDE_ACCENT.scoring}>
            Speed — how much time was left on the ring.
          </GuideBullet>
          <GuideBullet color={GUIDE_ACCENT.tips}>
            Streak — consecutive perfect plays multiply your points ×2 → ×4 → ×8.
          </GuideBullet>
        </GuideCard>
        <GuideBody>
          {
            '\nAccuracy mode leans almost entirely on precision; Speed mode on the clock. Trainee is unscored practice.'
          }
        </GuideBody>

        {/* Lives */}
        <SectionHeader icon="heart" title="LIVES" color={GUIDE_ACCENT.lives} />
        <GuideBody>
          {
            'Accuracy and Speed give you three hearts. You lose one when a target’s ring runs out — and in Accuracy, also for a badly wasteful hit. Lose all three and it’s game over. Trainee has unlimited lives, so take your time.'
          }
        </GuideBody>

        {/* Tips */}
        <SectionHeader icon="bulb" title="TIPS & TRICKS" color={GUIDE_ACCENT.tips} />
        <GuideBullet color={GUIDE_ACCENT.tips}>
          Set the coarse ×9 / ×6 buttons first to get near the target, then fine-tune with
          the ×1 / ×2 buttons.
        </GuideBullet>
        <GuideBullet color={GUIDE_ACCENT.tips}>
          Swipe to 0 or 9 to reset a button in a single gesture instead of tapping
          through.
        </GuideBullet>
        <GuideBullet color={GUIDE_ACCENT.tips}>
          In Accuracy, plan your route before you touch anything — every extra move costs
          you.
        </GuideBullet>
        <GuideBullet color={GUIDE_ACCENT.tips}>
          In Speed, hunt targets that are closest to the current sum to clear the board
          fast and keep the combo alive.
        </GuideBullet>
        <GuideBullet color={GUIDE_ACCENT.tips}>
          Start in Trainee to build intuition for the weights, then chase high scores.
        </GuideBullet>

        {/* Done */}
        <Pressable
          onPress={onClose}
          className="mt-10 items-center self-center rounded-2xl bg-strong py-4"
          style={{ width: 224 }}
        >
          <Text
            selectable={false}
            className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
          >
            GOT IT
          </Text>
        </Pressable>
      </ScrollView>

      {/* Close — same 5-dot cross + CLOSE label and position as the pause menu. */}
      <MenuButton
        visible
        paused
        onToggle={onClose}
        color={dotColor}
        style={{ position: 'absolute', top: 12, right: 18, zIndex: 20 }}
      />
    </View>
  )
}
