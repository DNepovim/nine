import { useState } from 'react'
import { TextInput, View } from 'react-native'

import { CodeDigit } from '@/components/overlays/code-digit'
import { APP_RED, MUTED_INK, PRIMARY_INK, SPECTRUM } from '@/constants/colors'
import { lerpColor } from '@/modes'

// One frame per digit, the way every app that asks for a code off an email draws it: the
// player can see at a glance how many are wanted and how many they have typed, which a
// single field with letter-spacing on it only implies.
//
// It is one real `TextInput` under the frames rather than one per box, and that is the
// whole trick. The phone offers the code from its own notification, and a code pasted out
// of the email is a code nobody had to copy down — both of those are `autoComplete`
// against a single field, and a row of one-character inputs forbids them. So the field
// stays, laid over the frames at zero opacity, and the frames are only a drawing of what
// is in it.
//
// Nothing here submits on the last digit. The card this sits in has a warning on it that
// has to be read before the code is spent — see `email-code-modal.tsx` — and auto-confirming
// would be a way of never showing it.

// Each frame's share of the row, and how tall against that width. A ratio rather than a
// size, so six of them fit a narrow phone and eight would too; the cap is what stops four
// from growing into slabs on a tablet.
const CELL_ASPECT = 0.74
const CELL_MAX_WIDTH = 52

// Big enough to read back against an email, small enough to sit inside a frame that has
// shrunk to a sixth of a dialog. Also what lets the digit be a game colour at all: the
// spectrum's stops clear 3:1 on the surface and nothing below, so they can only be ink at
// a size that counts as large text — which this, bold at 20px, is.
const DIGIT_SIZE = 20

// What a digit that has landed is drawn in: the game's own arc, blue through red, spread
// across however many frames there are. A code is the app speaking for itself rather than
// for a mode, which is the game scale's case — and the card this sits in is already edged
// in the same four stops, so a filling row reads as that border coming inside rather than
// as a colour from nowhere. Nothing here is per-digit meaning; the position in the row is
// the only thing choosing, so a code typed twice looks the same both times.
function stopAt(index: number, count: number): string {
  if (count < 2) return SPECTRUM[0]
  const at = (index / (count - 1)) * (SPECTRUM.length - 1)
  const low = Math.floor(at)
  return lerpColor(
    SPECTRUM[low] ?? SPECTRUM[0],
    SPECTRUM[Math.min(low + 1, SPECTRUM.length - 1)] ?? SPECTRUM[0],
    at - low,
  )
}

export function CodeCells({
  value,
  // How many frames there are, and the most the field will hold. `CODE_LENGTH`, from the
  // one place that knows it.
  length,
  onChange,
  onSubmit,
  // Taken by the field as the card arrives. The card asks one question and has one place
  // to answer it, so there is nothing else a tap could usefully land on first.
  autoFocus = false,
  // False while something is in flight, so a code cannot be edited out from under a
  // request that is already carrying it.
  editable,
  // The code was refused. Every frame goes red — it is one code that was wrong, not a
  // digit, and underlining the last one would point at the wrong thing.
  wrong,
}: {
  value: string
  length: number
  onChange: (next: string) => void
  onSubmit: () => void
  editable: boolean
  wrong: boolean
  autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)

  return (
    <View>
      <View className="flex-row justify-center gap-2">
        {/* The frames change ink without animating, which is the one place this card
            departs from "nothing changes without moving": the digit inside is what pops,
            and a border easing to a new colour under a digit that has already landed reads
            as the frame lagging behind the press. The room code's boxes do the same. */}
        {Array.from({ length }, (_, i) => {
          const digit = value[i] ?? ''
          // Where the next digit lands, drawn as the one frame standing forward. This is
          // the caret: the field itself is invisible, so without it a player typing has
          // nothing telling them the row is live.
          const active = focused && i === Math.min(value.length, length - 1)
          // A filled frame wears its colour, and the caret's dark border gives way to it:
          // the two only ever coincide on the last frame of a full code, where there is
          // nothing left to type and so nothing left for a caret to say.
          const stop = digit ? stopAt(i, length) : null
          return (
            <View
              key={i}
              className="flex-1 items-center justify-center rounded-xl border-2"
              style={{
                aspectRatio: CELL_ASPECT,
                maxWidth: CELL_MAX_WIDTH,
                borderColor: wrong
                  ? APP_RED
                  : stop !== null
                    ? stop + 'CC'
                    : active
                      ? PRIMARY_INK
                      : MUTED_INK,
                backgroundColor: wrong
                  ? APP_RED + '14'
                  : stop !== null
                    ? stop + '12'
                    : active
                      ? PRIMARY_INK + '0D'
                      : undefined,
              }}
            >
              <CodeDigit
                digit={digit}
                color={wrong ? APP_RED : (stop ?? PRIMARY_INK)}
                size={DIGIT_SIZE}
              />
            </View>
          )
        })}
      </View>

      <TextInput
        value={value}
        onChangeText={(next) => {
          onChange(next.replace(/\D/gu, '').slice(0, length))
        }}
        onFocus={() => {
          setFocused(true)
        }}
        onBlur={() => {
          setFocused(false)
        }}
        editable={editable}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        // The caret is pinned past the last digit. A row of frames reads as something you
        // add to and take off the end of, and a tap in the middle of it — which is a tap
        // in the middle of the field underneath — would otherwise drop the next digit
        // there.
        selection={{ start: value.length, end: value.length }}
        className="absolute inset-0"
        // Invisible, and over the frames rather than beside them: a tap anywhere on the
        // row lands on the field, so the frames need no press handler of their own. 16px
        // because mobile Safari zooms the page in on focus for anything under it — the
        // one web quirk with no CSS opt-out — and a field nobody can see is still a field
        // the browser measures.
        style={{ opacity: 0, fontSize: 16 }}
      />
    </View>
  )
}
