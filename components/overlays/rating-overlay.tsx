import { Trans, useLingui } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { interpolateColor } from 'react-native-reanimated'

import { LinkButton } from '@/components/link-button'
import { ChallengeName } from '@/components/overlays/challenge-name'
import { CodeKeyboard, type KeyPaint } from '@/components/overlays/code-keyboard'
import { ModalCard } from '@/components/overlays/modal-card'
import { NextVote, NextVoteTitle, useVoteView } from '@/components/overlays/next-vote'
import { TextArea } from '@/components/overlays/text-area'
import { PrimaryButton } from '@/components/primary-button'
import { DIAL_COLORS } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { MAX_REMARK_LENGTH, remarkOf } from '@/lib/remark'
import { isRating, type Rating } from '@/lib/session-rating'
import type { VoteOption } from '@/lib/session-ratings'
import type { SessionSummary } from '@/lib/session-summary'
import { darkGradientOf, gradientOf } from '@/modes'

// The two ends, as faces on their own keys: 1 is NOT FOR ME and 9 is MORE OF THIS. A
// face says how the player felt where a caption under the keypad only said which number
// meant it, and the seven keys between are left as digits — a scale of nine faces is a
// row of emoji to tell apart, and the middle is a matter of degree.
const ENDS = { 1: '😣', 9: '😍' } as const

// A key wears what a dial key wears at the same value: 1 to 8 up the dial's own ramp, from
// pale to blue, and 9 in the challenge's dark gradient with the warm digit — the same
// split `DialButton` makes, so the keypad reads as the dial the player has just been
// playing on, warming towards the answer that liked it most. The ramp runs to 8 there and
// here, so a 1 sits an eighth of the way up rather than on the palest end.
const RAMP_MAX = 8

const dialPaint =
  (modeId: string) =>
  (key: number): KeyPaint => {
    if (key === 9) return { fill: darkGradientOf(modeId), ink: DIAL_COLORS.peakText }
    const tint = interpolateColor(
      key / RAMP_MAX,
      [0, 1],
      [DIAL_COLORS.low, DIAL_COLORS.high],
    )
    return { fill: [tint, tint], ink: DIAL_COLORS.text }
  }

// The **rating**: how was the session the player has just been told the summary of.
//
// Asked on a keypad of nine because the game is a dial of nine — the player answers the
// way they played. One tap answers and the dialog goes: there is no SEND, because a
// question this small should cost one press, and the dial's colours on every key already
// say which end is which before anything is pressed.
//
// Its own dialog rather than a last page of the launch popup, because the popup is
// dismissed as a whole and every page on it is "shown" the moment it opens — a question
// on a page somebody skipped past with the dots would have been asked without being seen.
//
// Two steps in one card. The key still answers on the press and the figure is written
// then — the one-tap question stays one tap — but the card turns to ANYTHING TO ADD?
// instead of closing, for the **remark**: the rating's written half. NOT NOW there keeps
// the figure and goes. SKIP on the first step reaches the words without a figure, for a
// player with something to say and no number for it; NOT NOW on the first step still
// writes nothing at all.
//
// A third step, **the vote**, for whoever gets that far: which of the next two challenges
// should open first. It follows the words whether they were sent or put off, and it is
// left out where the queue has no pair to offer. It is the same body the intro's link
// opens in a dialog of its own — see `NextVote`.
//
// One card rather than a second dialog after the first, so there is one scrim and no
// entrance replayed in the middle of an answer — the arrangement `EmailDialog` makes for
// its two cards. `avoidKeyboard` throughout, since the second step has a field.
type Step = 'figure' | 'words' | 'vote'

export function RatingOverlay({
  summary,
  onSend,
  onRemark,
  options,
  onVote,
  onDismiss,
}: {
  summary: SessionSummary
  onSend: (rating: Rating) => void
  onRemark: (text: string) => void
  // The two challenges up for the vote, empty where there is no choice. Passed in rather
  // than read here so the dialog stays a picture of what it is given.
  options: readonly VoteOption[]
  onVote: (modeId: string) => void
  // Called once the card has gone, however it went — SEND, either NOT NOW or the header
  // close.
  onDismiss: () => void
}) {
  // `t` rather than <Trans>: a placeholder takes a string, not a node.
  const { t } = useLingui()
  const [step, setStep] = useState<Step>('figure')
  const [words, setWords] = useState('')
  // Whether a key has already answered. A second tap during the turn to step two would
  // write twice — the second time perhaps another key.
  const sent = useRef(false)
  // The same for SEND, which the card stays pressable for through its exit.
  const remarked = useRef(false)
  const remark = remarkOf(words)
  const view = useVoteView(options)
  // After the words: the vote where there is one to take, else the end.
  const afterWords = (close: () => void) => {
    if (options.length === 2) setStep('vote')
    else close()
  }

  return (
    <ModalCard
      edge={gradientOf(summary.modeId)}
      closeButton={false}
      title={step === 'vote' ? <NextVoteTitle settled={view.settled} /> : undefined}
      avoidKeyboard
      // A tap beside the card must not throw away words already typed.
      held={remark !== null}
      onDismiss={onDismiss}
    >
      {(close) =>
        step === 'vote' ? (
          <View className="items-center">
            <NextVote options={options} onVote={onVote} onClose={close} view={view} />
            <LinkButton
              id="vote.dismiss"
              className="mt-5"
              icon="close-outline"
              label={
                options.some((option) => option.mine) ? (
                  <Trans>DONE</Trans>
                ) : (
                  <Trans>NOT NOW</Trans>
                )
              }
              onPress={close}
            />
          </View>
        ) : step === 'words' ? (
          <View className="items-center">
            <Text selectable={false} className={cn(TYPE.cardTitle, 'text-center')}>
              <Trans>ANYTHING TO ADD?</Trans>
            </Text>
            <ChallengeName
              modeId={summary.modeId}
              className={cn(TYPE.screenTitle, 'mt-2 mb-4')}
            />
            <TextArea
              value={words}
              onChange={setWords}
              maxLength={MAX_REMARK_LENGTH}
              placeholder={t`What made it good or bad?`}
              className="mb-4"
            />
            {/* Stretched: the card centres its column for the question and the keypad, and a
                primary button inside that shrinks to its label instead of spanning the
                card as every dialog's does. */}
            <View className="self-stretch">
              <PrimaryButton
                id="rating.send"
                disabled={remark === null}
                onPress={() => {
                  if (remark === null || remarked.current) return
                  remarked.current = true
                  onRemark(remark)
                  afterWords(close)
                }}
                label={<Trans>SEND</Trans>}
              />
            </View>
            <LinkButton
              id="rating.dismiss"
              className="mt-5"
              icon="close-outline"
              label={<Trans>NOT NOW</Trans>}
              onPress={() => {
                afterWords(close)
              }}
            />
          </View>
        ) : (
          <View className="items-center">
            {/* The question first and the challenge under it: the name says which contest,
              but what the card is for is the question. */}
            <Text selectable={false} className={cn(TYPE.cardTitle, 'text-center')}>
              <Trans>HOW DO YOU LIKE THE CHALLENGE?</Trans>
            </Text>
            <ChallengeName
              modeId={summary.modeId}
              className={cn(TYPE.screenTitle, 'mt-2')}
            />

            <CodeKeyboard
              id="rating.key"
              keyPaint={dialPaint(summary.modeId)}
              faces={ENDS}
              onKey={(key) => {
                if (!isRating(key) || sent.current) return
                sent.current = true
                onSend(key)
                setStep('words')
              }}
            />

            <View className="mt-5 flex-row gap-6">
              <LinkButton
                id="rating.dismiss"
                icon="close-outline"
                label={<Trans>NOT NOW</Trans>}
                onPress={close}
              />
              <LinkButton
                id="rating.skip"
                icon="arrow-forward-outline"
                label={<Trans>SKIP</Trans>}
                onPress={() => {
                  setStep('words')
                }}
              />
            </View>
          </View>
        )
      }
    </ModalCard>
  )
}
