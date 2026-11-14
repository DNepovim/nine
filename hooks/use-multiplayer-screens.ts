import { isNotNull } from 'narrowland'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { useMultiplayerGame } from '@/hooks/use-multiplayer-game'
import { useMultiplayerRoom } from '@/hooks/use-multiplayer-room'
import { track } from '@/lib/analytics'
import { multiScreenOf } from '@/lib/multi-screen'
import type { MultiMode } from '@/types/multiplayer'

// The game screen's side of a shared run: the room and the game in it, the create and join
// a missing nickname holds back, the host's start, leaving when the host's app goes away,
// which of the room's screens is up, and the one event a finished run is.
export function useMultiplayerScreens({
  userId,
  nickname,
  askNickname,
  recordMultiplayer,
}: {
  userId: string | null
  nickname: string | null
  // Opens the nickname card, which a room needs before anyone can be named in it.
  askNickname: () => void
  // The achievements' tally of shared runs — see `useAchievements`.
  recordMultiplayer: (won: boolean, players: number) => void
}) {
  const multiRoom = useMultiplayerRoom(userId)
  const multiGame = useMultiplayerGame({
    gameChannel: multiRoom.gameChannel,
    userId,
    isAdmin: multiRoom.isAdmin,
    initialPlayers: multiRoom.players,
  })

  // Pending action when user tries to create/join without a nickname.
  const [pendingMultiAction, setPendingMultiAction] = useState<
    { type: 'create'; mode: MultiMode } | { type: 'join'; code: string } | null
  >(null)

  const executeMultiAction = useCallback(
    (action: { type: 'create'; mode: MultiMode } | { type: 'join'; code: string }) => {
      if (action.type === 'create') {
        void multiRoom.create('accuracy')
      } else {
        void multiRoom.join(action.code)
      }
    },
    [multiRoom],
  )

  const handleCreateRoom = useCallback(() => {
    if (!nickname) {
      setPendingMultiAction({ type: 'create', mode: 'accuracy' })
      askNickname()
      return
    }
    void multiRoom.create('accuracy')
  }, [nickname, multiRoom, askNickname])

  const handleJoinRoom = useCallback(
    (code: string) => {
      if (!nickname) {
        setPendingMultiAction({ type: 'join', code })
        askNickname()
        return
      }
      void multiRoom.join(code)
    },
    [nickname, multiRoom, askNickname],
  )

  const handleAdminStartGame = useCallback(() => {
    const playerOrder = multiRoom.players.map((p) => p.user_id)
    const roomMode = multiRoom.room?.mode ?? 'accuracy'
    multiRoom.startGame(playerOrder)
    multiGame.applyGameStart(roomMode, playerOrder)
  }, [multiRoom, multiGame])

  // Destroy room when admin backgrounds the app.
  const multiLeaveRef = useRef(multiRoom.leave)
  useEffect(() => {
    multiLeaveRef.current = multiRoom.leave
  }, [multiRoom.leave])
  const multiRoomId = multiRoom.room?.id ?? null
  useEffect(() => {
    if (!multiRoom.isAdmin || !multiRoomId) return
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') void multiLeaveRef.current()
    })
    return () => {
      sub.remove()
    }
  }, [multiRoom.isAdmin, multiRoomId])

  // Which multiplayer screen to show.
  const {
    waiting: showMultiWaiting,
    playing: showMultiGame,
    results: showMultiResults,
    active: isMultiActive,
  } = multiScreenOf(isNotNull(multiRoom.room), multiGame.phase)

  // A shared run reaching its results screen is the run finishing, and the roster at
  // that moment is who was in it. Edge-latched: the screen stays up while everyone
  // reads it, and one run is one event.
  const multiFinishedRef = useRef(false)
  useEffect(() => {
    if (showMultiResults && !multiFinishedRef.current) {
      const players = multiRoom.players.length
      track('multiplayer_room', { action: 'finished', players })
      // A room has no board of its own, sets no personal best and keeps no stats, so all
      // a shared run contributes is that it happened, how it went and how full the room
      // was. Won outright: a tie is shared, and there is nothing to be proud of in
      // beating nobody, so a room of one never counts.
      const best = Math.max(...multiGame.players.map((player) => player.score), 0)
      const mine = multiGame.players.find((player) => player.userId === userId)
      const won =
        players > 1 &&
        mine?.score === best &&
        multiGame.players.filter((player) => player.score === best).length === 1
      recordMultiplayer(won, players)
    }
    multiFinishedRef.current = showMultiResults
  }, [
    showMultiResults,
    multiRoom.players.length,
    multiGame.players,
    userId,
    recordMultiplayer,
  ])

  return {
    multiRoom,
    multiGame,
    pendingMultiAction,
    setPendingMultiAction,
    executeMultiAction,
    handleCreateRoom,
    handleJoinRoom,
    handleAdminStartGame,
    showMultiWaiting,
    showMultiGame,
    showMultiResults,
    isMultiActive,
  }
}
