import { Text, View } from 'react-native'

// The little flag pinned to a tab's top-right corner: ARCADE's SOON, multiplayer's
// BETA. One component so the two cannot drift, because they are the same statement —
// what is behind this tab is not finished — and should look identical making it.
//
// Positioned in the `style` prop rather than in classes: it hangs outside its parent on
// both axes, and the offsets are what keep it clear of the tab's rounded corner.
const BADGE_COLOR = '#E5534B'

export function CornerBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: BADGE_COLOR,
        borderRadius: 5,
        paddingHorizontal: 4,
        paddingVertical: 1,
      }}
    >
      <Text
        selectable={false}
        style={{
          color: '#FFFFFF',
          fontSize: 7,
          fontWeight: '800',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  )
}
