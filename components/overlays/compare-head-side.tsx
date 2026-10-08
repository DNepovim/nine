import { Text, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { MedalLine } from '@/components/overlays/medal-line'
import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { useOpenProfile } from '@/hooks/use-profile-modal'
import type { ChampionMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import type { Medal } from '@/lib/medals'
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

// The race animal is set smaller than a champion's mark, and on purpose. A crown is a
// standing the player carries off this card; an animal is this card's own remark about how
// the two of them are doing. Drawing them at one size would offer them as the same kind of
// thing, and on a card where one player has a crown and the other a snail, at the same
// weight, the snail would read as a title.
const RACE_SIZE = 21

// The box the mark sits in, kept whether or not there is one. Without it a crowned player
// and an uncrowned one would hang their names at two different heights, and the pair would
// read as a mistake rather than as a distinction.
const MARK_BOX = 30

// The leading the nickname is set on, stated so the line it occupies can be measured.
const NAME_LEADING = 22

// The `gap-0.5` this column stacks on, in points. Mirrored rather than derived — Tailwind's
// spacing is not a value this file can read — so a change to one wants a change to the other.
const STACK_GAP = 2

// Exactly where the nickname sits inside its half of the header: how far down the column it
// starts, and how tall its line is.
//
// Exported for the VS between the two halves, which has nowhere of its own to be measured
// against. Centring it in the whole row would put it wherever the taller side's medals left
// it, and centring it in the mark-and-name band drops it into the empty mark box on the two
// players out of three who hold no champion mark. The names are what it sits between, so the
// names are what it is placed from.
export const HEAD_NAME_LINE = { top: MARK_BOX + STACK_GAP, height: NAME_LEADING } as const

// One half of the comparison's header: whose career this column is, and what they hold.
//
// Drawn as a banner rather than as a column heading. The figures below sit in two 76pt
// columns, and a nickname set to that width would be four characters — so the names are
// centred in their half of the card and the left-to-right order is what ties each one to its
// column, exactly as the YOU / THEM heading it replaces did.
export function CompareHeadSide({
  // Whose column this is. Carried beside the name rather than read off it, the same way
  // the table itself carries one: a nickname is what a player is called and has never
  // said which player it belongs to.
  userId,
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
  // What this side is in the race, for the players who hold no board and so wear no mark of
  // their own — which is almost all of them, and used to leave this box empty on both halves
  // of the card. Null where there is no race to draw: a player who holds a mark has one
  // already, and two careers with nothing in them are not racing yet.
  raceMark,
  // Their best claim in each mode, drawn by the same line the intro puts under the title and
  // the profile puts under the nickname.
  //
  // This used to be the count of rows the side was winning — a figure about the table rather
  // than about the player, and one the reader could get to by reading the table it sat on
  // top of. A medal is the opposite: it is the one thing about these two careers that no row
  // below can say, because every row below is a number and a medal is a standing.
  medals,
}: {
  userId: string
  nickname: string
  avgAccuracy: number | null
  avgSpeed: number | null
  mark: ChampionMark | null
  raceMark: string | null
  medals: readonly Medal[]
}) {
  const openProfile = useOpenProfile()
  // The standing wins the box whenever there is one: a crown says something true about this
  // player wherever their name appears, and the animal only says something about today's
  // table.
  const glyph = mark ?? raceMark
  const size = mark === null ? RACE_SIZE : MARK_SIZE
  return (
    <View className="flex-1 items-center gap-0.5">
      <View className="justify-center" style={{ height: MARK_BOX }}>
        {glyph !== null && (
          <Text selectable={false} style={{ fontSize: size, lineHeight: size + 4 }}>
            {glyph}
          </Text>
        )}
      </View>
      {/* A name opens the player behind it here as it does everywhere else in the app —
          and here it is the one name the reader most often wants to open, because the
          table says what the two of them have done and nothing about who they are.

          The profile arrives *over* this table rather than in its place: the comparison
          is where the player came from and is what they go back to, and a card that
          replaced it would leave them having to rebuild the table to carry on reading it.

          Full width so the tap lands anywhere across this half of the header rather than
          only on the letters, which at ten characters is a thin target centred in a
          column twice as wide. */}
      <TrackedPressable
        id="compare.name"
        onPress={() => {
          openProfile(userId)
        }}
        hitSlop={6}
        className="w-full"
      >
        <GradientName
          nickname={shortName(nickname, HEAD_CHARS)}
          avgAccuracy={avgAccuracy}
          avgSpeed={avgSpeed}
          numberOfLines={1}
          className={cn(TYPE.cardTitle, 'text-center leading-[22px]')}
        />
      </TrackedPressable>
      {/* Wrapped, unlike the two places this line already appears: those have a whole card
          to run across and this has half of one, so a player holding a medal in both modes
          would otherwise run their second entry out under the column beside them. A player
          holding none draws nothing at all, which is why the row above does not centre on
          this. */}
      <MedalLine medals={medals} wrap />
    </View>
  )
}
