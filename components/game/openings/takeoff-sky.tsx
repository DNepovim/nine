import { View } from 'react-native'
import { useFrameCallback, useSharedValue } from 'react-native-reanimated'

import { CLOUDS, TakeoffDrifter } from '@/components/game/openings/takeoff-drifter'
import { TakeoffGround } from '@/components/game/openings/takeoff-ground'
import { useViewport } from '@/hooks/use-viewport'

// The sky's furniture, behind the run: clouds along the top and ground along the foot.
function Scenery() {
  const { width, height } = useViewport()
  const clock = useSharedValue(Date.now())
  useFrameCallback(() => {
    clock.value = Date.now()
  })
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      {CLOUDS.map((cloud) => (
        <View
          key={cloud.period}
          style={{ position: 'absolute', left: 0, right: 0, top: height * cloud.at }}
        >
          <TakeoffDrifter cloud={cloud} clock={clock} screen={width} />
        </View>
      ))}
      <TakeoffGround clock={clock} />
    </View>
  )
}

// The behind-the-run layer: the scene's and the remains' alike.
export const SkyUnder = Scenery
export const SkyRemains = Scenery
