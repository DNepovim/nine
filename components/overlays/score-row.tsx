import { Text, View } from 'react-native'

import { cn } from '@/lib/cn'
import { rankEmoji } from '@/lib/rank-emoji'
import { timeAgo } from '@/lib/time-ago'

export type ScoreEntry = {
  rank: number
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
}: {
  entry: ScoreEntry
  accentColor: string
  // The seven-segment face, or `mono` until it loads. Passed in rather than loaded
  // here: a board is six of these rows, and they should not each ask for the font.
  digitFont: string
}) {
  const highlight = entry.isUser === true
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
    <View
      className="flex-row items-center rounded-lg px-2 py-1"
      style={highlight ? { backgroundColor: accentColor + '20' } : undefined}
    >
      {/* An emoji needs more room than the 10px numeral it replaces, and a fixed line
          height on both keeps a row the same height whichever it shows — the board's
          five rows would otherwise stand taller than the player's own row below the
          cut. */}
      <Text
        selectable={false}
        className={cn(
          'w-7 font-mono font-bold leading-[16px] text-dim',
          emoji === null ? 'text-[10px]' : 'text-[13px]',
        )}
        style={accentStyle}
      >
        {emoji ?? entry.rank}
      </Text>
      <View className="flex-1 flex-row items-baseline gap-1.5">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[0.5px] text-primary"
          style={accentStyle}
        >
          {entry.nickname}
        </Text>
        {/* One slot, two things that are never both true: a published row says how
            long its record has stood, an unpublished one says why it is not on the
            board. The note wins outright — "5M AGO" beside NOT PUBLISHED would be
            timing a record the board has never seen. */}
        {note !== null && (
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[7px] font-bold tracking-[0.5px] text-dim"
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
        style={{ fontFamily: digitFont }}
      >
        {entry.score}
      </Text>
    </View>
  )
}
