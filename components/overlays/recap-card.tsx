import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo } from 'react'
import { Text, View } from 'react-native'

import { RecapSentence } from '@/components/overlays/recap-sentence'
import { APP_VIOLET } from '@/constants/colors'
import { composeRecap, periodLabel, type WeekFacts } from '@/lib/recap'

// Last week on the boards, as one card in the launch popup. Built to the same shape as
// NewsCard: a tinted icon square, a title in the accent, then the body.
//
// The accent is APP_VIOLET rather than a mode colour, because a recap speaks for the game
// as a whole and not for one mode — the rule the design guide sets for that hue.
//
// The card composes rather than being handed sentences. `t` subscribes it to the active
// locale, so switching language retells the week in the new one instead of leaving whichever
// language the paragraph was built in — and because the seed is `from`, it is retold in the
// *same* words, translated. That is also why the memo below is safe: every dependency in it
// can change identity as often as React likes without changing a word of the output.
export function RecapCard({
  facts,
  from,
  to,
}: {
  facts: WeekFacts
  // The window's Monday and its Sunday. The Monday is also the seed the phrasings are
  // chosen by, which is what makes a dismissed and reopened dialog say the same thing.
  from: string
  to: string
}) {
  const { t } = useLingui()

  const sentences = useMemo(
    () => composeRecap(facts, from, t).sentences,
    [facts, from, t],
  )
  const period = periodLabel(from, to, t)

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
          <Trans>LAST WEEK IN NINE</Trans>
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
