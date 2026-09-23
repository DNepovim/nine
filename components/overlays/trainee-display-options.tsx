import { Ionicons } from '@expo/vector-icons'
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

// Everything Trainee can print to teach with, set from the pause screen — the one place
// a player is already looking at the board and can change something to see what it does.
//
// The four tiles are a picture of a dial key: the tile you tap is the corner you are
// setting, and it reads back what that corner currently shows. A list of switches said
// nothing about where any of these appear; this says it without a word of explanation.
// Under them sits the one number that is not on a key at all.
export function TraineeDisplayOptions({
  corners,
  onEdit,
  showPar,
  onTogglePar,
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
  // How long a Trainee target lasts, in ms. Held in ms because that is what the machine
  // spawns with; the slider works in whole seconds and converts at the edge.
  traineeTimeoutMs: number
  onSetTraineeTimeout: (ms: number) => void
}) {
  const { t } = useLingui()
  const { colorScheme } = useTheme()

  return (
    <View className="w-full items-center gap-4">
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
                  style={{ maxWidth: 160, height: HINT_TILE_HEIGHT }}
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

      {/* Full width, under the grid: the grid is about one key, and this is about every
          target on the board. Same tile so the block reads as one set of controls. */}
      <Pressable
        onPress={onTogglePar}
        hitSlop={6}
        className="w-full flex-row items-center gap-3 rounded-2xl bg-card px-3"
        style={{ maxWidth: 322, height: HINT_TILE_HEIGHT }}
      >
        <OptionCheckbox checked={showPar} onCard />
        <Text
          selectable={false}
          className="shrink font-mono text-[10px] font-black tracking-[1px] text-primary"
        >
          {t`FEWEST MOVES ON TARGETS`}
        </Text>
      </Pressable>

      {/* How long a target lasts. Trainee's clock is the one in the game that is not
          part of the test, so it is the one a player may set — and the pause screen is
          where they can set it and go straight back to feel the difference. */}
      <View className="w-full" style={{ maxWidth: 322 }}>
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
