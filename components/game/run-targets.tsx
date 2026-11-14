import { useLingui } from '@lingui/react/macro'
import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'

import { DraftedSegments } from '@/components/game/drafted-segments'
import { FootprintTrail } from '@/components/game/footprint-trail'
import { TraineeStats } from '@/components/game/trainee-stats'
import { TutorialCard } from '@/components/game/tutorial-card'
import { TutorialIntro } from '@/components/game/tutorial-intro'
import type { ScreenLifeLoss } from '@/hooks/use-life-loss'
import type { ScreenField } from '@/hooks/use-play-field'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenControl } from '@/hooks/use-run-control'
import { computePar } from '@/machines/scoring'

// The run's targets, drawn in the run's **target form** in the space between the bar and
// the dial — with the footprints, the lesson's words and the taps a drawing board takes.
export function RunTargets({
  control,
  announcements,
  field,
  dying,
}: {
  control: ScreenControl
  announcements: ScreenAnnouncements
  field: ScreenField
  dying: ScreenLifeLoss
}) {
  const { t } = useLingui()
  const {
    TargetBoard,
    TargetView,
    dial,
    grid,
    hitBatch,
    hits,
    isGameOver,
    isPaused,
    opening,
    rules,
    runId,
    send,
    showPar,
    showRoute,
    showStats,
  } = control
  const { celebration, coach } = announcements
  const {
    boardTargets,
    drafting,
    drawing,
    drill,
    drillCards,
    drillTints,
    legs,
    lesson,
    noteBoardSize,
    onContainerLayout,
    removeDisplayed,
    targetsShortcuts,
    tip,
  } = field
  const { dyingPhase, targetsAreaRef } = dying
  return (
    <>
      {/* Target numbers */}
      <View className="flex-1">
        {/* The footprints of a steps run, on the floor under every card. */}
        <FootprintTrail legs={legs} />
        {/* Trainee's readout — how many targets they have cleared and how the press
    they just made actually went, which is what a learner wants and a score
    cannot tell them.

    It sits inside the targets area rather than up in the top bar, and that is
    a layout constraint rather than a design preference: the bar's height comes
    out of the same leftover the dial is sized from, and this block is ~85px
    against the bests strip's 25, which took about 10px off every dial button
    in Trainee alone. Down here it costs the spawn canvas instead — which has
    room to give, and which is measured below, so targets never land under it.

    Nothing of it in the tutorial. Every figure here is a reading of a run
    that has barely started, and the line under them coaches a press the
    player has not been told how to make yet — the teaching there is the
    tooltips still to come, and this would be talking over them. */}
        {rules.capabilities.coached && (
          <TraineeStats
            hits={hits}
            batch={hitBatch}
            praise={celebration.message ?? coach.line}
            showStats={showStats}
            showRoute={showRoute}
            route={coach.route}
            routeStart={coach.routeStart}
            routeTarget={coach.routeTarget}
          />
        )}

        {/* The canvas the targets actually spawn into. It carries the measurement,
    so its bounds are whatever is left after the readout above. */}
        <GestureDetector gesture={targetsShortcuts}>
          <View
            ref={targetsAreaRef}
            className="flex-1"
            onLayout={(event) => {
              onContainerLayout(event)
              noteBoardSize(event)
            }}
          >
            {/* The targets in the mode's **target form**: discs where they were
                dealt, or a terminal's lines. */}
            <TargetBoard runId={runId} take={opening.take} held={opening.held}>
              {boardTargets.map((target) => (
                <TargetView
                  maxValue={dial.maxSum}
                  key={target.id}
                  target={target}
                  // The clock this target spawned with, so a ring never retargets
                  // mid-flight when Speed's timeout tightens.
                  duration={target.duration}
                  par={
                    rules.capabilities.coached && showPar
                      ? computePar(dial, grid, target.value)
                      : undefined
                  }
                  dying={isGameOver && dyingPhase !== 'waiting'}
                  frozen={isPaused}
                  // Nine cards have to stand on this board at once in a drilled
                  // run, and nine at `PIE_SIZE` do not fit a phone — so each is
                  // given its own size, and they differ from one another on
                  // purpose. Undefined everywhere else, which is the size every
                  // other mode draws.
                  size={drillCards?.[target.seq]?.size}
                  // A drilled board keeps its taken cards. The nine are a picture
                  // the player is learning, and one vanishing on every hit would
                  // leave nothing to have learnt by the ninth.
                  spent={drill !== null}
                  // And its own colour, out of this challenge's own family. A
                  // fixed nine is learnt as a picture, and a colour is read before
                  // a number is — where the band tint every other mode wears says
                  // which hundred a target is in, which on a drill the player
                  // already knows.
                  color={drillTints?.[target.seq]}
                  // Whether this target has a clock to run down at all. Read off
                  // the rules rather than off the submode: the tutorial is the
                  // one that patches `countsDown` off today, and a drilled run
                  // does the same for a reason of its own — one clock per run,
                  // and here it is the stopwatch.
                  clocked={rules.clock.countsDown}
                  // How long a number shows before it fades — the **glimpse**,
                  // null for a number that never hides. Read off the rules, so the
                  // card never learns which mode is asking.
                  glimpse={rules.spawn.glimpse}
                  driftStep={rules.spawn.drift}
                  onExpire={() => {
                    send({
                      type: 'TARGET_EXPIRED',
                      id: target.id,
                      now: Date.now(),
                    })
                  }}
                  onExitComplete={() => {
                    removeDisplayed(target.id)
                  }}
                />
              ))}
            </TargetBoard>
            {drafting && <DraftedSegments drawing={drawing} />}
            {/* The lesson's two pointing cards. The first goes beside the target,
      above or below it as the canvas allows — see lib/tutorial-tip.ts. The
      second goes at the foot of the canvas with its beak turned down at the
      sum row directly beneath, which is the one thing on the screen whose
      place never moves. */}
            {/* Placed on the card itself rather than on a wrapper around it: the
      card is the view being mounted and unmounted, so it has to be the one
      carrying the position its exit animation plays out from. */}
            {lesson.voice === 'targetTip' && lesson.line !== null && tip !== null && (
              <TutorialCard
                text={t(lesson.line)}
                beak={tip.beak}
                anchorX={tip.beakAt}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: tip.top,
                }}
              />
            )}
            {/* The lesson's first word, set in the middle of the board with
      nothing else on it: what this run is, and that none of it counts. No
      card around it, because a card is something said about something else
      on the screen and there is nothing else on the screen yet — see
      components/game/tutorial-intro.tsx. */}
            {lesson.voice === 'opening' && lesson.line !== null && (
              <TutorialIntro text={t(lesson.line)} />
            )}
            {lesson.voice === 'sumTip' && lesson.line !== null && (
              <TutorialCard
                text={t(lesson.line)}
                beak="down"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 8,
                }}
              />
            )}
          </View>
        </GestureDetector>
      </View>
    </>
  )
}
