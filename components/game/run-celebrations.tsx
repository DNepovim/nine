import { AnnouncementEffect } from '@/components/game/announcement-effect'
import { Confetti } from '@/components/game/confetti'
import { StepUpToast } from '@/components/game/step-up-toast'
import { TutorialDoneModal } from '@/components/overlays/tutorial-done-modal'
import type { ScreenField } from '@/hooks/use-play-field'
import type { ScreenAnnouncements } from '@/hooks/use-run-announcements'
import type { ScreenControl } from '@/hooks/use-run-control'
import { STEP_UP_BOARD } from '@/lib/step-up'
import { gradientOf } from '@/modes'

// Trainee's shower wears the mode's own blue rather than the default spectrum. This
// fires on every clean hit, and the full arc is the personal-best celebration's — a
// hit-by-hit sprinkle borrowing it made the two read as the same event.
const TRAINEE_CONFETTI = [gradientOf('trainee')[0]] as const
// What celebrates a run from behind the game screen: a record's effect, Trainee's confetti for a
// clean hit, the step-up toast, and the offer the tutorial makes as it ends.
export function RunCelebrations({
  control,
  announcements,
  field,
}: {
  control: ScreenControl
  announcements: ScreenAnnouncements
  field: ScreenField
}) {
  const { isPlaying, mode, pauseRun } = control
  const { announcement, celebration, setStepUpOpen, stepUp, stepUpOpen } = announcements
  const { taught } = field
  return (
    <>
      {/* The celebration sits before the Screen so it paints behind the game's own UI.
      Keyed on the announcement so each one plays from the start, and so escalating
      through two records in a run swaps the effect rather than reusing it. */}
      {announcement !== null && (
        <AnnouncementEffect key={announcement.id} id={announcement.id} mode={mode} />
      )}

      {/* Trainee celebrates the hit rather than the run — half a record's pieces,
      because this fires many times a run and should not shout as loudly.
      Keyed on the batch so consecutive clean hits each get their own. */}
      {celebration.seq !== null && (
        <Confetti key={celebration.seq} density="half" colors={TRAINEE_CONFETTI} />
      )}

      {/* Trainee only, once a run, and never for a player who already knows the
      boards exist. Floats over the top bars rather than sitting in the layout —
      Trainee reclaims the band a strip would occupy. Holds until it is answered,
      which is why it carries NOT NOW — and holds through a pause rather than being
      withdrawn by one, which is why it is drawn only while the run is live: an
      unanswered offer belongs over the dial, not over the pause screen. */}
      {isPlaying && stepUp.message !== null && !stepUpOpen && (
        <StepUpToast
          opener={stepUp.message.opener}
          invite={stepUp.message.invite}
          mode={STEP_UP_BOARD.mode}
          onPress={() => {
            // Frozen rather than ended: backing out of the screen this opens leaves
            // the practice run exactly where it stood.
            pauseRun('step_up')
            stepUp.dismiss()
            setStepUpOpen(true)
          }}
          onDismiss={stepUp.dismiss}
        />
      )}

      {/* The same offer the toast makes, at the one moment the tutorial has it to
      make: the lesson over and a target taken without it. A dialog rather than a
      toast because nothing is running underneath — the tutorial has no clock — and
      because the end of the lesson is worth stopping for.

      Drawn through the pause it opens as well as the run it was made on: accepting
      freezes the run behind it, and the card has an exit to play before the screen
      it leads to takes over. */}
      {taught.open && (
        <TutorialDoneModal
          mode={STEP_UP_BOARD.mode}
          onAccept={() => {
            // Frozen rather than ended, exactly as the toast does it: backing out
            // of the screen this opens leaves the tutorial where it stood.
            pauseRun('step_up')
            taught.dismiss()
            setStepUpOpen(true)
          }}
          onDismiss={taught.dismiss}
        />
      )}
    </>
  )
}
