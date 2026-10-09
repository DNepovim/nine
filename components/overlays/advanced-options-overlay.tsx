import { AntDesign } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { LocaleToggle } from '@/components/locale-toggle'
import { ModalCard } from '@/components/overlays/modal-card'
import { OptionCheckbox } from '@/components/overlays/option-checkbox'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useLocale } from '@/hooks/use-locale'
import type { ReplayConsent } from '@/hooks/use-replay-consent'
import { useViewport } from '@/hooks/use-viewport'
import { buildInfo } from '@/lib/build-info'
import { cn } from '@/lib/cn'

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
    >
      <OptionCheckbox checked={checked} />
      <View className="flex-1">
        <Text selectable={false} className={cn(TYPE.button, 'text-primary')}>
          {label}
        </Text>
        <Text selectable={false} className={cn(TYPE.value, 'mt-0.5 text-dim')}>
          {description}
        </Text>
      </View>
    </TrackedPressable>
  )
}

export function AdvancedOptionsOverlay({
  showSum,
  onToggleSum,
  replayConsent,
  onToggleReplayConsent,
  onOpenNews,
  onClose,
}: {
  showSum: boolean
  onToggleSum: () => void
  // Whichever of the three the player answered the recording banner with, or 'unknown'
  // if it has not come up yet — read as a plain checkbox either way: checked is
  // 'granted', unchecked is everything else. See hooks/use-replay-consent.ts.
  replayConsent: ReplayConsent
  onToggleReplayConsent: () => void
  onOpenNews: () => void
  onClose: () => void
}) {
  const { locale, setLocale } = useLocale()
  const { height } = useViewport()
  const build = buildInfo()
  // OPTIONS, not ADVANCED: this is the only settings screen there is, and both buttons
  // that open it — on the intro and on the pause screen — say OPTIONS. The identifiers
  // still say advanced.
  return (
    <ModalCard
      title={<Trans>OPTIONS</Trans>}
      onDismiss={onClose}
      maxHeight={height * 0.85}
    >
      {() => (
        // flexShrink lets the list scroll on a short display while leaving the card its
        // own height on a tall one — see the note in ModalCard's callers.
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 1 }}
        >
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

          {/* Language */}
          <View className="flex-row items-center justify-between py-3">
            <Text selectable={false} className={cn(TYPE.button, 'text-primary')}>
              <Trans>LANGUAGE</Trans>
            </Text>
            <LocaleToggle locale={locale} onSelect={setLocale} />
          </View>

          {/* What's new */}
          <TrackedPressable
            id="options.whats_new"
            onPress={onOpenNews}
            className="flex-row items-center justify-between py-3"
          >
            <Text selectable={false} className={cn(TYPE.button, 'text-primary')}>
              <Trans>WHAT’S NEW</Trans>
            </Text>
            <AntDesign name="right" size={14} color={DIM_INK} />
          </TrackedPressable>

          {/* Build stamp — the line to quote in a bug report. */}
          <Text
            selectable={false}
            className={cn(TYPE.value, 'w-full pt-3 text-center text-dim')}
          >
            {build.label}
          </Text>
        </ScrollView>
      )}
    </ModalCard>
  )
}
