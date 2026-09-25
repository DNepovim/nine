import { useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import {
  DIFFICULTIES,
  MODE_GRADIENT,
  MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'

// Lifted off the screen the way every other gradient pill here is — the pill itself
// carries the colour, the shadow says it sits above the copy around it. On the outer
// view, not the clipped one: `overflow-hidden` is what keeps the gradient inside the
// corners, and a clipped layer casts no shadow.
const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 3 },
  shadowRadius: 6,
  elevation: 3,
}

// Which board the run was played on, worn the way the menu wears it: the mode and its
// difficulty as gradient pills, the same white-on-mode-gradient the selectors give the
// option you picked. There they are the choice; here they are the record of it, so
// they take the colour and none of the interaction.
export function BoardBadges({
  gameMode,
  difficulty,
}: {
  gameMode: Mode
  // Left out by a run with no difficulty to record. Trainee has no selector and takes
  // the Easy pace whatever the menu last had selected, so a pill naming one there would
  // be reporting a choice the player never made.
  difficulty?: Difficulty
}) {
  const { t } = useLingui()
  const labels =
    difficulty === undefined
      ? [t(MODES[gameMode].label)]
      : [t(MODES[gameMode].label), t(DIFFICULTIES[difficulty].label)]

  return (
    <View className="mb-5 flex-row items-center gap-2">
      {labels.map((label) => (
        <View
          key={label}
          className="rounded-lg"
          // The opaque ground iOS draws the shadow from: a transparent view has no
          // shape to cast one, and this is the gradient's own first stop, so nothing
          // of it shows past the pill on top.
          style={{ ...shadow, backgroundColor: MODE_GRADIENT[gameMode][0] }}
        >
          <LinearGradient
            colors={[...MODE_GRADIENT[gameMode]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="overflow-hidden rounded-lg px-3 py-1"
          >
            <Text
              selectable={false}
              className="font-mono text-[10px] font-black tracking-[1.5px] text-white"
            >
              {label}
            </Text>
          </LinearGradient>
        </View>
      ))}
    </View>
  )
}
