import { View } from 'react-native'

// Height and padding matched to ScoreRow: 18px, around its 14px line. The two must
// agree or the board jumps as the skeleton gives way to real rows.
export function SkeletonRow() {
  return (
    <View className="h-[18px] flex-row items-center px-2">
      <View className="mr-1 h-2.5 w-5 rounded-sm bg-dim/20" />
      <View className="mr-1 h-2.5 flex-1 rounded-sm bg-dim/20" />
      <View className="h-2.5 w-10 rounded-sm bg-dim/20" />
    </View>
  )
}
