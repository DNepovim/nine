import { Trans, useLingui } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ChallengeName } from '@/components/overlays/challenge-name'
import { CodeKeyboard, type KeyPaint } from '@/components/overlays/code-keyboard'
import { ModalCard } from '@/components/overlays/modal-card'
import {
  NextVote,
  NextVoteTitle,
  useVoteView,
  VOTE_INK,
  voteFill,
} from '@/components/overlays/next-vote'
import { StepFlow } from '@/components/overlays/step-flow'
import { SummaryCard } from '@/components/overlays/summary-card'
import { TextArea } from '@/components/overlays/text-area'
import { PrimaryButton } from '@/components/primary-button'
import { DIAL_COLORS } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useStepFlow } from '@/hooks/use-step-flow'
import { cn } from '@/lib/cn'
import { MAX_REMARK_LENGTH, remarkOf } from '@/lib/remark'
import { isRating, type Rating } from '@/lib/session-rating'
import type { VoteOption } from '@/lib/session-ratings'
import type { SessionSummary } from '@/lib/session-summary'
import { darkGradientOf, gradientOf, lerpColor } from '@/modes'

// The two ends, as faces on their own keys: 1 is NOT FOR ME and 9 is MORE OF THIS. A
// face says how the player felt where a caption under the keypad only said which number
// meant it, and the seven keys between are left as digits — a scale of nine faces is a
// row of emoji to tell apart, and the middle is a matter of degree.
const ENDS = { 1: '😣', 9: '😍' } as const

// A key wears the challenge's own colour, from a very light shade of it on 1 to its dark
// pair on 9 — the scale is the answer, so the colour deepens as the liking does. The
// ink turns from dark to white half way, where the fill is deep enough to carry it.
const LIGHTEST = 0.85
const WHITE_INK_FROM = 5

const dialPaint =
  (modeId: string) =>
  (key: number): KeyPaint => {
    const light = lerpColor(gradientOf(modeId)[1], '#FFFFFF', LIGHTEST)
    const dark = darkGradientOf(modeId)[1]
    const tint = lerpColor(light, dark, (key - 1) / 8)
    return {
      fill: [tint, tint],
      ink: key >= WHITE_INK_FROM ? '#FFFFFF' : DIAL_COLORS.text,
    }
  }

// The **session dialog**: what a closed session came to, then how the player liked it, then
// what they would add, then which challenge should come next — four steps in one card.
//
// The first step is the **summary**, which used to be a page of the launch popup and is
// now this dialog's opening: a player who is told how it ended is asked about it without
// the card changing under them. The steps are the ones that already existed, joined.
//
// The **rating** proper:
// Asked on a keypad of nine because the game is a dial of nine — the player answers the
// way they played. One tap answers and the dialog goes: there is no SEND, because a
// question this small should cost one press, and the dial's colours on every key already
// say which end is which before anything is pressed.
//
// Its own dialog rather than a last page of the launch popup, because the popup is
// dismissed as a whole and every page on it is "shown" the moment it opens — a question
// on a page somebody skipped past with the dots would have been asked without being seen.
//
// Steps two and three in one card. The key still answers on the press and the figure is written
// then — the one-tap question stays one tap — but the card turns to ANYTHING TO ADD?
// instead of closing, for the **remark**: the rating's written half. NOT NOW there keeps
// the figure and goes. SKIP on the first step reaches the words without a figure, for a
// player with something to say and no number for it; NOT NOW on the first step still
// writes nothing at all.
//
// A fourth step, **the vote**, for whoever gets that far: which of the next two challenges
// should open first. It follows the words whether they were sent or put off, and it is
// left out where the queue has no pair to offer. It is the same body the intro's link
// opens in a dialog of its own — see `NextVote`.
//
// **Two steps wear the challenge's gradient** — the summary, and the vote once a tile is
// picked — and write in white on it; the two between sit on the ordinary surface with the
// challenge's name large over the question.
//
// One card rather than a second dialog after the first, so there is one scrim and no
// entrance replayed in the middle of an answer — the arrangement `EmailDialog` makes for
// its two cards. `avoidKeyboard` throughout, since the third step has a field.
const STEPS = ['summary', 'figure', 'words', 'vote'] as const
type Step = (typeof STEPS)[number]

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
  // Called once the card has gone, however it went — the header close, a link, or the end
  // of the last step.
  onDismiss: () => void
}) {
  // `t` rather than <Trans>: a placeholder takes a string, not a node.
  const { t } = useLingui()
  const [asked, setStep] = useState<Step>('summary')
  // What is drawn trails what was asked for by the length of the fade — see `useStepFlow`.
  const flow = useStepFlow(STEPS.indexOf(asked))
  const step = STEPS[flow.shown] ?? 'summary'
  const [words, setWords] = useState('')
  // Whether a key has already answered. A second tap during the turn to the words would
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

  const fill =
    step === 'summary'
      ? gradientOf(summary.modeId)
      : step === 'vote'
        ? voteFill(view)
        : undefined

  const title =
    step === 'summary' ? (
      <Trans>HOW DID IT END?</Trans>
    ) : step === 'figure' ? (
      <Trans>HOW WAS IT?</Trans>
    ) : step === 'words' ? (
      <Trans>ANYTHING TO ADD?</Trans>
    ) : (
      <NextVoteTitle settled={view.settled} />
    )

  return (
    <ModalCard
      edge={gradientOf(summary.modeId)}
      closeButton={false}
      title={title}
      titleKey={`${step}.${view.settled}`}
      titleColor={fill === undefined ? undefined : VOTE_INK}
      fill={fill}
      avoidKeyboard
      // A tap beside the card must not throw away words already typed.
      held={remark !== null}
      onDismiss={onDismiss}
    >
      {(close) => (
        <StepFlow flow={flow}>
          {step === 'summary' ? (
            <SummaryCard
              summary={summary}
              onNext={() => {
                setStep('figure')
              }}
            />
          ) : step === 'vote' ? (
            <View className="items-center">
              <NextVote options={options} onVote={onVote} onClose={close} view={view} />
              <LinkButton
                id="vote.dismiss"
                className="mt-5"
                icon="close-outline"
                light={fill !== undefined}
                label={view.settled ? <Trans>CLOSE</Trans> : <Trans>NOT NOW</Trans>}
                onPress={close}
              />
            </View>
          ) : step === 'words' ? (
            <View className="items-center">
              <ChallengeName
                modeId={summary.modeId}
                className={cn(TYPE.screenTitle, 'mt-2 mb-4 text-center')}
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
                id="rating.skip"
                className="mt-5"
                icon="arrow-forward-outline"
                label={<Trans>SKIP</Trans>}
                onPress={() => {
                  afterWords(close)
                }}
              />
            </View>
          ) : (
            <View className="items-center">
              {/* The challenge large and in its gradient over the keypad; the question is
                the dialog's own title. */}
              <ChallengeName
                modeId={summary.modeId}
                className={cn(TYPE.screenTitle, 'mt-2 text-center')}
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

              {/* Only a way on. Closing is the header's, as on every step. */}
              <LinkButton
                id="rating.skip"
                className="mt-5"
                icon="arrow-forward-outline"
                label={<Trans>SKIP</Trans>}
                onPress={() => {
                  setStep('words')
                }}
              />
            </View>
          )}
        </StepFlow>
      )}
    </ModalCard>
  )
}
