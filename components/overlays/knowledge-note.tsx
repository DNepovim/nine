import type { ReactNode } from 'react'
import { Text } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// What a formula's terms are, or where it does not apply.
export function KnowledgeNote({ children }: { children: ReactNode }) {
  return <Text className={cn(TYPE.proseSm, 'text-dim')}>{children}</Text>
}
