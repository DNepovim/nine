import { useLingui } from '@lingui/react/macro'
import { Pressable, Text, View } from 'react-native'

import {
  canGoBack,
  canGoForward,
  previousStep,
  stepState,
  TUTORIAL_STEPS,
  type StepState,
} from '@/lib/tutorial-stepper'
import { gradientOf } from '@/modes'

// The tutorial's colour, worn for the reason the lesson's card wears it: this is the
// lesson talking about itself, not the game reporting anything.
const TINT = gradientOf('trainee')[0]

// The row's height, held whether anything in it is live or not.
//
// Fixed for the same reason the banner band below it is: this sits above the spawn canvas,
// and a row that grew or shrank would resize the canvas under a target already placed in
// the taller one.
const TUTORIAL_STEPPER_HEIGHT = 34

const DOT = 22

// How each state is inked. `locked` leaves the tint entirely — a board nobody has reached
// is not part of the lesson yet, and tinting it would make it look like something to
// press. Its number takes the app's `text-dim` class instead, which is why it needs no
// colour here.
const DOT_STYLE: Record<StepState, { border: string; fill: string }> = {
  current: { border: TINT, fill: TINT },
  visited: { border: TINT, fill: 'transparent' },
  locked: { border: 'transparent', fill: 'transparent' },
}

// The number itself. White out of the filled dot the player is standing on, the tint on
// an open one, and dim on a board they have not reached.
const NUMBER_CLASS = 'font-mono text-[10px] font-black'
const numberColor = (state: StepState): string | undefined =>
  state === 'current' ? '#fff' : state === 'visited' ? TINT : undefined

function Arrow({
  glyph,
  live,
  label,
  onPress,
}: {
  glyph: string
  live: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      disabled={!live}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !live }}
      hitSlop={10}
      className="w-8 items-center justify-center"
    >
      <Text
        selectable={false}
        className="font-mono text-[16px] font-black"
        // Not hidden when dark. An arrow that vanished would move the numbers under the
        // player's thumb the moment they reached their furthest board; dimmed, the row
        // is the same row from the first step to the last.
        style={{ color: live ? TINT : 'transparent', opacity: live ? 1 : 0.25 }}
      >
        {glyph}
      </Text>
    </Pressable>
  )
}

// Where the player is in the lesson, and the two ways they may move.
//
// It can put them back on a board they have already played and return them to where they
// were, and it can do nothing else: there is no tap anywhere on this row that reaches a
// board they have not reached by playing. See lib/tutorial-stepper.ts for the rules; this
// only draws them.
export function TutorialStepper({
  // The board under the player now, counted from nought.
  current,
  // The highest they have reached this run. Raised by play, never by this.
  furthest,
  // Whether the row may be used at all. False while one of the lesson's cards is up: a
  // card holds the whole viewport to hear the tap that dismisses it, so every press on
  // this row goes to the card instead, and a row that looked live while that was true
  // would be offering something it cannot do. Passes on its own, when the card does.
  live,
  onGo,
}: {
  current: number
  furthest: number
  live: boolean
  onGo: (board: number) => void
}) {
  const { t } = useLingui()
  return (
    <View
      className="flex-row items-center justify-center"
      style={{ height: TUTORIAL_STEPPER_HEIGHT, opacity: live ? 1 : 0.35 }}
    >
      <Arrow
        glyph="‹"
        live={live && canGoBack(current)}
        label={t`Back a step`}
        onPress={() => {
          onGo(previousStep(current))
        }}
      />
      <View className="flex-row items-center gap-2 px-2">
        {Array.from({ length: TUTORIAL_STEPS }, (_, board) => {
          const state = stepState(board, current, furthest)
          const ink = DOT_STYLE[state]
          return (
            <Pressable
              key={board}
              disabled={!live || state !== 'visited'}
              onPress={() => {
                onGo(board)
              }}
              accessibilityRole="button"
              accessibilityLabel={t`Step ${board + 1}`}
              accessibilityState={{
                disabled: !live || state !== 'visited',
                selected: state === 'current',
              }}
              hitSlop={6}
              className="items-center justify-center rounded-full border"
              style={{
                width: DOT,
                height: DOT,
                borderColor: ink.border,
                backgroundColor: ink.fill,
              }}
            >
              {/* Every number is drawn, whatever its state: the row keeps its width and
                its spacing from the first board to the last, and what changes as the
                player gets on is how much of it has come up. */}
              <Text
                selectable={false}
                className={state === 'locked' ? `${NUMBER_CLASS} text-dim` : NUMBER_CLASS}
                style={{ color: numberColor(state) }}
              >
                {board + 1}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Arrow
        glyph="›"
        live={live && canGoForward(current, furthest)}
        label={t`Forward a step`}
        onPress={() => {
          onGo(current + 1)
        }}
      />
    </View>
  )
}
