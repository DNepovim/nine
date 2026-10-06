import { Text, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { GOLD_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import type { ChampionMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { shortName } from '@/lib/short-name'

// How much of a nickname a half of the card holds. Half of a 460pt card less its padding is
// about 190pt, and the name below is 17px mono on 1px of tracking — about eleven characters,
// so ten leaves the ellipsis somewhere to go. The profile card behind this one prints the
// whole name at 28px; this is the heading of a table, and a heading that wrapped to two
// lines would push the figures off a short phone.
const HEAD_CHARS = 10

// Big enough to read as a mark rather than as an emoji that got into the copy, and smaller
// than the profile's 30 — there are two of them here, over names half the size.
const MARK_SIZE = 26

// The box the mark sits in, kept whether or not there is one. Without it a crowned player
// and an uncrowned one would hang their names at two different heights, and the pair would
// read as a mistake rather than as a distinction.
const MARK_BOX = 30

// One half of the comparison's header: whose career this column is, and how much of the
// table it takes.
//
// Drawn as a banner rather than as a column heading. The figures below sit in two 76pt
// columns, and a nickname set to that width would be four characters — so the names are
// centred in their half of the card and the left-to-right order is what ties each one to its
// column, exactly as the YOU / THEM heading it replaces did.
export function CompareHeadSide({
  nickname,
  // The player's lifetime averages, which is what decides the colour the name is drawn in —
  // the same gradient they wore on the card this table opened from, and on the row that
  // opened that.
  avgAccuracy,
  avgSpeed,
  // Crown, owl or eagle, or null for the players who hold neither Extreme board — which is
  // almost everybody. Drawn plainly here, without the bubble `TitleMark` opens: the profile
  // card one step back explains this player's mark, and the intro explains the reader's own.
  mark,
  // How many of the ten judged rows this side takes.
  wins,
  // Whether this side is ahead, behind, or level — the same three tones the figures below
  // wear, from the same `toneFor`, so the header is judged the way every row under it is.
  tone,
}: {
  nickname: string
  avgAccuracy: number | null
  avgSpeed: number | null
  mark: ChampionMark | null
  wins: number
  tone: 'lead' | 'trail' | 'plain'
}) {
  const { colorScheme } = useTheme()
  return (
    <View className="flex-1 items-center gap-0.5">
      <View className="justify-center" style={{ height: MARK_BOX }}>
        {mark !== null && (
          <Text
            selectable={false}
            style={{ fontSize: MARK_SIZE, lineHeight: MARK_SIZE + 4 }}
          >
            {mark}
          </Text>
        )}
      </View>
      <GradientName
        nickname={shortName(nickname, HEAD_CHARS)}
        avgAccuracy={avgAccuracy}
        avgSpeed={avgSpeed}
        numberOfLines={1}
        className="text-center font-mono text-[17px] font-black tracking-[1px] leading-[22px]"
      />
      {/* The score this side is winning by, and the one figure on the card that is about
          the whole table rather than about one row of it. Gold for a lead, because that is
          what gold means everywhere else here: a standing you hold and could lose. */}
      <Text
        selectable={false}
        className={cn(
          'font-mono text-[15px] font-black tracking-[1px]',
          tone === 'trail' ? 'text-dim' : 'text-primary',
        )}
        style={tone === 'lead' ? { color: GOLD_INK[colorScheme] } : undefined}
      >
        {wins}
      </Text>
    </View>
  )
}
