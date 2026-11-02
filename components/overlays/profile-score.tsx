import { Text, View } from 'react-native'

import { TipBubble, useSelfClosing } from '@/components/overlays/tip-bubble'
import { TrackedPressable } from '@/components/tracked-pressable'
import { FORTUNE_INK } from '@/constants/colors'
import { READOUT, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { compactNumber } from '@/lib/compact-number'
import { groupDigits } from '@/lib/group-digits'

// The player's fortune, on one line under their name — everything they have ever scored,
// weighted by the difficulty it was scored on.
//
// In `--color-fortune` rather than the score green: a fortune is not a score, and the one
// figure this card is about should say so in the colour it is written in wherever it
// appears. The green token stays where it belongs — on scores. See the winnings card for
// why that colour is a *darkened* red and not `APP_RED`.
//
// The seven-segment face every score in the app wears, at headline size — and shortened,
// because a career total runs into the millions and the full figure would either wrap or
// shrink until it stopped reading as a headline. The exact, unweighted numbers live in
// the per-board table below — and in the bubble a tap on the figure opens, which gives
// the fortune itself to the point. Only when it was shortened: a figure under a thousand
// is already exact, and a bubble repeating it would answer a question nobody asked.
//
// The suffix is set in mono beside the digits rather than with them: DSEG7 draws digits
// from seven segments and has no letter to make a `k` out of.
//
// The one thing in the profile's column that adds to its parent's gap. The column sets
// one rhythm for everything in it, and at that rhythm the card's headline figure stood as
// close to the medal line above it and the stat row below as those two stand to each
// other — which made the one number the card is about read as the third item in a list.
// Padding on itself rather than a margin, per the layout guide: it is air the figure
// brings with it wherever it is drawn, not a gap negotiated with a sibling that may not
// be rendered.
export function ProfileScore({
  score,
  digitFont,
}: {
  score: number
  // The seven-segment face, or `mono` until it loads — resolved by the modal so the
  // parts of it that show numbers all ask for the font once.
  digitFont: string
}) {
  const { value, suffix } = compactNumber(score)
  const [open, setOpen] = useSelfClosing<true>()
  const exact = groupDigits(score)

  return (
    // Lifted over the stat row drawn after it, and full width so the bubble has the
    // card's width to open into — see `TipBubble`.
    <View className="z-50 w-full items-center py-2">
      <TrackedPressable
        id="profile.fortune"
        disabled={suffix === ''}
        onPress={() => {
          setOpen((up) => (up === null ? true : null))
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={exact}
        className="flex-row items-baseline justify-center gap-1"
      >
        <Text
          selectable={false}
          className={cn(READOUT.scoreLarge, 'text-fortune')}
          style={{ fontFamily: digitFont }}
        >
          {value}
        </Text>
        {suffix !== '' && (
          <Text
            selectable={false}
            className="font-mono text-[18px] font-black tracking-[1px] text-fortune"
          >
            {suffix}
          </Text>
        )}
      </TrackedPressable>

      {open !== null && (
        <TipBubble
          id="profile.fortune"
          top="100%"
          tint={FORTUNE_INK}
          onClose={() => {
            setOpen(null)
          }}
        >
          <Text selectable={false} className={cn(TYPE.figureLarge, 'text-fortune')}>
            {exact}
          </Text>
        </TipBubble>
      )}
    </View>
  )
}
