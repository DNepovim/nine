import { useLingui } from '@lingui/react/macro'
import { View } from 'react-native'

import { ArrivalStage } from '@/components/game/arrival'
import {
  OpeningLayer,
  OpeningOver,
  OpeningRemains,
  OpeningUnder,
} from '@/components/game/opening-layer'
import { RunBar } from '@/components/game/run-bar'
import { RunDial } from '@/components/game/run-dial'
import { RunSumRow } from '@/components/game/run-sum-row'
import { RunTargets } from '@/components/game/run-targets'
import { StrikeShot } from '@/components/game/strike-shot'
import { Screen } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import type { ScreenLifeLoss } from '@/hooks/use-life-loss'
import type { ScreenField } from '@/hooks/use-play-field'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenBoards } from '@/hooks/use-run-boards'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenSession } from '@/hooks/use-run-session'
import { SchemeProvider } from '@/hooks/use-scheme'

// The game screen itself, in the run's **scheme**: the opening's under-layer and remains, the
// run arriving a piece at a time — the bar, the targets, the dial — and the opening over it.
export function GameLayer({
  control,
  session,
  account,
  boards,
  announcements,
  field,
  dying,
}: {
  control: ScreenControl
  session: ScreenSession
  account: ScreenAccount
  boards: ScreenBoards
  announcements: ScreenAnnouncements
  field: ScreenField
  dying: ScreenLifeLoss
}) {
  const { t } = useLingui()
  const {
    dial,
    hits,
    isGameOver,
    isMenu,
    isPlaying,
    lives,
    opening,
    rules,
    send,
    state,
    streak,
  } = control
  const { avgAccuracy, avgSpeed } = announcements
  const { lesson, removeShot, shots, shuffleDial } = field
  const { lostMarks } = dying
  return (
    <>
      {/* ── Game screen (single padded wrapper) ── */}
      {/* In the run's **scheme**; the overlays after it keep their own. */}
      <SchemeProvider kind={opening.scheme}>
        {/* What the opening left behind, under everything the run draws. */}
        <OpeningUnder kind={opening.layer} sweep={opening.sweep} />
        <OpeningRemains
          kind={opening.remains}
          lit={opening.peeking}
          pull={opening.pull}
          running={isPlaying}
          finished={isGameOver}
          runId={state.context.runId}
          grid={state.context.grid}
          figures={{ accuracy: avgAccuracy, speed: avgSpeed, streak, hits, lives }}
        />
        {/* Each time a run leaves the intro, the screen comes in a piece at a time
        — see components/game/arrival.tsx. */}
        <ArrivalStage arrived={!isMenu} topAtOnce={dial.mirror}>
          <Screen>
            <RunBar
              control={control}
              session={session}
              account={account}
              boards={boards}
              announcements={announcements}
              field={field}
            />

            {/* The board and the sum row in one box, because a strike's shot crosses
          between them: the layer at the end of it is absolute over both, and this
          is the only space where the muzzle and the target it is aimed at are
          measured from the same origin. */}
            <View className="flex-1">
              <RunTargets
                control={control}
                announcements={announcements}
                field={field}
                dying={dying}
              />

              <RunSumRow control={control} field={field} />

              {/* ── Strike shots ── */}
              <View pointerEvents="none" className="absolute inset-0 overflow-visible">
                {shots.map((shot) => (
                  <StrikeShot
                    key={shot.id}
                    kind={shot.kind}
                    fromX={shot.from.x}
                    fromY={shot.from.y}
                    toX={shot.to.x}
                    toY={shot.to.y}
                    radius={shot.radius}
                    sumDigits={shot.sumDigits}
                    rounds={shot.rounds}
                    seed={shot.id}
                    onDone={() => {
                      removeShot(shot.id)
                    }}
                  />
                ))}
              </View>
            </View>

            <RunDial control={control} announcements={announcements} field={field} />

            {/* ── Tap-through for the lesson's two pointing cards ── */}
            {/* A card asking to be read holds the dial shut, and this is the other half
          of that: a tap anywhere is how the player says they have read it, rather
          than waiting out a clock they cannot see. Mounted only while a card is up,
          so nothing catches a press that belongs to the game. Every key is already
          inert underneath — the dial is `off` at these steps — so this exists to
          hear the tap, not to block one.

          A child of the screen rather than a layer over the whole app, and that is
          what leaves the top bar above it: the bar is lifted a step in the stack
          below, so MENU stays pressable while a card is up. A lesson is still a run,
          and a run the player cannot put down because it is explaining itself is the
          one thing this card must not become. The negative insets cancel the
          screen's own padding, so what is left under the bar is covered to the
          edges. */}
            {lesson.onTapThrough !== null && (
              <TrackedPressable
                id="tutorial.tap_through"
                onPress={lesson.onTapThrough}
                className="absolute -bottom-2 -left-4 -right-4 top-0"
                accessibilityLabel={t`Continue the tutorial`}
              />
            )}
          </Screen>
        </ArrivalStage>

        {/* The remains, in front of the run — see `OpeningOver`. */}
        <OpeningOver
          kind={opening.remains}
          pull={opening.pull}
          onPeek={opening.peek}
          livesLost={rules.lives.count - state.context.lives}
          livesLeft={state.context.lives}
          lostAt={lostMarks}
          running={isPlaying}
          finished={isGameOver}
          runId={state.context.runId}
          grid={state.context.grid}
          onEnd={() => {
            send({ type: 'CRASH', now: Date.now() })
          }}
          onShuffle={shuffleDial}
        />

        {/* ── The opening, over the held run ── */}
        {/* Drawn only while the run is **ready**. The switch turns the screen under it
          over to the mode's scheme; the end, or a tap, starts the run's clock. */}
        {opening.layer !== null && (
          <OpeningLayer
            key={state.context.runId}
            kind={opening.layer}
            take={opening.take}
            sweep={opening.sweep}
            barLight={opening.barLight}
            onShuffle={shuffleDial}
            onSwitch={opening.onSwitch}
            onDone={() => {
              opening.onSwitch()
              send({ type: 'BEGIN', now: Date.now() })
            }}
          />
        )}
      </SchemeProvider>
    </>
  )
}
