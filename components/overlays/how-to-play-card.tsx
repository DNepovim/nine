import { View } from 'react-native'

export function HowToPlayCard({ children }: { children: React.ReactNode }) {
  return <View className="mt-3 rounded-2xl bg-card p-4">{children}</View>
}
