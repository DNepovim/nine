import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'

import { APP_VIOLET } from '@/constants/colors'
import type { Sentence } from '@/dev/weekly-recap/lines'
import { RecapSentence } from '@/dev/weekly-recap/recap-sentence'

// The recap as a card in the What's New popup, built to the same shape as NewsCard: a
// tinted icon square, a title in the accent, then the body.
//
// The accent is APP_VIOLET rather than a mode colour, because a recap speaks for the
// game as a whole and not for one mode — the rule the design guide sets for that hue.
export function RecapCard({
  sentences,
  period,
}: {
  sentences: readonly Sentence[]
  // The week being reported, already formatted — "22 – 28 September". `period` rather
  // than `window` for the same reason the migration uses it: the latter is taken.
  period: string
}) {
  return (
    <View>
      <View className="items-center">
        <View
          className="h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${APP_VIOLET}26` }}
        >
          <Ionicons name="newspaper" size={30} color={APP_VIOLET} />
        </View>

        <Text
          selectable={false}
          className="mt-4 text-center font-mono text-[17px] font-black tracking-[2px]"
          style={{ color: APP_VIOLET }}
        >
          LAST WEEK IN NINE
        </Text>

        <Text
          selectable={false}
          className="mt-1.5 font-mono text-[9px] font-bold tracking-[1.5px] text-dim"
        >
          {period}
        </Text>
      </View>

      <View className="mt-4 gap-2.5">
        {sentences.map((sentence, index) => (
          <RecapSentence key={index} sentence={sentence} />
        ))}
      </View>
    </View>
  )
}
