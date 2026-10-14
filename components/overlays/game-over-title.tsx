import { useEffect } from 'react'
import { View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import type { TitleWords } from '@/lib/game-over-title'
import { gradientOf, lerpColor, type ModeId } from '@/modes'

import { AnimatedLetter } from './animated-letter'

// The animated wordmark: rows of gradient-cycling, floating letters in a mode's own
// colours. Over the game-over screen, shared with the in-game dying sequence so the title
// hands off seamlessly from one to the other — and over the challenge dialog, where the
// one row is the challenge's name.
//
// On game over the words come from `gameOverTitle`, which says what the run was worth
// rather than that it ended.
//
// **The ramp is measured, not assumed.** Each letter's colour along the mode gradient and
// its entrance delay come from its position among *all* the letters there are, counted
// here. This used to be a hardcoded 4×2 — right for two four-letter words and wrong for
// anything else, which the challenge dialog's names are: a longer word landed off the end
// of the ramp, so its last letters shared a colour and arrived together.
export function GameOverTitle({
  gameMode,
  words,
  shadow = false,
}: {
  // Arcade too, which the game machine never runs but which has a gradient of its own
  // and an end worth naming. See components/game/arcade-over.tsx. A challenge id as
  // well, which is where the dialog's own colours come from.
  gameMode: ModeId
  // One string per row. `TitleWords` is the game-over pair and satisfies this; the
  // challenge dialog hands over a single name.
  words: TitleWords | readonly string[]
  // The all-time screen puts these letters on gold with a celebration behind them.
  shadow?: boolean
}) {
  const rows = words.map((word) => Array.from(word))
  // Counted rather than declared, so a row of any length ramps across its whole self.
  // At least one, since dividing the ramp by zero on an empty title would paint every
  // letter `NaN` — and a title with no letters draws nothing anyway.
  const totalLetters = Math.max(
    1,
    rows.reduce((sum, row) => sum + row.length, 0),
  )
  // Where each row starts in that count, so the ramp runs on through a line break
  // instead of restarting at every row.
  const rowStarts = rows.reduce<number[]>(
    (starts, row) => [...starts, (starts[starts.length - 1] ?? 0) + row.length],
    [0],
  )
  const gradPhase = useSharedValue(0)
  const gradStartSv = useSharedValue<string>(gradientOf(gameMode)[0])
  const gradEndSv = useSharedValue<string>(gradientOf(gameMode)[1])

  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  return (
    <View className="items-center gap-1">
      {rows.map((word, rowIndex) => (
        // Wrapping, which costs the two four-letter rows on the game-over screen nothing
        // — a row that fits never wraps. It is the safety net for the challenge dialog,
        // whose rows are a challenge's name rather than a word chosen to be four letters
        // long: at a pinned 56px a word of six or more is wider than the card, and the
        // letters ran off both edges of it. Breaking mid-word is not pretty, and it is
        // what the caller splitting on spaces is for; this is what happens when that is
        // not enough.
        <View key={rowIndex} className="flex-row flex-wrap justify-center gap-3">
          {word.map((char, colIndex) => {
            const globalIndex = (rowStarts[rowIndex] ?? 0) + colIndex
            // Guarded against a one-letter title, which has no distance to travel — the
            // same division `nameColors` protects for a one-character nickname.
            const tBase = totalLetters > 1 ? globalIndex / (totalLetters - 1) : 0
            return (
              <AnimatedLetter
                key={globalIndex}
                char={char}
                color={lerpColor(gradientOf(gameMode)[0], gradientOf(gameMode)[1], tBase)}
                tBase={tBase}
                gradStart={gradStartSv}
                gradEnd={gradEndSv}
                gradPhase={gradPhase}
                mode={gameMode}
                delay={globalIndex * 80}
                // Its place in its own row, which is what the glass sheen offsets by.
                letterIndex={colIndex}
                shadow={shadow}
              />
            )
          })}
        </View>
      ))}
    </View>
  )
}
