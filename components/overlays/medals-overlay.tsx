import { Trans, useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import type { ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import { TakerName } from '@/components/overlays/taker-name'
import { GRAYSCALE } from '@/constants/colors'
import { useChampionsContext } from '@/hooks/use-champions'
import { useViewport } from '@/hooks/use-viewport'
import { displayName } from '@/lib/announcements'
import { championMark } from '@/lib/champions'
import { formatShortDay } from '@/lib/format-date'
import { HISTORY_DAYS, type TakenMedal } from '@/lib/medal-history'
import { heldMedals, PERIOD_CODES, type BoardStanding, type Medal } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'
import { DIFFICULTIES, MODE_GRADIENT, MODES } from '@/machines/game'

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
        style={{ color: drained ? GRAYSCALE[1] : MODE_GRADIENT[mode][0] }}
      >
        {t(MODES[mode].label)} {t(DIFFICULTIES[difficulty].code)}
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

function Heading({ children }: { children: ReactNode }) {
  return (
    <Text
      selectable={false}
      className="font-mono text-[9px] font-black tracking-[2px] text-dim"
    >
      {children}
    </Text>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Text selectable={false} className="font-mono text-[10px] leading-[16px] text-dim">
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
    <View className="gap-0.5">
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
          <View className="gap-2 pt-2">
            <Heading>
              <Trans>HOLDING</Trans>
            </Heading>
            {isEmptyArray(held) ? (
              <Empty>
                <Trans>Nothing yet — a top three on any board puts a medal here.</Trans>
              </Empty>
            ) : (
              held.map((medal) => (
                <View
                  key={`${medal.mode}:${medal.difficulty}:${medal.period}`}
                  className="flex-row items-center gap-1.5"
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

            <View className="mt-4 gap-2">
              <Heading>
                <Trans>TAKEN IN THE LAST {HISTORY_DAYS} DAYS</Trans>
              </Heading>
              {isEmptyArray(history) ? (
                <Empty>
                  <Trans>Nobody has taken anything off you.</Trans>
                </Empty>
              ) : (
                history.map((taken) => (
                  <TakenRow
                    key={`${taken.day}:${taken.mode}:${taken.difficulty}:${taken.period}:${taken.had}`}
                    taken={taken}
                  />
                ))
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </ModalCard>
  )
}
