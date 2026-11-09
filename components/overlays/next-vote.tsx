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

import { Tile, TileGrid } from '@/components/overlays/admin-tile'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { VoteOption } from '@/lib/session-ratings'
import { gradientOf, labelOf } from '@/modes'

// Larger than the admin gallery's 22: on a two-tile card the mark is the first thing read.
const MARK_SIZE = 34

// The choosing, in beats: the other tile fades and the chosen one slides to the middle of
// the grid, where it stays as the card's one tile.
const FADE_MS = 220
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
//
// It holds the candidate just tapped as well, for a third thing that has to turn with them:
// the frame's own ground, which takes the picked challenge's gradient the moment it is
// picked — see `voteFill`.
export function useVoteView(options: readonly VoteOption[]) {
  const mineId = options.find((option) => option.mine)?.modeId ?? null
  const [picking, setPicking] = useState(mineId === null)
  const [chosen, setChosen] = useState<string | null>(null)
  // The candidate the player picked on this card, kept once its tile has finished playing.
  // The settled card and the frame's ground follow *this* rather than the options' `mine`,
  // which is the server's word and arrives later — or not at all, where the vote was
  // refused — and a ground that depended on it fell back to the plain surface the moment
  // the pick's animation ended.
  const [pick, setPick] = useState<string | null>(null)
  const settledId = picking ? null : (pick ?? mineId)
  return {
    picking,
    setPicking,
    chosen,
    setChosen,
    setPick,
    settledId,
    settled: settledId !== null,
  }
}

// The gradient the frame paints itself in once a challenge is picked: the one just tapped,
// or, on a card that opens on a pick already made, the one that was made. Undefined while
// the player is still choosing, which leaves the frame in its ordinary colours.
export const voteFill = (
  view: ReturnType<typeof useVoteView>,
): readonly [string, string] | undefined => {
  const modeId = view.chosen ?? view.settledId
  return modeId === null ? undefined : gradientOf(modeId)
}

// What the frame writes in over `voteFill`: white once there is one, else the frame's own.
export const VOTE_INK = '#FFFFFF'

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
  const fade = useSharedValue(1)
  const shift = useSharedValue(0)

  useEffect(() => {
    if (settled || chosen === null) return
    if (isChosen) {
      // Half a cell towards the middle: the left tile moves right, the right one left.
      shift.value = withTiming((index === 0 ? 1 : -1) * (gridWidth / 4), {
        duration: MOVE_MS,
        easing: Easing.out(Easing.cubic),
      })
      return
    }
    fade.value = withTiming(0, { duration: FADE_MS })
  }, [chosen])

  const cellStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: shift.value }],
  }))
  const colors = gradientOf(option.modeId)

  return (
    <Animated.View style={cellStyle} pointerEvents={gone ? 'none' : 'auto'}>
      <View
        className="overflow-hidden rounded-2xl border-2"
        style={{ borderColor: 'rgba(255,255,255,0.7)' }}
      >
        <Tile
          id="vote.option"
          clear
          backdrop={
            // The challenge's own gradient, full strength, so the tile is the challenge in
            // its colours — and keeps it through the pick, the move and the hand-over to
            // the settled card, so the picked tile only ever moves.
            <View pointerEvents="none" className="absolute inset-0">
              <LinearGradient
                colors={[...colors]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
              />
            </View>
          }
          // White throughout, on the challenge's gradient. The mark sits at the top and the
          // name at the bottom — the tile's `note` slot, with an empty heading to keep the
          // name out of the top group. The challenge's line is left off: the square was
          // too small for it, and a description cut off mid-sentence read worse than none —
          // the name is what the vote is between.
          mark={<ChallengeMark modeId={option.modeId} color="#FFFFFF" size={MARK_SIZE} />}
          heading={<View />}
          note={
            <Text selectable={false} className={cn(TYPE.cardTitle, 'text-white')}>
              {t(labelOf(option.modeId))}
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
  const { setPicking, chosen, setChosen, setPick, settled, settledId } = view
  // The grid's width, to know how far the middle is; and the pending hand-over to the
  // settled card. The candidate just tapped lives on `view`, where the frame can see it.
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
    const mine = options.find((option) => option.modeId === settledId)
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
                setPick(option.modeId)
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
