import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import {
  DIFFICULTIES,
  MODE_GRADIENT,
  MODES,
  type Difficulty,
  type Mode,
} from '@/machines/game'

// Which board the run was played on, worn the way the menu wears it: the mode and its
// difficulty as gradient pills, the same white-on-mode-gradient the selectors give the
// option you picked. There they are the choice; here they are the record of it, so
// they take the colour and none of the interaction.
export function BoardBadges({
  gameMode,
  difficulty,
}: {
  gameMode: Mode
  difficulty: Difficulty
}) {
  return (
    <View className="mb-5 flex-row items-center gap-2">
      {[MODES[gameMode].label, DIFFICULTIES[difficulty].label].map((label) => (
        <View key={label} className="overflow-hidden rounded-lg">
          <LinearGradient
            colors={[...MODE_GRADIENT[gameMode]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="px-3 py-1"
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
