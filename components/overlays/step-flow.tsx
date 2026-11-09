import type { ReactNode } from 'react'
import Animated from 'react-native-reanimated'

import type { useStepFlow } from '@/hooks/use-step-flow'

// The body of a multistep dialog, wearing the transition `useStepFlow` plays between its
// steps. The dialog holds the hook — it has to, since the title and the ground read `shown`
// from outside the card's body — and hands the result here.
//
// Touches are off while a step is leaving, so a second press cannot land on a body that is
// already on its way out.
export function StepFlow({
  flow,
  children,
}: {
  flow: ReturnType<typeof useStepFlow>
  children: ReactNode
}) {
  return (
    <Animated.View style={flow.style} pointerEvents={flow.leaving ? 'none' : 'auto'}>
      {children}
    </Animated.View>
  )
}
