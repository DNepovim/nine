import { isNonEmptyString } from 'narrowland'
import { Pressable, Text, View } from 'react-native'

import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { useOpenProfile } from '@/hooks/use-profile-modal'
import { cn } from '@/lib/cn'
import { rankEmoji, rankMark } from '@/lib/rank-emoji'
import type { RankMark } from '@/lib/rank-emoji'
import { timeAgo } from '@/lib/time-ago'

// A fixed line height on all three keeps a row the same height whichever mark it
// shows — the board's five rows would otherwise stand taller than the player's own row
// below the cut. The sizes differ because the glyphs do: a numeral is small, a medal
// needs more room than the numeral it replaces, and the potato and the pig fill their
// box where a medal leaves a margin, so they take a notch less to weigh the same.
const RANK_MARK_SIZES = {
  medal: 'text-[13px]',
  creature: 'text-[11px]',
  number: 'text-[10px]',
} as const satisfies Record<RankMark, string>

export type ScoreEntry = {
  rank: number
  // Whose row it is. A row with an id opens that player's profile when tapped; a local
  // score that has not reached the board has none, and there is no profile behind it
  // yet to open.
  userId?: string | null
  // The crown or bird this player wears everywhere their name appears, or null.
  mark: string | null
  nickname: string
  score: number
  isUser?: boolean
  // Set on a local record that has not reached the board yet — the row says why.
  note?: string
  // When the record was set, ISO. Undefined for a row with no board timestamp.
  achievedAt?: string
}

export function ScoreRow({
  entry,
  accentColor,
  digitFont,
  halo = false,
}: {
  entry: ScoreEntry
  accentColor: string
  // The seven-segment face, or `mono` until it loads. Passed in rather than loaded
  // here: a board is six of these rows, and they should not each ask for the font.
  digitFont: string
  // Set on the gold game-over screen: these rows sit straight on the celebration.
  halo?: boolean
}) {
  const openProfile = useOpenProfile()
  // Every server row carries an id; only the local unpublished row does not.
  const profileId = isNonEmptyString(entry.userId) ? entry.userId : null
  const highlight = entry.isUser === true
  const glow = halo ? ON_GOLD_LABEL_SHADOW : null
  const accentStyle = highlight ? { color: accentColor } : undefined
  // Null past fifth — the player's own row can sit below the board's cut, and there
  // the number is the point.
  const emoji = rankEmoji(entry.rank)
  // Read once per render rather than ticking: the board is a glance, and a row that
  // re-rendered every minute to turn 4M into 5M would buy nothing for the cost.
  const age =
    entry.achievedAt === undefined ? null : timeAgo(entry.achievedAt, Date.now())
  const note = entry.note ?? age
  return (
    <Pressable
      // A name is the way into its player's profile, everywhere a name is drawn. The
      // whole row is the target rather than the text: a 10px nickname is not a tap
      // target, and the rank and score beside it belong to the same player.
      onPress={
        profileId === null
          ? undefined
          : () => {
              openProfile(profileId)
            }
      }
      disabled={profileId === null}
      // 24px: the 16px line below plus py-1, stated rather than left to font metrics so
      // SkeletonRow can stand exactly as tall and the board holds still while it loads.
      className="h-6 flex-row items-center rounded-lg px-2 py-1"
      style={highlight ? { backgroundColor: accentColor + '20' } : undefined}
    >
      <Text
        selectable={false}
        className={cn(
          'w-7 font-mono font-bold leading-[16px] text-dim',
          RANK_MARK_SIZES[rankMark(entry.rank)],
        )}
        style={[accentStyle, glow]}
      >
        {emoji ?? entry.rank}
      </Text>
      <View className="flex-1 flex-row items-baseline gap-1.5">
        {/* Champions carry their mark wherever their name is drawn, so the board says
            who holds the hardest boards without a legend explaining it. Rendered only
            when there is one — an empty Text would still take the row's gap. */}
        {entry.mark !== null && (
          <Text selectable={false} className="text-[9px] leading-[13px]">
            {entry.mark}
          </Text>
        )}
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[0.5px] text-primary"
          style={[accentStyle, glow]}
        >
          {entry.nickname}
        </Text>
        {/* One slot, two things that are never both true: a published row says how
            long its record has stood, an unpublished one says why it is not on the
            board. The note wins outright — "5 min ago" beside NOT PUBLISHED would be
            timing a record the board has never seen. The two registers differ on
            purpose: lower case for the aside, capitals for the warning. */}
        {note !== null && (
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[7px] font-bold tracking-[0.5px] text-dim"
            style={glow}
          >
            {note}
          </Text>
        )}
      </View>
      {/* The seven-segment face and the score green every other score in the app
          wears — the top bar's bests, the score above the dial, the game-over
          readout. A board of scores set in the label ink was the one place a number
          did not look like one.

          Deliberately not accented on the player's own row: the tinted background,
          rank and nickname already say which row is theirs, and a score column that
          changes colour on one line stops reading as a column. */}
      <Text
        selectable={false}
        className="text-[10px] tracking-[1px] text-score"
        style={[{ fontFamily: digitFont }, glow]}
      >
        {entry.score}
      </Text>
    </Pressable>
  )
}
