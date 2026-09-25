import { Pressable, Text, View } from 'react-native'

import { BestScoresLine } from '@/components/game/best-scores-line'
import type { RecordHolder } from '@/hooks/use-board'

// The strip is the one thing in the game that is drawn from other people's data, so the
// two ways it can break are the two ways that data can be extreme: a name longer than
// the room it has, and a score with more digits than the row was spaced for. Both axes,
// separately, because they fail differently — a long name is cut, a long number is not.
export type NameLength = 'short' | 'long'
// Named for what they are rather than for how big they are: there is no "long" score
// any more once there are three of them, and a button that says 6 DIGITS says exactly
// what it is about to draw.
export type ScoreLength = 'three' | 'five' | 'six'

// How each end of each axis is named — on the sidebar button and in the caption under
// the strip, from here so the two can never come to say it differently.
export const NAME_TAG = {
  short: 'SHORT',
  long: 'LONG',
} as const satisfies Record<NameLength, string>

export const SCORE_TAG = {
  three: '3 DIGITS',
  five: '5 DIGITS',
  six: '6 DIGITS',
} as const satisfies Record<ScoreLength, string>

// Which board each of the three holders is top of. The player's own cell has no holder.
type Board = 'today' | 'week' | 'ever'

const NAMES = {
  short: { today: 'Jo', week: 'Ax', ever: 'Mia' },
  // Sixteen characters, which is the nickname field's own maxLength — the longest name
  // a player can register and so the longest the strip will ever be handed. The third
  // carries diacritics and an underscore: `shortName` steps code points, and a name that
  // loses half a character is a bug this is here to catch.
  long: {
    today: 'Bartholomew12345',
    week: 'MMMMMMMMMMMMMMMM',
    ever: 'Žluťoučký_kůň99',
  },
} as const satisfies Record<NameLength, Record<Board, string>>

const SCORES = {
  // A board barely played, where the row has room to spare.
  three: { you: 120, today: 340, week: 560, ever: 980 },
  // Five figures on every board at once: an ordinary mature board.
  five: { you: 84220, today: 91310, week: 96450, ever: 99870 },
  // Six, which a long Speed run on Extreme can reach and which nothing in the row was
  // spaced for. The widest the strip can ever be asked to draw: four numbers each a
  // digit wider than the case above, against names that have not got any shorter. This
  // is the button that shows what gives way first.
  six: { you: 184220, today: 391310, week: 596450, ever: 999870 },
} as const satisfies Record<ScoreLength, Record<Board | 'you', number>>

// The three holders span the colour ramp rather than all sitting at the top of it, so
// every press of these buttons shows what a name's gradient actually does: a career
// worth colour, a career like the ones currently holding the real boards — 78/55 earns
// under a quarter of the accuracy hue and none of the speed one — and a player the
// counters have never seen, who is drawn in plain grey. See lib/name-gradient.ts.
const FACTORS = {
  today: { userId: 'dev-strip-today', avgAccuracy: 96, avgSpeed: 93 },
  week: { userId: 'dev-strip-week', avgAccuracy: 78, avgSpeed: 55 },
  ever: { userId: 'dev-strip-ever', avgAccuracy: null, avgSpeed: null },
} as const satisfies Record<Board, { userId: string } & Omit<RecordHolder, 'nickname'>>

const LEGEND = 'HOLDERS → 96/93 · 78/55 · UNCOUNTED'

const noop = () => {
  // The gallery is for looking. There is no run to pause and no achievement to open.
}

// The best-scores strip on its own, at the top of an empty screen, with names and scores
// pushed to either end of what they can be.
//
// The real component with real props rather than a drawing of it: what is being looked
// at is how the row spaces itself, and that is decided by the same measuring pass the
// game's own strip goes through. A mock that positioned the cells itself would agree
// with the game exactly until the moment it stopped, which is the moment it matters.
//
// Tapping a cell still opens a profile — it is part of what the strip does. The players
// behind these names do not exist, so the card comes up on its "could not be loaded"
// state; the press is what is being shown here, not the card.
export function ScoreStripVariant({
  names,
  scores,
  onClose,
}: {
  names: NameLength
  scores: ScoreLength
  onClose: () => void
}) {
  const holder = (board: Board): RecordHolder => ({
    ...FACTORS[board],
    nickname: NAMES[names][board],
  })
  const score = SCORES[scores]

  return (
    // The screen's own padding, so the row is exactly as wide here as it is in a run.
    // Pressing the ground closes: the strip has no chrome of its own to hang a button
    // on, and a cell takes its own press before this one ever sees it.
    <Pressable className="flex-1 bg-surface px-4 py-2" onPress={onClose}>
      <BestScoresLine
        inRun
        mode="accuracy"
        announcement={null}
        onOpenAchievement={noop}
        onPause={noop}
        viewerId="dev-strip-viewer"
        score={0}
        yourBest={score.you}
        loaded
        today={score.today}
        week={score.week}
        ever={score.ever}
        todayIsMine={false}
        weekIsMine={false}
        everIsMine={false}
        todayHolder={holder('today')}
        weekHolder={holder('week')}
        everHolder={holder('ever')}
      />
      {/* What is on show, said in the same small mono the strip is drawn in — the
          sidebar button is lit, but the button is outside the phone frame and the eye
          is in here. */}
      <View className="mt-4 gap-1">
        <Text
          selectable={false}
          className="font-mono text-[9px] font-bold tracking-[1px] text-dim"
        >
          {`${NAME_TAG[names]} NAMES · ${SCORE_TAG[scores]}`}
        </Text>
        <Text selectable={false} className="font-mono text-[9px] tracking-[1px] text-dim">
          {LEGEND}
        </Text>
        <Text selectable={false} className="font-mono text-[9px] tracking-[1px] text-dim">
          TAP THE GROUND TO CLOSE
        </Text>
      </View>
    </Pressable>
  )
}
