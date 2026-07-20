import { AntDesign } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'

import { Screen } from '@/components/screen'
import { ThemeToggle } from '@/components/theme-toggle'

function AdvancedOption({
  checked,
  label,
  description,
  onToggle,
}: {
  checked: boolean
  label: string
  description: string
  onToggle: () => void
}) {
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center gap-3 py-3"
      style={{ width: 300 }}
    >
      <View
        className={`h-7 w-7 items-center justify-center rounded-lg ${checked ? 'bg-strong' : 'bg-card'}`}
      >
        {checked && <AntDesign name="check" size={17} color="#D8D2F4" />}
      </View>
      <View className="flex-1">
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[1px] text-primary"
        >
          {label}
        </Text>
        <Text
          selectable={false}
          className="mt-0.5 font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
        >
          {description}
        </Text>
      </View>
    </Pressable>
  )
}

export function AdvancedOptionsOverlay({
  isDark,
  showSum,
  showFactor,
  onToggleSum,
  onToggleFactor,
  onToggleTheme,
  onClose,
}: {
  isDark: boolean
  showSum: boolean
  showFactor: boolean
  onToggleSum: () => void
  onToggleFactor: () => void
  onToggleTheme: () => void
  onClose: () => void
}) {
  return (
    <Screen overlay>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={{ position: 'absolute', top: 16, right: 16 }}
      >
        <AntDesign name="close" size={26} color={isDark ? '#2A2B44' : '#D4D0C8'} />
      </Pressable>

      <Text
        selectable={false}
        className="mb-8 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        ADVANCED
      </Text>

      <AdvancedOption
        checked={showSum}
        label="SHOW SUM IN BUTTONS"
        description="Display value × row × column"
        onToggle={onToggleSum}
      />
      <AdvancedOption
        checked={showFactor}
        label="SHOW FACTOR"
        description="Small multiplier at the top of each button"
        onToggle={onToggleFactor}
      />

      {/* Theme */}
      <View className="flex-row items-center justify-between py-3" style={{ width: 300 }}>
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[1px] text-primary"
        >
          THEME
        </Text>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </View>

      <Pressable
        onPress={onClose}
        className="mt-8 items-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          DONE
        </Text>
      </Pressable>
    </Screen>
  )
}
