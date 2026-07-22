import { Pressable, Text, View } from 'react-native'

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  getDifficultyColor,
  type Difficulty,
  type Mode,
} from '@/machines/game'

export function DifficultySelector({
  gameMode,
  difficulty,
  onSetDifficulty,
}: {
  gameMode: Mode
  difficulty: Difficulty
  onSetDifficulty: (d: Difficulty) => void
}) {
  return (
    <View className="mb-6 items-center">
      <View className="flex-row flex-wrap justify-center px-6">
        {DIFFICULTY_ORDER.map((d, i) => {
          const selected = d === difficulty
          return (
            <Pressable
              key={d}
              onPress={() => {
                onSetDifficulty(d)
              }}
              className={`px-2 py-1 bg-card  ${i === 0 ? 'rounded-l-md' : i === DIFFICULTY_ORDER.length - 1 ? 'rounded-r-md' : ''}`}
              style={selected ? { backgroundColor: getDifficultyColor(gameMode, d) } : {}}
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px]"
                style={{
                  color: selected ? '#FFFFFF' : getDifficultyColor(gameMode, d),
                }}
              >
                {DIFFICULTIES[d].label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
