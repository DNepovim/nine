import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createRoom as createRoomDb,
  fetchRoomPlayers,
  finishRoom,
  joinRoom as joinRoomDb,
  leaveRoom as leaveRoomDb,
  startRoomInDb,
  subscribeRoom,
} from '@/lib/multiplayer'
import {
  broadcastEvent,
  createGameChannel,
  type GameChannel,
} from '@/lib/multiplayer-broadcast'
import { supabase } from '@/lib/supabase'
import type { MultiMode, Room, RoomPlayer } from '@/types/multiplayer'

export type UseMultiplayerRoomResult = {
  room: Room | null
  players: RoomPlayer[]
  isAdmin: boolean
  error: string | null
  gameChannel: GameChannel | null
  create: (mode: MultiMode) => Promise<void>
  join: (code: string) => Promise<void>
  leave: () => Promise<void>
  startGame: (playerOrder: string[]) => void
  setRoomMode: (mode: MultiMode) => Promise<void>
  clearError: () => void
}

export function useMultiplayerRoom(userId: string | null): UseMultiplayerRoomResult {
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gameChannel, setGameChannel] = useState<GameChannel | null>(null)

  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const gameChannelRef = useRef<GameChannel | null>(null)
  const roomIdRef = useRef<string | null>(null)
  const isAdminRef = useRef(false)

  const refetchPlayers = useCallback(() => {
    const roomId = roomIdRef.current
    if (!roomId) return
    void fetchRoomPlayers(roomId).then(setPlayers)
  }, [])

  const handleRoomUpdate = useCallback((updated: Partial<Room>) => {
    // When admin destroys the room, auto-cleanup guest state.
    if (updated.status === 'finished' && !isAdminRef.current) {
      if (roomChannelRef.current) {
        void supabase.removeChannel(roomChannelRef.current)
        roomChannelRef.current = null
      }
      if (gameChannelRef.current) {
        void supabase.removeChannel(gameChannelRef.current)
        gameChannelRef.current = null
      }
      roomIdRef.current = null
      setRoom(null)
      setPlayers([])
      setIsAdmin(false)
      setGameChannel(null)
      return
    }
    setRoom((prev) => (prev ? { ...prev, ...updated } : null))
  }, [])

  const subscribe = useCallback(
    (roomId: string) => {
      if (roomChannelRef.current) {
        void supabase.removeChannel(roomChannelRef.current)
      }
      if (gameChannelRef.current) {
        void supabase.removeChannel(gameChannelRef.current)
      }

      roomIdRef.current = roomId
      void fetchRoomPlayers(roomId).then(setPlayers)

      const rc = subscribeRoom(roomId, refetchPlayers, handleRoomUpdate)
      roomChannelRef.current = rc

      const gc = createGameChannel(roomId)
      gc.subscribe()
      gameChannelRef.current = gc
      setGameChannel(gc)
    },
    [refetchPlayers, handleRoomUpdate],
  )

  const create = useCallback(
    async (mode: MultiMode) => {
      if (!userId) return
      setError(null)
      const result = await createRoomDb(mode)
      if ('error' in result) {
        setError(result.error)
        return
      }
      const newRoom: Room = {
        id: result.roomId,
        code: result.code,
        admin_id: userId,
        mode,
        status: 'waiting',
      }
      setRoom(newRoom)
      setIsAdmin(true)
      isAdminRef.current = true
      subscribe(result.roomId)
    },
    [userId, subscribe],
  )

  const join = useCallback(
    async (code: string) => {
      if (!userId) return
      setError(null)
      const result = await joinRoomDb(code)
      if ('error' in result) {
        setError(result.error)
        return
      }
      const admin = result.adminId === userId
      const newRoom: Room = {
        id: result.roomId,
        code,
        admin_id: result.adminId,
        mode: result.mode,
        status: 'waiting',
      }
      setRoom(newRoom)
      setIsAdmin(admin)
      isAdminRef.current = admin
      subscribe(result.roomId)
    },
    [userId, subscribe],
  )

  const leave = useCallback(async () => {
    const roomId = roomIdRef.current
    if (!roomId || !userId) return
    if (isAdminRef.current) {
      await finishRoom(roomId)
    } else {
      await leaveRoomDb(roomId, userId)
    }
    if (roomChannelRef.current) {
      void supabase.removeChannel(roomChannelRef.current)
      roomChannelRef.current = null
    }
    if (gameChannelRef.current) {
      void supabase.removeChannel(gameChannelRef.current)
      gameChannelRef.current = null
    }
    roomIdRef.current = null
    isAdminRef.current = false
    setRoom(null)
    setPlayers([])
    setIsAdmin(false)
    setGameChannel(null)
  }, [userId])

  const startGame = useCallback(
    (playerOrder: string[]) => {
      const roomId = roomIdRef.current
      const gc = gameChannelRef.current
      const mode = room?.mode ?? 'accuracy'
      if (!roomId || !gc) return
      void startRoomInDb(roomId)
      broadcastEvent(gc, { type: 'GAME_START', mode, playerOrder })
    },
    [room?.mode],
  )

  const setRoomMode = useCallback(async (newMode: MultiMode) => {
    const roomId = roomIdRef.current
    if (!roomId || !isAdminRef.current) return
    setRoom((prev) => (prev ? { ...prev, mode: newMode } : null))
    await supabase.from('rooms').update({ mode: newMode }).eq('id', roomId)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      if (roomChannelRef.current) void supabase.removeChannel(roomChannelRef.current)
      if (gameChannelRef.current) void supabase.removeChannel(gameChannelRef.current)
    }
  }, [])

  return {
    room,
    players,
    isAdmin,
    error,
    gameChannel,
    create,
    join,
    leave,
    startGame,
    setRoomMode,
    clearError,
  }
}
