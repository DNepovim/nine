import { FeedbackReplyOverlay } from '@/components/overlays/feedback-reply-overlay'
import { InstallOverlay } from '@/components/overlays/install-overlay'
import { PushConsentOverlay } from '@/components/overlays/push-consent-overlay'
import { RatingOverlay } from '@/components/overlays/rating-overlay'
import { ReplayConsentOverlay } from '@/components/overlays/replay-consent-overlay'
import { TutorialOfferModal } from '@/components/overlays/tutorial-offer-modal'
import { WhatsNewOverlay } from '@/components/overlays/whats-new-overlay'
import type { ScreenIntro } from '@/hooks/use-intro-standing'
import type { ScreenAsks } from '@/hooks/use-launch-asks'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'

// The asks the intro makes on launch, each in its turn: the tutorial offer, a reply, the
// news, a session's summary, the install prompt, and the replay and push consents.
export function LaunchAsksLayer({
  control,
  dialogs,
  asks,
  intro,
}: {
  control: ScreenControl
  dialogs: ScreenDialogs
  asks: ScreenAsks
  intro: ScreenIntro
}) {
  const { mode } = control
  const {
    challengeCard,
    feedbackAnswered,
    installPrompt,
    replayConsent,
    splashDone,
    startTutorial,
    welcome,
  } = dialogs
  const { feedbackReplies, launchPopupUp, nextVote, pushConsent, whatsNew } = asks
  const { onIntro, pushCardClear, welcomeOffer } = intro
  return (
    <>
      {/* ── The first launch's tutorial offer — ahead of every launch ask below ── */}
      {welcomeOffer && (
        <TutorialOfferModal
          onAccept={() => {
            startTutorial('welcome')
            // Written down beside the run it records. Only the first launch owes
            // it — the other two doors are a tutorial asked for a second time.
            welcome.taken()
          }}
          onDismiss={welcome.declined}
        />
      )}

      {/* ── A reply to something the player sent ── */}
      {/* First of the three launch dialogs. Somebody answering what you wrote is the
      one of them addressed to you by name, and it would be a poor thing to meet
      after two screens of announcements. Several queue and are shown one at a
      time, oldest first — see hooks/use-feedback-replies.ts. */}
      {onIntro && feedbackReplies.reply !== null && (
        <FeedbackReplyOverlay
          gameMode={mode}
          answer={feedbackReplies.reply.answer}
          quote={feedbackReplies.reply.quote}
          onDismiss={() => {
            feedbackReplies.dismiss()
            // The same moment the answer is marked seen on the server, so HEARD
            // BACK is kept by exactly the replies the player has been shown.
            feedbackAnswered.markAnswered()
          }}
        />
      )}

      {/* ── What's new — announcements the player hasn't seen yet ── */}
      {/* A first-ever launch has nothing unseen to show — use-whats-new.ts marks
      everything seen when there is no record at all.

      Waits on the reply request the same way the install prompt waits on this one:
      `ready` is what says "asked and answered", and painting before it would put
      the news up only to have a reply land on top of it. */}
      {onIntro &&
        feedbackReplies.ready &&
        feedbackReplies.reply === null &&
        whatsNew.visible && (
          <WhatsNewOverlay
            cards={whatsNew.cards}
            onDismiss={whatsNew.dismiss}
            onAccept={whatsNew.accept}
          />
        )}

      {/* ── Session dialog — the summary of a closed session, then its rating, remark
      and the vote. Mounted once the popup has unmounted rather than alongside it,
      so its card rises after the popup's has gone instead of over it. `asking` is
      the owed summary — see `summary` in use-session-summaries.ts. ── */}
      {onIntro &&
        feedbackReplies.ready &&
        feedbackReplies.reply === null &&
        !whatsNew.visible &&
        whatsNew.rating.asking !== null && (
          <RatingOverlay
            summary={whatsNew.rating.asking}
            onSend={whatsNew.rating.send}
            onRemark={whatsNew.rating.remark}
            options={nextVote.options.filter((option) => option.canVote)}
            onVote={nextVote.vote}
            onDismiss={whatsNew.rating.done}
          />
        )}

      {/* ── Install prompt — web only, and only once the news has had its turn.
      Every launch until the player installs: closing it lasts the session.

      The ask normally happens earlier, over the splash (app/_layout.tsx). This is
      the launch that has no splash to hold — the reload a service-worker update ends
      in — so `splashDone` is what keeps the two copies from ever being up at once. ── */}
      {splashDone &&
        onIntro &&
        feedbackReplies.ready &&
        feedbackReplies.reply === null &&
        whatsNew.ready &&
        !launchPopupUp &&
        challengeCard === undefined &&
        installPrompt.target !== 'none' && (
          <InstallOverlay
            target={installPrompt.target}
            onInstall={installPrompt.install}
            onDismiss={installPrompt.dismiss}
          />
        )}

      {/* ── Session-recording ask — the one thing analytics does that needs it,
      and the SDK is held off it until this is answered. Lowest of the launch
      asks: it waits for the install prompt's own turn to end (dismissed or
      installed, either reads as target 'none'), same priority tier, one at a
      time. Every launch until answered, like the install prompt beside it;
      answering either way — ALLOW or NO THANKS — is what stops it coming back.
      Revisited later from OPTIONS, which calls the same hook. ── */}
      {splashDone &&
        onIntro &&
        feedbackReplies.ready &&
        feedbackReplies.reply === null &&
        whatsNew.ready &&
        !launchPopupUp &&
        challengeCard === undefined &&
        installPrompt.target === 'none' &&
        replayConsent.visible && (
          <ReplayConsentOverlay
            onAllow={replayConsent.allow}
            onDecline={replayConsent.decline}
            onDismiss={replayConsent.dismiss}
          />
        )}

      {/* ── Push consent ── The second step, behind the replay card above: same
          turn in the queue, and never up at the same time as it. Answered, or
          waved off for the session, like the card before it. ── */}
      {pushConsent.visible && pushCardClear && (
        <PushConsentOverlay
          reach={pushConsent.reach}
          onAllow={pushConsent.allow}
          onDecline={pushConsent.decline}
          onDismiss={pushConsent.dismiss}
        />
      )}
    </>
  )
}
