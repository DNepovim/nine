import { Text } from 'react-native'

export type WinnerNameProps = {
  nickname: string
  // The crown or bird this player wears everywhere their name appears, or null.
  mark: string | null
  // The board's own colour — see RecentWinners for why the name carries it.
  color: string
}

// A winner's name inside a sentence: their champion mark, then the nickname in the
// board's colour.
//
// Its own component because it is what the translated sentence wraps around — the
// name moves to a different place in Czech than in English, and a `<0/>` the
// translator can put anywhere is what makes that possible.
export function WinnerName({ nickname, mark, color }: WinnerNameProps) {
  return (
    <Text
      selectable={false}
      className="font-mono text-[10px] font-bold tracking-[0.5px]"
      style={{ color }}
    >
      {mark === null ? nickname : `${mark} ${nickname}`}
    </Text>
  )
}
