import { Text, View } from 'react-native'

// Lays out the tips the panel will actually show, at the panel's own width, and reports
// each height — so the body can be sized to the tallest of them rather than to a
// hand-tuned constant that has to be re-guessed whenever a tip is edited.
//
// It takes the panel's own selection rather than the whole list: the panel shows a
// random few, and measuring tips it will never rotate to would hold the box open for a
// long one the player never sees.
//
// Absolute and invisible: it contributes nothing to the flow, and being outside the
// clipped body means each tip is measured at its natural height instead of the box's.
// `left-4 right-4` reproduces the card's `px-4` content width — absolute children sit
// inside the border but ignore the parent's padding, so the inset has to be repeated.
//
// `aria-hidden` keeps a screen reader from reading every tip on top of the one
// actually on show.
export function TipSizer({
  tips,
  onMeasure,
}: {
  tips: readonly string[]
  onMeasure: (height: number) => void
}) {
  return (
    <View aria-hidden className="absolute left-4 right-4 opacity-0" pointerEvents="none">
      {tips.map((tip) => (
        <Text
          key={tip}
          selectable={false}
          className="text-center font-mono text-[12px] font-medium leading-[19px] text-primary"
          onLayout={(e) => {
            onMeasure(e.nativeEvent.layout.height)
          }}
        >
          {tip}
        </Text>
      ))}
    </View>
  )
}
