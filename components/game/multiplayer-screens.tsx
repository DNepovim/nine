import { MultiplayerGame } from '@/components/game/multiplayer-game'
import { MultiplayerGameOver } from '@/components/overlays/multiplayer-game-over'
import { MultiplayerMenu } from '@/components/overlays/multiplayer-menu'
import { MultiplayerWaiting } from '@/components/overlays/multiplayer-waiting'
import type { ScreenIntro } from '@/hooks/use-intro-standing'
import type { ScreenAccount } from '@/hooks/use-player-account'
import type { ScreenControl } from '@/hooks/use-run-control'

// A shared run's screens, over everything: the waiting room, the game, its pause and its
// results.
export function MultiplayerScreens({
  control,
  account,
  intro,
}: {
  control: ScreenControl
  account: ScreenAccount
  intro: ScreenIntro
}) {
  const { drag } = control
  const { userId } = account
  const {
    handleAdminStartGame,
    multiGame,
    multiRoom,
    setMenuInitialTab,
    setShowMultiMenu,
    showMultiGame,
    showMultiMenu,
    showMultiResults,
    showMultiWaiting,
  } = intro
  return (
    <>
      {/* ── Multiplayer screens (above everything) ── */}

      {showMultiWaiting && multiRoom.room && (
        <MultiplayerWaiting
          code={multiRoom.room.code}
          mode={multiRoom.room.mode}
          players={multiRoom.players}
          userId={userId}
          isAdmin={multiRoom.isAdmin}
          onLeave={() => {
            setMenuInitialTab('friends')
            void multiRoom.leave()
          }}
          onStart={handleAdminStartGame}
          onSetMode={(m) => {
            void multiRoom.setRoomMode(m)
          }}
        />
      )}

      {showMultiGame && (
        <MultiplayerGame
          drag={drag}
          mode={multiGame.mode}
          userId={userId}
          players={multiGame.players}
          currentTarget={multiGame.currentTarget}
          targetCount={multiGame.targetCount}
          onHit={multiGame.sendHit}
          onTargetExpire={() => {
            // Only admin resolves; non-admin's timer is purely visual.
          }}
          onMenu={() => {
            setShowMultiMenu(true)
          }}
        />
      )}

      {showMultiGame && showMultiMenu && (
        <MultiplayerMenu
          mode={multiGame.mode}
          onContinue={() => {
            setShowMultiMenu(false)
          }}
          onLeave={() => {
            setMenuInitialTab('friends')
            setShowMultiMenu(false)
            void multiRoom.leave()
          }}
        />
      )}

      {showMultiResults && (
        <MultiplayerGameOver
          players={multiGame.players}
          mode={multiGame.mode}
          userId={userId}
          isAdmin={multiRoom.isAdmin}
          onReady={multiGame.sendReady}
          onModeChange={multiGame.sendModeChange}
          onStartNext={multiGame.startNextGame}
          onLeave={() => {
            setMenuInitialTab('friends')
            void multiRoom.leave()
          }}
        />
      )}
    </>
  )
}
