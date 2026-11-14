import { useLingui } from '@lingui/react/macro'
import { isOneOf } from 'narrowland'
import { Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { Arrival } from '@/components/game/arrival'
import { BarScore } from '@/components/game/bar-score'
import { BestScoresLine } from '@/components/game/best-scores-line'
import { DigitStrip } from '@/components/game/digit-strip'
import { FloatingLifeLoss } from '@/components/game/floating-life-loss'
import { FloatingPoints } from '@/components/game/floating-points'
import { FloatingStat } from '@/components/game/floating-stat'
import { HeartIcon } from '@/components/game/heart-icon'
import { PencilWipe } from '@/components/game/pencil-wipe'
import { RunStopwatch } from '@/components/game/run-stopwatch'
import { RunTopBar } from '@/components/game/run-top-bar'
import { TutorialStepper } from '@/components/game/tutorial-stepper'
import { TYPE } from '@/constants/typography'
import type { ScreenField } from '@/hooks/use-play-field'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenBoards } from '@/hooks/use-run-boards'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenSession } from '@/hooks/use-run-session'
import { SchemeProvider } from '@/hooks/use-scheme'
import { DRAW } from '@/lib/dial-sketch'
import { sessionBestsOf } from '@/lib/run-session'
import { wordmarkFor } from '@/lib/run-title'
import { multiplierColor } from '@/lib/streak-badge'
import { bestOn } from '@/machines/game'
import { runLabel, SCORED_MODES, showsFigures } from '@/modes'

// What the pause button does, or null where it is not drawn. It stands through a held run's
// opening too, so the top bar is whole from the first frame: a tap there is the opening's skip,
// which lies over the bar, and so this one is never heard.
const pauseButtonPress = (
  playing: boolean,
  held: boolean,
  pause: () => void,
): (() => void) | null => {
  if (playing) return pause
  return held ? () => {} : null
}

// The row of hearts and score on a **mirrored** dial, drawn back to front like the rest of it.
const MIRRORED_ROW = { transform: [{ scaleX: -1 }] }

// The hearts are laid in a row, a few points apart; a board drawn in wraps them in a box of their
// own, which has to lay them out the same way.
const HEARTS_ROW = { flexDirection: 'row', gap: 4 } as const
// Every row above the dial, in the scheme those rows wear: the best-scores strip, the top
// bar, and the row of hearts, figures and score under it.
export function RunBar({
  control,
  session,
  account,
  boards,
  announcements,
  field,
}: {
  control: ScreenControl
  session: ScreenSession
  account: ScreenAccount
  boards: ScreenBoards
  announcements: ScreenAnnouncements
  field: ScreenField
}) {
  const { t } = useLingui()
  const {
    barGlow,
    barLightStyle,
    dial,
    difficulty,
    digitFont,
    hits,
    isPlaying,
    lives,
    mode,
    opening,
    pauseRun,
    rules,
    runAccent,
    runSession,
    runSessionClosesAt,
    runSubtitle,
    send,
    state,
    stats,
    streak,
    submode,
    tutorial,
  } = control
  const { handleWindowShut } = session
  const { userId } = account
  const { bestEver, bestToday, bestWeek, board, inRun, previousWinner, runSessionBoard } =
    boards
  const { announcement, setAskedAchievement } = announcements
  const {
    avgDirection,
    avgStat,
    barDrawn,
    currentMultiplier,
    floatStats,
    floats,
    furthestStep,
    lesson,
    removeFloat,
    removeFloatStat,
    setRewindSeq,
  } = field
  return (
    <>
      {/* Every row above the dial, in the scheme those rows wear. */}
      <SchemeProvider kind={opening.barScheme} ink={opening.barTint}>
        <Animated.View style={barLightStyle}>
          {/* Row 0 — board bests, a hairline above the top bar. In every mode,
  Trainee included: it has no board to report, and reserves the height
  instead, so that the dial below is the same size in all of them. */}
          <Arrival order={0} from="above">
            <BestScoresLine
              session={sessionBestsOf(
                runSession,
                runSessionClosesAt,
                runSessionBoard,
                rules.scoring.measure,
                userId,
                previousWinner,
              )}
              onWindowShut={handleWindowShut}
              inRun={inRun}
              mode={mode}
              announcement={announcement}
              onOpenAchievement={(id) => {
                pauseRun('achievement')
                setAskedAchievement(id)
              }}
              onPause={() => {
                pauseRun('best_scores')
              }}
              viewerId={userId}
              score={state.context.score}
              yourBest={bestOn(stats, mode, difficulty).score}
              loaded={board.loaded}
              todayIsMine={board.today.recordIsMine}
              weekIsMine={board.week.recordIsMine}
              everIsMine={board.forever.recordIsMine}
              todayHolder={board.today.recordHolder}
              weekHolder={board.week.recordHolder}
              everHolder={board.forever.recordHolder}
              today={bestToday}
              week={bestWeek}
              ever={bestEver}
            />
          </Arrival>
          {/* A step up in the stack, which only ever matters during the tutorial: the
      card's tap-through is the last child of this screen and covers everything
      under this band, so without the lift MENU would be unreachable for as
      long as a card was up. Harmless everywhere else — nothing else here
      overlaps the bar. */}
          <View className="mb-3" style={{ zIndex: 1 }}>
            {/* Row 1 — the same bar every run is played under. NINE is tinted by
        the rung here; the pause button shows only while a run is actually
        going, since the screen it opens is a full overlay that covers this
        slot rather than needing a button of its own on top. */}
            <View className="mb-1">
              <RunTopBar
                accent={runAccent}
                title={t(runLabel(mode, submode))}
                subtitle={runSubtitle === null ? null : t(runSubtitle).toLowerCase()}
                wordmark={wordmarkFor(mode, difficulty)}
                mirrored={dial.mirror}
                drawn={barDrawn}
                onPause={pauseButtonPress(isPlaying, opening.held, () => {
                  pauseRun('button')
                })}
              />
            </View>

            {/* Row 2 — hearts · center stat or the lesson's steps · score cluster */}
            <View
              className="mt-1.5 flex-row items-center"
              style={dial.mirror ? MIRRORED_ROW : undefined}
            >
              {/* Hearts — one per life the mode actually gives, and a mode that
        spends none shows none.

        **As many as the mode gives, not three.** This drew a fixed `[0, 1, 2]`
        whatever the rules said, which was right while every mode that spent
        lives spent three of them. A challenge may pin two — `four-keys` does —
        and the third heart then rendered empty: it stayed mounted across the
        mode change with `filled` flipping true → false, which is precisely the
        signal `HeartIcon` plays the *losing a life* sequence for. So a
        challenge opened by visibly killing a heart the player never had, on
        its first frame.

        Drawing the real count fixes it at the source: the extra heart is
        unmounted rather than emptied, and an unmount animates nothing. Losing
        a life mid-run still flips a mounted heart and still plays. */}
              <Arrival order={4} from="above" className="relative flex-1 flex-row gap-1">
                {/* Drawn in after the top line, on a board that is being drawn. */}
                <PencilWipe progress={barDrawn} window={DRAW.hearts} style={HEARTS_ROW}>
                  {rules.lives.count !== Number.POSITIVE_INFINITY &&
                    Array.from({ length: rules.lives.count }, (_, i) => (
                      <HeartIcon key={i} filled={i < lives} emptyColor={'#FDFCFA'} />
                    ))}
                </PencilWipe>
                {/* Says why, the moment a hit rather than an expiry is what took the
          heart — Accuracy's wasteful-hit rule is invisible otherwise.
          Shares the points floats' lifecycle: same `floats` list, same
          removal, just a second element for the rare entry that costLife. */}
                {floats
                  .filter((f) => f.costLife)
                  .map((f) => (
                    <FloatingLifeLoss
                      key={f.id}
                      onDone={() => {
                        removeFloat(f.id)
                      }}
                    />
                  ))}
              </Arrival>

              {/* Where the player is in the lesson, in the slot a scored run keeps its
          score bar in — which a tutorial draws nothing of: no hearts, since its
          lives never run out, no accuracy, and no score. So the row is empty in
          a lesson, and this is the one place on the screen that both belongs to
          the run's own chrome and has nothing else to say.

          It sat under the board once, between the targets and the banner. Up
          here it is the top bar's third line rather than something floating in
          the playfield, and the canvas below keeps the height the dots were
          taking.

          Dark and deaf while one of the lesson's cards is up: the card's
          tap-through takes the whole viewport under this band, so a press here
          is a press meant for the card. `onTapThrough` is non-null exactly at
          those steps. */}
              <Arrival order={5} from="above">
                {tutorial && (
                  <TutorialStepper
                    current={hits}
                    furthest={furthestStep}
                    live={lesson.onTapThrough === null}
                    onGo={(board) => {
                      send({ type: 'REWIND', board, now: Date.now() })
                      setRewindSeq((seq) => seq + 1)
                    }}
                  />
                )}

                {/* Center: the figure the run is judged by.
          
          A race is judged by its clock, so that is what stands here — the
          same number the standings will place it on, running. A hits run is
          judged by how many targets it has taken, and shows that count: its
          average accuracy could only ever read 100%, a slip being the end of
          it. Every other scored run is judged by a factor and shows the
          average of it. Nothing stands here on a mode with neither. */}
                {!showsFigures(mode) && rules.scoring.measure === 'time' && (
                  <RunStopwatch
                    elapsedMs={state.context.elapsedMs}
                    playingSince={state.context.playingSince}
                    digitFont={digitFont}
                  />
                )}

                {!showsFigures(mode) && rules.scoring.measure === 'hits' && (
                  <DigitStrip text={String(hits)} direction={1} />
                )}

                {!showsFigures(mode) &&
                  rules.scoring.measure === 'score' &&
                  isOneOf(mode, SCORED_MODES) && (
                    <View style={{ alignItems: 'center' }}>
                      <DigitStrip text={`${avgStat}%`} direction={avgDirection.current} />
                      {floatStats.map((f) => (
                        <FloatingStat
                          key={f.id}
                          value={f.value}
                          progress={f.progress}
                          onDone={() => {
                            removeFloatStat(f.id)
                          }}
                        />
                      ))}
                    </View>
                  )}
              </Arrival>

              {/* Score cluster: digital readout + streak multiplier badge.
      Hidden in a mode that keeps no board — practice is not a scored run. */}
              <Arrival order={6} from="above" className="flex-1 relative items-end">
                {rules.capabilities.scored && (
                  <>
                    <PencilWipe progress={barDrawn} window={DRAW.score}>
                      <View className="flex-row items-baseline gap-1.5">
                        <BarScore
                          score={state.context.score}
                          digitFont={digitFont}
                          glow={barGlow}
                        />
                        {streak > 0 && (
                          <Text
                            selectable={false}
                            className={TYPE.buttonSm}
                            style={[
                              {
                                color:
                                  opening.barInk ?? multiplierColor(currentMultiplier),
                              },
                              barGlow,
                            ]}
                          >
                            {`×${currentMultiplier}`}
                          </Text>
                        )}
                      </View>
                    </PencilWipe>
                    {floats.map((f) => (
                      <FloatingPoints
                        key={f.id}
                        points={f.points}
                        progress={f.progress}
                        multiplier={f.multiplier}
                        onDone={() => {
                          removeFloat(f.id)
                        }}
                      />
                    ))}
                  </>
                )}
              </Arrival>
            </View>
          </View>
        </Animated.View>
      </SchemeProvider>
    </>
  )
}
