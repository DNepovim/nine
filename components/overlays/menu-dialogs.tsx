import { AdminOverlay } from '@/components/overlays/admin-overlay'
import { AdvancedOptionsOverlay } from '@/components/overlays/advanced-options-overlay'
import { ChallengeModal } from '@/components/overlays/challenge-modal'
import { HowToPlayOverlay } from '@/components/overlays/how-to-play-overlay'
import { JoinRoomOverlay } from '@/components/overlays/join-room-overlay'
import { NewsArchiveOverlay } from '@/components/overlays/news-archive-overlay'
import { NextVoteDialog } from '@/components/overlays/next-vote-dialog'
import { NextVoteResultsDialog } from '@/components/overlays/next-vote-results-dialog'
import { ShareModal } from '@/components/overlays/share-modal'
import type { ScreenIntro } from '@/hooks/use-intro-standing'
import type { ScreenAsks } from '@/hooks/use-launch-asks'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenSession } from '@/hooks/use-run-session'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'
import { track } from '@/lib/analytics'
import { newRunId } from '@/lib/run-id'
import { isMode } from '@/modes'

// The menu-level overlays and the intro's dialogs: options, the news, the guide, joining a
// room, admin, the share sheet, the two vote dialogs and a challenge in full.
export function MenuDialogs({
  control,
  session,
  dialogs,
  account,
  asks,
  intro,
}: {
  control: ScreenControl
  session: ScreenSession
  dialogs: ScreenDialogs
  account: ScreenAccount
  asks: ScreenAsks
  intro: ScreenIntro
}) {
  const {
    difficulty,
    drag,
    mode,
    send,
    setRunSession,
    setRunSessionClosesAt,
    setWindowShut,
    showSum,
    toggleDrag,
    toggleSum,
  } = control
  const { setModeBeforeSession } = session
  const {
    challengeCard,
    howToPlay,
    menuOverlay,
    replayConsent,
    setChallengeCard,
    setMenuOverlay,
    setShareInvite,
    shareInvite,
    startTutorial,
  } = dialogs
  const { nickname, rolePreview, userId } = account
  const {
    nextVote,
    pushConsent,
    setVoteOpen,
    setVoteResultsOpen,
    voteOpen,
    voteResultsOpen,
  } = asks
  const { handleJoinRoom, isMultiActive, multiRoom } = intro
  return (
    <>
      {/* ── Advanced options — shared between menu and pause ── */}
      {menuOverlay === 'advanced' && (
        <AdvancedOptionsOverlay
          showSum={showSum}
          onToggleSum={toggleSum}
          drag={drag}
          onToggleDrag={toggleDrag}
          replayConsent={replayConsent.consent}
          onToggleReplayConsent={() => {
            if (replayConsent.consent === 'granted') replayConsent.decline()
            else replayConsent.allow()
          }}
          push={pushConsent.row}
          pushHelp={pushConsent.help}
          onTogglePush={pushConsent.toggle}
          onOpenNews={() => {
            setMenuOverlay('news')
          }}
          onClose={() => {
            setMenuOverlay('none')
          }}
        />
      )}

      {/* ── News archive — opened from advanced options ── */}
      {menuOverlay === 'news' && (
        <NewsArchiveOverlay
          onClose={() => {
            setMenuOverlay('advanced')
          }}
        />
      )}

      {/* ── How to play guide ── */}
      {menuOverlay === 'howToPlay' && (
        <HowToPlayOverlay
          onClose={() => {
            setMenuOverlay('none')
            howToPlay.markRead()
          }}
          // The same run a first launch opens on, asked for this time, and dealt the
          // same way: straight onto the board, with the lesson's own opening card
          // the first thing said over it. Reaching the bottom of the guide is
          // reading it, whichever button is pressed there, so this marks it read
          // exactly as GOT IT does.
          onTryTutorial={() => {
            setMenuOverlay('none')
            howToPlay.markRead()
            startTutorial('guide')
          }}
        />
      )}

      {/* ── Join a room by code — its own screen past WITH FRIENDS' JOIN ROOM ──
        !isMultiActive so a successful join steps aside for the waiting room
        rather than sitting on top of it — nothing else resets `menuOverlay`
        back to 'none' on that edge. */}
      {menuOverlay === 'joinRoom' && !isMultiActive && (
        <JoinRoomOverlay
          joinError={multiRoom.error}
          onJoinRoom={handleJoinRoom}
          onClose={() => {
            setMenuOverlay('none')
          }}
        />
      )}

      {/* ── Admin — who holds a role, and a search to hand one out. Before the
          challenge dialog, which its CHALLENGES gallery opens and which has to draw
          over it. ── */}
      {menuOverlay === 'admin' && (
        <AdminOverlay
          viewerId={userId}
          onPreview={(role, label) => {
            rolePreview.start(role, label)
            // And out of the way. The point of a preview is the app underneath it,
            // and the screen that started it is about to lose the link that drew it.
            setMenuOverlay('none')
          }}
          onOpenChallenge={(modeId, session) => {
            setChallengeCard({ state: 'lab', modeId, session })
          }}
          onClose={() => {
            setMenuOverlay('none')
          }}
        />
      )}

      {/* ── The intro's SHARE: the address as a QR code, the system sheet behind it ── */}
      {shareInvite !== undefined && (
        <ShareModal
          invite={shareInvite}
          onDismiss={() => {
            setShareInvite(undefined)
          }}
        />
      )}

      {/* ── The vote, from the link on the intro. Under the challenge dialog, which
          a player can open from the same card. ── */}
      {voteResultsOpen && (
        <NextVoteResultsDialog
          options={nextVote.options}
          onDismiss={() => {
            setVoteResultsOpen(false)
          }}
        />
      )}
      {voteOpen && (
        <NextVoteDialog
          options={nextVote.options}
          onVote={nextVote.vote}
          onDismiss={() => {
            setVoteOpen(false)
          }}
        />
      )}

      {/* ── A challenge, in full: what it asks, who leads, and the way in. After the
          admin screen, whose gallery opens it too and has to stay under it. ── */}
      {challengeCard !== undefined && (
        <ChallengeModal
          card={challengeCard}
          userId={userId}
          nickname={nickname}
          onStart={(modeId, sessionId) => {
            if (sessionId === null) {
              // The lab deals a challenge outside any session, which is the point
              // of it: no window, and so no standings to post to.
              setRunSession(null)
              if (isMode(mode)) setModeBeforeSession(mode)
              send({ type: 'SET_MODE', mode: modeId })
              send({ type: 'START', now: Date.now(), runId: newRunId() })
              setChallengeCard(undefined)
              setMenuOverlay('none')
              track('run_started', { mode: modeId, difficulty, from: 'dev' })
              return
            }
            // Set before the run is dealt, so the first thing the run can do —
            // cross a record on its opening hit — already knows where its score
            // belongs.
            setRunSession(sessionId)
            setRunSessionClosesAt(challengeCard.session?.closesAt ?? null)
            // Cleared before the run is dealt rather than after, for the reason the
            // two lines above are set here: a value the next run reads has to be
            // right before that run exists.
            setWindowShut(false)
            // And remember the board they were on, so the intro is handed back the
            // way they left it rather than stuck on a challenge with no pill.
            if (isMode(mode)) setModeBeforeSession(mode)
            send({ type: 'SET_MODE', mode: modeId })
            send({ type: 'START', now: Date.now(), runId: newRunId() })
            setChallengeCard(undefined)
            track('run_started', { mode: modeId, difficulty, from: 'session' })
          }}
          onDismiss={() => {
            setChallengeCard(undefined)
          }}
        />
      )}
    </>
  )
}
