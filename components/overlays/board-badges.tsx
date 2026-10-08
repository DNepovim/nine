import { useLingui } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import {
  DIFFICULTIES,
  gradientOf,
  runLabel,
  runSubmode,
  type Difficulty,
  type ModeId,
} from '@/modes'

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
  tutorial = false,
}: {
  gameMode: ModeId
  // Left out by a run with no difficulty to record. Trainee has no selector and takes
  // the Easy pace whatever the menu last had selected, so a pill naming one there would
  // be reporting a choice the player never made.
  difficulty?: Difficulty
  // The run is the tutorial, so the first pill names that rather than the mode under it.
  // Default off: the two screens that report a *board* — game over, and the challenge
  // being offered — are never showing one.
  tutorial?: boolean
}) {
  const { t } = useLingui()
  const mode = t(runLabel(gameMode, runSubmode(tutorial)))
  const labels =
    difficulty === undefined ? [mode] : [mode, t(DIFFICULTIES[difficulty].label)]

  return (
    <View className="mb-5 flex-row items-center gap-2">
      {labels.map((label) => (
        <View
          key={label}
          className="rounded-lg"
          // The opaque ground iOS draws the shadow from: a transparent view has no
          // shape to cast one, and this is the gradient's own first stop, so nothing
          // of it shows past the pill on top.
          style={{ ...shadow, backgroundColor: gradientOf(gameMode)[0] }}
        >
          <LinearGradient
            colors={[...gradientOf(gameMode)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="overflow-hidden rounded-lg px-3 py-1"
          >
            <Text selectable={false} className={cn(TYPE.quietAction, 'text-white')}>
              {label}
            </Text>
          </LinearGradient>
        </View>
      ))}
    </View>
  )
}
