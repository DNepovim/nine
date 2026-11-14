import { useLingui } from '@lingui/react/macro'
import { View } from 'react-native'

import { Arrival } from '@/components/game/arrival'
import { AXIS_STRIP } from '@/components/game/dial-axes'
import { HitSync } from '@/components/game/hit-sync'
import { ScoreDigit } from '@/components/game/score-digit'
import { SumHush } from '@/components/game/sum-hush'
import { TutorialCard } from '@/components/game/tutorial-card'
import { TUTORIAL_BANNER_HEIGHT } from '@/constants/tutorial'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import type { ScreenField } from '@/hooks/use-play-field'
import type { ScreenControl } from '@/hooks/use-run-control'
import { SchemeProvider } from '@/hooks/use-scheme'
import { valueProgress } from '@/lib/value-progress'

// The sum above the dial, in a reserved slot so the dial stands at one height whatever it
// reads — and the lesson's card where the lesson puts one there.
export function RunSumRow({
  control,
  field,
}: {
  control: ScreenControl
  field: ScreenField
}) {
  const { t } = useLingui()
  const { dial, hitBatch, opening, tutorial } = control
  const { direction, lesson, noteSumRowRect, shownSum } = field
  return (
    <>
      {/* ── Score above dial ── */}
      {/* A reserved slot rather than whatever the digits need, so the dial sits at
    the same height whether the sum is 0 or 324 — and the same height a lesson
    puts it at, since DialStage reserves this too. */}
      <View
        className="items-center justify-center"
        style={{ height: SUM_ROW_HEIGHT }}
        onLayout={noteSumRowRect}
      >
        {/* Dimmed under the lesson's first word, which is the only thing on the
      board while it is up — see components/game/sum-hush.tsx. */}
        <SchemeProvider kind={opening.dialScheme}>
          <Arrival order={7} from="below">
            {!dial.hidesSum && (
              <SumHush hushed={lesson.voice === 'opening'}>
                {/* The sum's half of a hit — it swells as the target's number swells
        out of the ring collapsing above. */}
                <HitSync seq={hitBatch.seq}>
                  <View className="flex-row">
                    {String(shownSum)
                      .split('')
                      .map((digit, i, arr) => (
                        <ScoreDigit
                          key={arr.length - 1 - i}
                          digit={digit}
                          direction={direction}
                          progress={valueProgress(shownSum, dial.maxSum)}
                        />
                      ))}
                  </View>
                </HitSync>
              </SumHush>
            )}
          </Arrival>
        </SchemeProvider>
      </View>

      {/* The band the tutorial talks in: between the sum and the dial, held open
    for the whole run rather than appearing with the words.

    It was above the board once, in the slot Trainee's readout takes. Down
    here a line saying to swipe a key down is a hand's width from the keys and
    from the total it is about, rather than a headline at the top of a screen
    — and the two pointing cards still have the whole canvas above it to be
    placed in.

    Held open for the reason it always was: the canvas above is measured, so a
    card arriving would shorten it under a target already placed in the taller
    one. What the band costs comes off that canvas, which is to say the sum
    sits exactly this much higher in a lesson than in a run. The dial does not
    move at all — it is sized from the viewport, and it is the one thing on
    this screen whose place a lesson may not change.

    The strip at the foot of it is the dial's own multipliers, which are drawn
    up out of the dial's box into this band — see components/game/dial-axes.tsx.
    Reserved rather than shared, so a banner and a `1×` are never in the same
    place. */}
      {tutorial && (
        <View
          className="justify-center px-1"
          style={{
            height: TUTORIAL_BANNER_HEIGHT + AXIS_STRIP,
            paddingBottom: AXIS_STRIP,
          }}
        >
          {lesson.voice === 'banner' && lesson.line !== null && (
            <TutorialCard text={t(lesson.line)} beak="none" />
          )}
        </View>
      )}
    </>
  )
}
