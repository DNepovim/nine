import { Pressable, Text, View } from 'react-native'

import { LOCALES, type Locale } from '@/lib/i18n/locale'

const PILL_H = 30
const PAD = 4

// The tag each locale wears. Its own language, not the current one: a player who has
// landed in a language they cannot read needs to find their way out, and "ČEŠTINA"
// spelled in Czech is legible from any starting point in a way a translated
// "Czech"/"Angličtina" pair is not.
const LABEL: Record<Locale, string> = {
  en: 'EN',
  cs: 'CS',
}

// Two segments rather than the theme's sliding knob. The knob says "on or off", which
// is what a theme is; a language is a choice between named things, and each one has to
// carry its own name.
export function LocaleToggle({
  locale,
  onSelect,
}: {
  locale: Locale
  onSelect: (locale: Locale) => void
}) {
  return (
    <View
      className="flex-row items-center self-center bg-card"
      style={{ height: PILL_H, borderRadius: PILL_H / 2, padding: PAD }}
    >
      {LOCALES.map((option) => {
        const active = option === locale
        return (
          <Pressable
            key={option}
            onPress={() => {
              onSelect(option)
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className={active ? 'bg-strong' : undefined}
            style={{
              paddingHorizontal: 12,
              height: PILL_H - PAD * 2,
              justifyContent: 'center',
              borderRadius: (PILL_H - PAD * 2) / 2,
            }}
          >
            <Text
              selectable={false}
              className={`font-mono text-[11px] font-black tracking-[1px] ${
                active ? 'text-primary' : 'text-dim'
              }`}
            >
              {LABEL[option]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
