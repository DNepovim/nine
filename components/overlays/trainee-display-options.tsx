import { Ionicons } from '@expo/vector-icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Pressable, Text, View } from 'react-native'

import type { BadgeCorner } from '@/components/game/dial-badge'
import { OptionCheckbox } from '@/components/overlays/option-checkbox'
import { ValueSlider } from '@/components/overlays/value-slider'
import { DIM_INK } from '@/constants/colors'
import {
  DIAL_CORNERS,
  DIAL_HINT_LABEL,
  HINT_TILE_HEIGHT,
  NO_HINT_LABEL,
  TRAINEE_TIMEOUT_MAX_MS,
  TRAINEE_TIMEOUT_MIN_MS,
  TRAINEE_TIMEOUT_STEP_MS,
  type DialCorners,
} from '@/constants/dial-hints'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/cn'

// The three things Trainee prints that are not on a key, in the order a player meets
// them: the numbers above the board, the route drawn under them, then the one figure
// that rides a target itself.
const SWITCHES = ['stats', 'route', 'par'] as const

type Switch = (typeof SWITCHES)[number]

// Named for the thing, not for what the switch does to it: a checkbox already says
// "show", and three tiles each repeating the word left less room for the half that
// differs. Two words apiece, one line per tile, in the same type the corner tiles use.
const SWITCH_LABEL = {
  stats: msg`GAME STATS`,
  route: msg`OPTIMAL PATH`,
  par: msg`FEWEST MOVES`,
} as const satisfies Record<Switch, MessageDescriptor>

// One column of the two the block is laid out on, shared by the corner tiles and the
// switches so the two grids stand on the same edges, and the gap between the columns —
// the slider below spans both, and gets its width from them rather than from a number
// typed to match.
const TILE_WIDTH = 160
const GRID_GAP = 8

// Everything Trainee can print to teach with, set from the pause screen — the one place
// a player is already looking at the board and can change something to see what it does.
//
// The four tiles are a picture of a dial key: the tile you tap is the corner you are
// setting, and it reads back what that corner currently shows. A list of switches said
// nothing about where any of these appear; this says it without a word of explanation.
// Under them sit the three things Trainee prints that are not on a key at all.
export function TraineeDisplayOptions({
  corners,
  onEdit,
  showPar,
  onTogglePar,
  showStats,
  onToggleStats,
  showRoute,
  onToggleRoute,
  traineeTimeoutMs,
  onSetTraineeTimeout,
}: {
  corners: DialCorners
  // Which tile was tapped. The dialog it opens is the pause screen's to render, not
  // this grid's: a dialog mounted in here would scrim its own parent rather than the
  // screen, and the dark rectangle would land on these four tiles alone.
  onEdit: (corner: BadgeCorner) => void
  // The fewest-moves number each target wears — the optimal route's length, not a key's
  // anything, which is why it sits apart from the grid rather than in it.
  showPar: boolean
  onTogglePar: () => void
  // The HITS / ACCURACY / SPEED row above the board, and the keys to press for the
  // optimal route under the coach's line. Both sit on the board rather than on a key,
  // which is why they join the par switch below the grid instead of inside it.
  showStats: boolean
  onToggleStats: () => void
  showRoute: boolean
  onToggleRoute: () => void
  // How long a Trainee target lasts, in ms. Held in ms because that is what the machine
  // spawns with; the slider works in whole seconds and converts at the edge.
  traineeTimeoutMs: number
  onSetTraineeTimeout: (ms: number) => void
}) {
  const { t } = useLingui()
  const { colorScheme } = useTheme()

  // Read off the props rather than assembled into rows of objects: the layout below
  // already says which tile goes where, and a switch is nothing but a label, a state
  // and a toggle.
  const checked = { stats: showStats, route: showRoute, par: showPar }
  const onToggle = { stats: onToggleStats, route: onToggleRoute, par: onTogglePar }

  return (
    <View className="w-full items-center gap-3">
      <Text
        selectable={false}
        className="font-mono text-[9px] font-bold tracking-[1.5px] text-dim"
      >
        {t`NUMBERS ON THE KEYS`}
      </Text>

      {/* Two rows of two, in the corners' own reading order. */}
      <View className="w-full items-center gap-2">
        {[DIAL_CORNERS.slice(0, 2), DIAL_CORNERS.slice(2)].map((row) => (
          <View key={row.join()} className="w-full flex-row justify-center gap-2">
            {row.map((corner) => {
              const hint = corners[corner]
              return (
                <Pressable
                  key={corner}
                  onPress={() => {
                    onEdit(corner)
                  }}
                  hitSlop={6}
                  className="flex-1 flex-row items-center justify-between gap-2 rounded-2xl bg-card px-3"
                  style={{ maxWidth: TILE_WIDTH, height: HINT_TILE_HEIGHT }}
                >
                  <Text
                    selectable={false}
                    className={cn(
                      'shrink font-mono text-[10px] tracking-[1px]',
                      hint === null ? 'text-dim' : 'font-black text-primary',
                    )}
                  >
                    {hint === null ? t(NO_HINT_LABEL) : t(DIAL_HINT_LABEL[hint])}
                  </Text>
                  {/* The mark that says this is a choice and not a label. */}
                  <Ionicons name="chevron-down" size={12} color={DIM_INK[colorScheme]} />
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>

      {/* Under the grid, on the same two columns: the grid is about one key, and these
          are about the board around it, so they line up with it rather than starting a
          new shape. Three into two leaves the last tile alone — it keeps its column
          width beside an empty slot instead of stretching across, which would read as
          a wider control rather than the third of three.

          Each says what it shows rather than what it hides. All three start off, so a
          stack of switches meaning "hide this" would be empty boxes for things already
          gone; checked-is-showing is the only reading where an empty box and an absent
          number say the same thing. */}
      <View className="w-full items-center gap-2">
        {[SWITCHES.slice(0, 2), SWITCHES.slice(2)].map((row) => (
          <View key={row[0]} className="w-full flex-row justify-center gap-2">
            {row.map((key) => (
              <Pressable
                key={key}
                onPress={onToggle[key]}
                hitSlop={6}
                className="flex-1 flex-row items-center gap-2 rounded-2xl bg-card px-2.5"
                style={{ maxWidth: TILE_WIDTH, height: HINT_TILE_HEIGHT }}
              >
                <OptionCheckbox checked={checked[key]} onCard />
                <Text
                  selectable={false}
                  className="shrink font-mono text-[10px] font-black tracking-[1px] text-primary"
                >
                  {t(SWITCH_LABEL[key])}
                </Text>
              </Pressable>
            ))}
            {/* The empty half of the last row, so the tile beside it keeps its column. */}
            {row.length === 1 && (
              <View className="flex-1" style={{ maxWidth: TILE_WIDTH }} />
            )}
          </View>
        ))}
      </View>

      {/* How long a target lasts. Trainee's clock is the one in the game that is not
          part of the test, so it is the one a player may set — and the pause screen is
          where they can set it and go straight back to feel the difference. */}
      <View className="w-full" style={{ maxWidth: 2 * TILE_WIDTH + GRID_GAP }}>
        <Text
          selectable={false}
          className="mb-1 font-mono text-[9px] font-bold tracking-[1.5px] text-dim"
        >
          {t`TIME PER TARGET`}
        </Text>
        {/* Driven in ms, the unit the machine spawns with, and written in seconds —
            rounded, because the ends come off the mode table and land on 7.3 and 63.8. */}
        <ValueSlider
          value={traineeTimeoutMs}
          min={TRAINEE_TIMEOUT_MIN_MS}
          max={TRAINEE_TIMEOUT_MAX_MS}
          step={TRAINEE_TIMEOUT_STEP_MS}
          format={(ms) => `${Math.round(ms / 1000)}s`}
          onChange={onSetTraineeTimeout}
        />
      </View>
    </View>
  )
}
