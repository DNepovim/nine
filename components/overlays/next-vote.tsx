import { Trans, useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { Tile, TileGrid, washOf } from '@/components/overlays/admin-tile'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { VoteOption } from '@/lib/session-ratings'
import { descriptionOf, gradientOf, labelOf } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// Larger than the admin gallery's 22: on a two-tile card the mark is the first thing read.
const MARK_SIZE = 34

// The choosing, in beats: the other tile fades and the chosen one's fill comes in; a moment
// later its ink turns white, once the fill is deep enough to carry it; and it slides to the
// middle of the grid, where it stays as the card's one tile.
const FADE_MS = 220
const INK_AT_MS = 120
const MOVE_MS = 380
const HOLD_MS = MOVE_MS + 60

// The dialog's title, for whichever card frames the body: the standard gray one in the
// header row beside the close button, so the body does not carry a heading of its own.
//
// It turns to YOUR CHOICE once the card is down to the one tile the player picked.
export function NextVoteTitle({ settled }: { settled: boolean }) {
  return settled ? <Trans>YOUR CHOICE</Trans> : <Trans>WHICH ONE SHOULD BE NEXT?</Trans>
}

// Whether the card is on its pick or on the tiles to pick from — held by the frame rather
// than the body, because the frame draws the title and the body the tiles, and the two have
// to turn together. Starts on the pick for a player who has voted already.
export function useVoteView(options: readonly VoteOption[]) {
  const [picking, setPicking] = useState(!options.some((option) => option.mine))
  const settled = !picking && options.some((option) => option.mine)
  return { picking, setPicking, settled }
}

// One tile, and what it does when a pick is made. Module level so the animated values live
// as long as the tile does.
function VoteTile({
  option,
  index,
  chosen,
  gridWidth,
  settled = false,
  onPick,
}: {
  option: VoteOption
  index: number
  // The candidate picked, by its challenge, or null while nothing has been.
  chosen: string | null
  gridWidth: number
  // Already the picked tile, at rest: filled, white and in the middle, with nothing to play.
  settled?: boolean
  onPick: () => void
}) {
  const { t } = useLingui()
  const isChosen = settled || chosen === option.modeId
  const gone = chosen !== null && !isChosen
  // Whether the ink has turned. Later than the fill so it never reads white on pale.
  const [inked, setInked] = useState(settled)
  const fill = useSharedValue(settled ? 1 : 0)
  const fade = useSharedValue(1)
  const shift = useSharedValue(0)

  useEffect(() => {
    if (settled || chosen === null) return
    if (isChosen) {
      fill.value = withTiming(1, { duration: FADE_MS })
      // Half a cell towards the middle: the left tile moves right, the right one left.
      shift.value = withTiming((index === 0 ? 1 : -1) * (gridWidth / 4), {
        duration: MOVE_MS,
        easing: Easing.out(Easing.cubic),
      })
      const timer = setTimeout(() => {
        setInked(true)
      }, INK_AT_MS)
      return () => {
        clearTimeout(timer)
      }
    }
    fade.value = withTiming(0, { duration: FADE_MS })
  }, [chosen])

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }))
  const cellStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: shift.value }],
  }))
  const colors = gradientOf(option.modeId)

  return (
    <Animated.View style={cellStyle} pointerEvents={gone ? 'none' : 'auto'}>
      <View
        className="overflow-hidden rounded-2xl border-2"
        style={{ borderColor: colors[1] }}
      >
        <Tile
          id="vote.option"
          wash={washOf(option.modeId)}
          backdrop={
            <Animated.View
              pointerEvents="none"
              className="absolute inset-0"
              style={fillStyle}
            >
              <LinearGradient
                colors={[...colors]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
              />
            </Animated.View>
          }
          mark={
            <ChallengeMark
              modeId={option.modeId}
              color={inked ? '#FFFFFF' : challengeInk(colors[1])}
              size={MARK_SIZE}
            />
          }
          heading={
            inked ? (
              <Text selectable={false} className={cn(TYPE.cardTitle, 'text-white')}>
                {t(labelOf(option.modeId))}
              </Text>
            ) : (
              <ChallengeTitle modeId={option.modeId} className={TYPE.cardTitle} wrap />
            )
          }
          note={
            <Text
              selectable={false}
              numberOfLines={4}
              className={cn(TYPE.proseSm, inked ? 'text-white' : 'text-dim')}
            >
              {t(descriptionOf(option.modeId))}
            </Text>
          }
          onPress={onPick}
        />
      </View>
    </Animated.View>
  )
}

// **The vote** as a card's body: the two challenges to pick from, and once one is picked,
// that one alone.
//
// A body and not a dialog, because it stands in two places and has to be the same one in
// both: the third step of the rating dialog and the dialog the intro's link opens. The
// caller supplies the frame, the title and the way out, and holds `view` — see
// `useVoteView`.
//
// A tap on a tile sends the vote at once — there is no SEND — and the tile plays the
// choosing out. No counts anywhere: a tally beforehand would be a bandwagon to join rather
// than a choice to make. A player who has voted already opens on their pick.
export function NextVote({
  options,
  onVote,
  onClose,
  view,
}: {
  options: readonly VoteOption[]
  onVote: (modeId: string) => void
  // Pressing the settled tile closes the card: it is the answer, and the one thing left on
  // screen to press.
  onClose: () => void
  view: ReturnType<typeof useVoteView>
}) {
  const { setPicking, settled } = view
  // The candidate just tapped, while its tile plays out; the grid's width, to know how far
  // the middle is; and the pending hand-over to the settled card.
  const [chosen, setChosen] = useState<string | null>(null)
  const [gridWidth, setGridWidth] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  // Down to the one: the tile the player picked, in the middle. Pressing it closes the card.
  if (settled) {
    const mine = options.find((option) => option.mine)
    if (mine === undefined) return null
    return (
      <View className="w-full items-center">
        {/* The same wrappers as the grid it replaces — the full-width box, the row pulled out
          by the cell padding, and a half-width cell — so the tile keeps its size and the
          dialog its height through the swap. */}
        <View className="mt-5 w-full">
          <View className="-m-[5px] flex-row justify-center">
            <View className="w-1/2 p-[5px]">
              <VoteTile
                option={mine}
                index={0}
                chosen={mine.modeId}
                gridWidth={gridWidth}
                settled
                onPick={onClose}
              />
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="w-full items-center">
      {/* The admin gallery's tiles, two to a row: the mark, the name in its colours, and
        the challenge's own line where the gallery has its figures. No tally here. */}
      <View
        className="mt-5 w-full"
        onLayout={(e) => {
          setGridWidth(e.nativeEvent.layout.width)
        }}
      >
        <TileGrid
          tiles={options.map((option, index) => (
            <VoteTile
              key={option.modeId}
              option={option}
              index={index}
              chosen={chosen}
              gridWidth={gridWidth}
              onPick={() => {
                if (chosen !== null) return
                setChosen(option.modeId)
                if (!option.mine) onVote(option.modeId)
                timer.current = setTimeout(() => {
                  setPicking(false)
                  setChosen(null)
                }, HOLD_MS)
              }}
            />
          ))}
        />
      </View>
    </View>
  )
}
