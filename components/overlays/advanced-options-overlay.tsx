import { AntDesign } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { LocaleToggle } from '@/components/locale-toggle'
import { OptionCheckbox } from '@/components/overlays/option-checkbox'
import { Screen } from '@/components/screen'
import { ThemeToggle } from '@/components/theme-toggle'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { useLocale } from '@/hooks/use-locale'
import type { ReplayConsent } from '@/hooks/use-replay-consent'
import { buildInfo } from '@/lib/build-info'

function AdvancedOption({
  checked,
  label,
  description,
  onToggle,
}: {
  checked: boolean
  // Nodes rather than strings: the caller hands these a <Trans>, which renders inside
  // the <Text> below exactly as the literal did.
  label: ReactNode
  description: ReactNode
  onToggle: () => void
}) {
  return (
    <TrackedPressable
      id="options.toggle"
      onPress={onToggle}
      className="flex-row items-center gap-3 py-3"
      style={{ width: 300 }}
    >
      <OptionCheckbox checked={checked} />
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
    </TrackedPressable>
  )
}

export function AdvancedOptionsOverlay({
  isDark,
  showSum,
  onToggleSum,
  onToggleTheme,
  replayConsent,
  onToggleReplayConsent,
  onOpenNews,
  onClose,
}: {
  isDark: boolean
  showSum: boolean
  onToggleSum: () => void
  onToggleTheme: () => void
  // Whichever of the three the player answered the recording banner with, or 'unknown'
  // if it has not come up yet — read as a plain checkbox either way: checked is
  // 'granted', unchecked is everything else. See hooks/use-replay-consent.ts.
  replayConsent: ReplayConsent
  onToggleReplayConsent: () => void
  onOpenNews: () => void
  onClose: () => void
}) {
  const { locale, setLocale } = useLocale()
  const build = buildInfo()
  return (
    <Screen overlay>
      <Text
        selectable={false}
        className="mb-8 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        <Trans>ADVANCED</Trans>
      </Text>

      <AdvancedOption
        checked={showSum}
        label={<Trans>SHOW SUM IN BUTTONS</Trans>}
        description={<Trans>Display value × row × column</Trans>}
        onToggle={onToggleSum}
      />

      <AdvancedOption
        checked={replayConsent === 'granted'}
        label={<Trans>SESSION RECORDING</Trans>}
        description={<Trans>Let us watch replays to fix bugs</Trans>}
        onToggle={onToggleReplayConsent}
      />

      {/* Theme */}
      <View className="flex-row items-center justify-between py-3" style={{ width: 300 }}>
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[1px] text-primary"
        >
          <Trans>THEME</Trans>
        </Text>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </View>

      {/* Language */}
      <View className="flex-row items-center justify-between py-3" style={{ width: 300 }}>
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[1px] text-primary"
        >
          <Trans>LANGUAGE</Trans>
        </Text>
        <LocaleToggle locale={locale} onSelect={setLocale} />
      </View>

      {/* What's new */}
      <TrackedPressable
        id="options.whats_new"
        onPress={onOpenNews}
        className="flex-row items-center justify-between py-3"
        style={{ width: 300 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[1px] text-primary"
        >
          <Trans>WHAT’S NEW</Trans>
        </Text>
        <AntDesign name="right" size={14} color={DIM_INK[isDark ? 'dark' : 'light']} />
      </TrackedPressable>

      {/* Build stamp — the line to quote in a bug report. */}
      <View className="flex-row items-center justify-between pt-3" style={{ width: 300 }}>
        <Text
          selectable={false}
          className="text-center w-full font-mono text-[10px] font-bold tracking-[0.5px] text-dim"
        >
          {build.label}
        </Text>
      </View>

      <TrackedPressable
        id="options.done"
        onPress={onClose}
        className="mt-8 items-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </TrackedPressable>
    </Screen>
  )
}
