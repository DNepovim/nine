import { Text, View } from 'react-native'

import { CodeKeyboard } from './code-keyboard'

export function GameCodeInput({
  value,
  onChange,
  accentColors,
  joinError,
}: {
  value: string
  onChange: (v: string) => void
  accentColors: [string, string]
  joinError: string | null
}) {
  const accentColor = accentColors[0]
  return (
    <View className="mt-4 items-center">
      <Text
        selectable={false}
        className="mb-4 font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
      >
        JOIN WITH CODE
      </Text>
      <View className="flex-row gap-3">
        {[0, 1, 2, 3].map((i) => {
          const digit = value[i] ?? ''
          return (
            <View
              key={i}
              className="w-13 h-17 border-2 rounded-[10px] items-center justify-center"
              style={{
                borderColor: digit ? accentColor + '80' : '#aaa69e40',
                backgroundColor: digit ? accentColor + '12' : undefined,
              }}
            >
              <Text
                selectable={false}
                className="font-mono text-[28px] font-black"
                style={{ color: digit ? accentColor : '#aaa69e40' }}
              >
                {digit}
              </Text>
            </View>
          )
        })}
      </View>
      {joinError !== null ? (
        <Text
          selectable={false}
          className="mt-3 font-mono text-[10px] font-bold tracking-[1px]"
          style={{ color: '#E5534B' }}
        >
          {joinError}
        </Text>
      ) : (
        <View className="h-7" />
      )}
      <CodeKeyboard value={value} onChange={onChange} accentColors={accentColors} />
    </View>
  )
}
