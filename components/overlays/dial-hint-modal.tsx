import { Ionicons } from '@expo/vector-icons'
import { useLingui } from '@lingui/react/macro'
import { Pressable, Text, View } from 'react-native'

import type { BadgeCorner } from '@/components/game/dial-badge'
import { CornerMark } from '@/components/overlays/corner-mark'
import { ModalCard } from '@/components/overlays/modal-card'
import {
  DIAL_CORNER_LABEL,
  DIAL_HINT_LABEL,
  DIAL_HINTS,
  HINT_TILE_HEIGHT,
  NO_HINT_LABEL,
  type DialHint,
} from '@/constants/dial-hints'
import { cn } from '@/lib/cn'
import { MODE_GRADIENT } from '@/machines/game'

// Every choice a corner has, in the order the tiles list them plus the empty one last.
// `null` is a real option here rather than a way out of the dialog: a corner showing
// nothing is a choice a player makes, and it belongs in the list with the rest.
const CHOICES = [...DIAL_HINTS, null] as const

// What one corner of the dial key should print, chosen from the pause screen.
//
// The four numbers and NOTHING, as a list rather than a row of switches, because a
// corner holds exactly one of them — and a control that can only be in one state at a
// time should not be drawn as several that each look independent.
//
// Nothing here stops a number being picked for two corners at once. That is deliberate:
// somebody drilling the ceiling alone is entitled to see it on both sides of the key.
export function DialHintModal({
  corner,
  current,
  onSelect,
  onDismiss,
}: {
  // Which corner is being set. Named in the title and pointed at by the dot grid
  // beside it, so the dialog says where its answer lands without a word about it.
  corner: BadgeCorner
  // What this corner shows now, or null for a corner left empty.
  current: DialHint | null
  onSelect: (hint: DialHint | null) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  // Trainee's own colour: this dialog only ever opens over a Trainee pause, and the
  // pick it marks should read in the same colour the screen behind it is wearing.
  const tint = MODE_GRADIENT.trainee[0]

  return (
    <ModalCard
      title={t(DIAL_CORNER_LABEL[corner])}
      titleColor={tint}
      icon={<CornerMark corner={corner} color={tint} />}
      onDismiss={onDismiss}
    >
      {(close) => (
        // Room between the rows: five choices read as five separate answers rather than
        // as a block of text to be picked through, and every one of them is a tap target
        // on a phone.
        <View className="gap-3 py-2">
          {CHOICES.map((choice) => {
            const picked = choice === current
            return (
              <Pressable
                key={choice ?? 'none'}
                onPress={() => {
                  onSelect(choice)
                  close()
                }}
                // The pause screen's own tile, so what is being chosen looks like what
                // is being changed. The picked one is ringed in the mode's colour; the
                // border sits on the rest too, transparent, so nothing shifts by a pixel
                // as the choice moves down the list.
                className="flex-row items-center justify-between rounded-2xl border border-transparent bg-card px-3"
                style={{
                  height: HINT_TILE_HEIGHT,
                  ...(picked ? { borderColor: tint } : {}),
                }}
              >
                {/* The unpicked options sit back in dim so the current one is found
                    at a glance rather than read for. */}
                {/* Lower case, and the tracking tightened with it: wide spacing is a
                    caps device, and it reads as airy on anything else — the same pairing
                    the top bar's difficulty line uses. */}
                <Text
                  selectable={false}
                  className={cn(
                    'font-mono text-[12px] font-black tracking-[1px]',
                    picked ? '' : 'text-primary',
                  )}
                  style={picked ? { color: tint } : undefined}
                >
                  {(choice === null
                    ? t(NO_HINT_LABEL)
                    : t(DIAL_HINT_LABEL[choice])
                  ).toLowerCase()}
                </Text>
                {picked && <Ionicons name="checkmark" size={16} color={tint} />}
              </Pressable>
            )
          })}
        </View>
      )}
    </ModalCard>
  )
}
