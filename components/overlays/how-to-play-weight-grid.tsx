import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { NINE_DIAL, weightRows } from '@/modes'

// The weights the guide explains, laid out as the dial lays them out. Read off the board
// rather than copied here: the rule it prints — weight = row order × column order — is
// the board's own, and a second copy of the figures could drift from it.
const WEIGHTS = weightRows(NINE_DIAL)

// The 3×3 grid of cell weights with row / column order headers, so it reads as
// weight = row order × column order (bottom-right ×9 is the coarsest knob).
export function HowToPlayWeightGrid() {
  const ORDER = ['1', '2', '3']
  const header = (label: string) => (
    <Text selectable={false} className={cn(TYPE.buttonSm, 'text-dim')}>
      {label}
    </Text>
  )
  return (
    <View className="items-center">
      {/* Column-order headers (left-padded to clear the row-header column). */}
      <View className="mb-2 flex-row items-center gap-2">
        <View className="w-12 items-center">{header('R×C')}</View>
        {ORDER.map((n) => (
          <View key={n} className="w-14 items-center">
            {header(`COL ${n}`)}
          </View>
        ))}
      </View>

      {WEIGHTS.map((row, r) => (
        <View key={r} className="mb-2 flex-row items-center gap-2">
          <View className="w-12 items-center">{header(`ROW ${ORDER[r] ?? ''}`)}</View>
          {row.map((w, c) => {
            const t = w / 9
            return (
              <View
                key={c}
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: `rgba(114,115,210,${0.14 + t * 0.6})` }}
              >
                <Text
                  selectable={false}
                  className="font-mono text-[16px] font-black"
                  style={{ color: t > 0.55 ? '#FFFFFF' : '#3A3760' }}
                >
                  {w}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
      <Text selectable={false} className={cn(TYPE.label, 'mt-1 text-dim')}>
        <Trans>WEIGHT = ROW ORDER × COLUMN ORDER</Trans>
      </Text>
    </View>
  )
}
