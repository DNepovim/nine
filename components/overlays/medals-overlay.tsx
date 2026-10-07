import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import { useState, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { CardSection } from '@/components/overlays/card-section'
import { ModalCard } from '@/components/overlays/modal-card'
import { TakerName } from '@/components/overlays/taker-name'
import { TrackedPressable } from '@/components/tracked-pressable'
import { GRAYSCALE } from '@/constants/colors'
import { useChampionsContext } from '@/hooks/use-champions'
import { useViewport } from '@/hooks/use-viewport'
import { displayName } from '@/lib/announcements'
import { championMark } from '@/lib/champions'
import { formatShortDay } from '@/lib/format-date'
import { HISTORY_DAYS, type TakenMedal } from '@/lib/medal-history'
import { heldMedals, PERIOD_CODES, type BoardStanding, type Medal } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'
import { DIFFICULTIES, gradientOf, labelOf } from '@/modes'

// How many losses the list opens on. A bad week on six boards across three windows can
// run to a couple of dozen entries, and a card that opens on all of them buries HOLDING —
// the half the player came here to read — above a scroll they have to climb back out of.
// Seven is a loss a day over the window the list covers, which is already a bad week.
const SHOWN_TAKEN = 7

// How the revealed tail arrives — the comparison table's own step and fade, so a list
// unfolding here beats at the rate a table assembling there does.
const STEP_MS = 18
const FADE_MS = 200

// Which board a medal stands on, spelled out. The line under the title leaves the mode to
// its accent, because its entries sit side by side and a hue is enough to tell them apart;
// a list read down a column has nothing to compare against, so the word goes back in.
function BoardLabel({
  mode,
  difficulty,
  period,
  drained = false,
}: {
  mode: Medal['mode']
  difficulty: Medal['difficulty']
  period: Medal['period']
  // Set on a medal that is gone. Greyscale is what this app uses for a record taken off
  // you — the same drain the lost-medal line runs on, and what tells the two halves of
  // this screen apart at a glance.
  drained?: boolean
}) {
  const { t } = useLingui()
  return (
    <>
      <Text
        selectable={false}
        className="font-mono text-[10px] font-black leading-[16px] tracking-[1px]"
        style={{ color: drained ? GRAYSCALE[1] : gradientOf(mode)[0] }}
      >
        {t(labelOf(mode))} {t(DIFFICULTIES[difficulty].code)}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[8px] font-bold leading-[16px] tracking-[0.5px] text-dim"
      >
        {PERIOD_CODES[period]}
      </Text>
    </>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Text
      selectable={false}
      className="py-1 font-mono text-[10px] leading-[16px] text-dim"
    >
      {children}
    </Text>
  )
}

// One medal that is gone: the board it stood on and the day it went, then who has it.
//
// Two lines rather than one. A nickname is up to twenty characters and the board takes
// most of the row before it starts, so a single line would either wrap where it liked or
// cut the one part of this that is news — and the name is the news.
function TakenRow({ taken }: { taken: TakenMedal }) {
  const champions = useChampionsContext()
  return (
    <View className="gap-0.5 py-1">
      <View className="flex-row items-center gap-1.5">
        <Text selectable={false} className="text-[13px] leading-[16px] opacity-40">
          {rankMedal(taken.had)}
        </Text>
        <BoardLabel
          mode={taken.mode}
          difficulty={taken.difficulty}
          period={taken.period}
          drained
        />
        {/* The day the app noticed, which is the only day it can honestly claim — see
            TakenMedal. Pushed to the end so the dates line up down the column. */}
        <Text
          selectable={false}
          className="ml-auto font-mono text-[8px] font-bold leading-[16px] tracking-[0.5px] text-dim"
        >
          {formatShortDay(taken.day)}
        </Text>
      </View>
      {/* Indented under the board it is about, clearing the medal glyph — the pair reads
          as one entry rather than as two rows that happen to be adjacent. */}
      <View className="pl-[22px]">
        {taken.taker === null ? (
          <Text
            selectable={false}
            className="font-mono text-[9px] font-black leading-[13px] tracking-[1px]"
            style={{ color: GRAYSCALE[1] }}
          >
            <Trans>TAKEN</Trans>
          </Text>
        ) : (
          // Drawn the way the line that announced it drew the same name: flat and grey
          // rather than in the gradient every other name wears, because this is a line
          // about the player's loss and not a celebration of whoever is on it. Tapping
          // it opens their profile, as a name does everywhere it appears.
          <Text
            selectable={false}
            className="font-mono text-[9px] font-bold leading-[13px] tracking-[1px] text-dim"
          >
            <Trans>
              TAKEN BY{' '}
              <TakerName
                userId={taken.taker.userId}
                nickname={displayName(taken.taker.nickname)}
                mark={championMark(taken.taker.userId, champions)}
                color={GRAYSCALE[1]}
              />
            </Trans>
          </Text>
        )}
      </View>
    </View>
  )
}

// Everything behind the medal line: what the player holds right now, and what has been
// taken off them this week.
//
// The line under the title is one claim per mode, which is what a line has room for and
// not what a player wants once they go looking. This is the rest of it — all six boards
// across all three windows — and under it the half that line can never show, because a
// medal that is gone has no entry left to stand in: who took it, and when.
//
// Both halves are drawn the way the profile draws its boards: a small-caps label and a
// card under it, from the same `CardSection`. The two dialogs say the same kind of thing
// about the same boards, and before this they said it in two different shapes.
export function MedalsOverlay({
  standings,
  history,
  onClose,
}: {
  standings: readonly BoardStanding[]
  // The last week's losses, newest first. Empty on a device that has not lost anything
  // since this build landed — the record only goes back as far as the app has kept it.
  history: readonly TakenMedal[]
  onClose: () => void
}) {
  const { height } = useViewport()
  const held = heldMedals(standings)
  const [showAllTaken, setShowAllTaken] = useState(false)
  // Newest first already, so the opening slice is the most recent losses — the ones a
  // player can still answer before the week board empties.
  const shownTaken = showAllTaken ? history : history.slice(0, SHOWN_TAKEN)
  const hiddenTaken = history.length - shownTaken.length

  return (
    <ModalCard
      title={<Trans>MEDALS</Trans>}
      onDismiss={onClose}
      maxHeight={height * 0.85}
    >
      {() => (
        // flexShrink lets a long week scroll while a short one stays its own height —
        // without it the ScrollView would claim the whole cap. The same arrangement the
        // player profile holds its content with.
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 1 }}
        >
          <View className="gap-3 pt-2">
            <CardSection label={<Trans>HOLDING</Trans>}>
              {isEmptyArray(held) ? (
                <Empty>
                  <Trans>Nothing yet — a top three on any board puts a medal here.</Trans>
                </Empty>
              ) : (
                held.map((medal) => (
                  <View
                    key={`${medal.mode}:${medal.difficulty}:${medal.period}`}
                    className="h-7 flex-row items-center gap-1.5"
                  >
                    <Text selectable={false} className="text-[13px] leading-[16px]">
                      {rankMedal(medal.rank)}
                    </Text>
                    <BoardLabel
                      mode={medal.mode}
                      difficulty={medal.difficulty}
                      period={medal.period}
                    />
                  </View>
                ))
              )}
            </CardSection>

            <CardSection label={<Trans>TAKEN IN THE LAST {HISTORY_DAYS} DAYS</Trans>}>
              {isEmptyArray(history) ? (
                <Empty>
                  <Trans>Nobody has taken anything off you.</Trans>
                </Empty>
              ) : (
                shownTaken.map((taken, index) => (
                  <Animated.View
                    key={`${taken.day}:${taken.mode}:${taken.difficulty}:${taken.period}:${taken.had}`}
                    // Only what the toggle reveals arrives on an animation: the rows the
                    // card opens on come up with the card, and playing them in a second
                    // time underneath it would read as the list rebuilding itself. The
                    // delay counts from the first revealed row so the tail drops in one
                    // after another rather than as a block.
                    entering={
                      index < SHOWN_TAKEN
                        ? undefined
                        : FadeInDown.delay((index - SHOWN_TAKEN) * STEP_MS).duration(
                            FADE_MS,
                          )
                    }
                  >
                    <TakenRow taken={taken} />
                  </Animated.View>
                ))
              )}

              {/* The way into the rest of the week, and back out of it. Inside the card
                  rather than under it, because it belongs to this list and not to the
                  dialog — and in dim caps rather than as a button, since nothing happens
                  here but more of what is already on screen. */}
              {(hiddenTaken > 0 || showAllTaken) && (
                <TrackedPressable
                  id="medals.show_more"
                  onPress={() => {
                    setShowAllTaken(!showAllTaken)
                  }}
                  className="items-center py-2"
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[9px] font-black tracking-[1.5px] text-dim"
                  >
                    {showAllTaken ? (
                      <Trans>SHOW LESS</Trans>
                    ) : (
                      <Plural value={hiddenTaken} one="SHOW # MORE" other="SHOW # MORE" />
                    )}
                  </Text>
                </TrackedPressable>
              )}
            </CardSection>
          </View>
        </ScrollView>
      )}
    </ModalCard>
  )
}
