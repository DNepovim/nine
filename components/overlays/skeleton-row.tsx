import { View } from 'react-native'

export function SkeletonRow() {
  return (
    <View className="flex-row items-center px-2 py-1.5">
      <View className="mr-1 h-2.5 w-5 rounded-sm bg-dim/20" />
      <View className="mr-1 h-2.5 flex-1 rounded-sm bg-dim/20" />
      <View className="h-2.5 w-10 rounded-sm bg-dim/20" />
    </View>
  )
}
