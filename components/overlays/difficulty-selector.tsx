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
      <Text
        selectable={false}
        className="mb-2 font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
      >
        DIFFICULTY
      </Text>
      <View
        className="flex-row flex-wrap justify-center gap-2 px-6"
        style={{ maxWidth: 320 }}
      >
        {DIFFICULTY_ORDER.map((d) => {
          const selected = d === difficulty
          return (
            <Pressable
              key={d}
              onPress={() => {
                onSetDifficulty(d)
              }}
              className="rounded-xl px-3.5 py-2"
              style={
                selected
                  ? { backgroundColor: getDifficultyColor(gameMode, d) }
                  : { backgroundColor: 'transparent' }
              }
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
