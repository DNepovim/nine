import type { ReactNode } from 'react'
import { Text } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// Primary, not dim: this is the one screen a player reads rather than glances at, and
// paragraphs of dim text at 12px asked too much of them. Dim stays for the labels and
// captions around the graphics, where it separates aside from prose.
export function HowToPlayBody({ children }: { children: ReactNode }) {
  return (
    <Text selectable={false} className={cn(TYPE.prose, 'text-primary')}>
      {children}
    </Text>
  )
}
