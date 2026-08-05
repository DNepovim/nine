import type { ReactNode } from 'react'
import { View } from 'react-native'

export function GuideCard({ children }: { children: ReactNode }) {
  return <View className="mt-3 rounded-2xl bg-card p-4">{children}</View>
}
