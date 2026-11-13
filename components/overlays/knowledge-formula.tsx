import type { ReactNode } from 'react'
import { Text } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One formula, in the figure role so it reads as arithmetic rather than prose.
export function KnowledgeFormula({ children }: { children: ReactNode }) {
  return <Text className={cn(TYPE.figure, 'text-primary')}>{children}</Text>
}
