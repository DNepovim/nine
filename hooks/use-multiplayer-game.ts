import { useCallback, useEffect, useRef, useState } from 'react'

import { MAX_TARGET } from '@/constants/game'
import { broadcastEvent, type GameChannel } from '@/lib/multiplayer-broadcast'
import type {
  MultiEvent,
  MultiMode,
  MultiTarget,
  PlayerState,
  RoomPlayer,
} from '@/types/multiplayer'

const SPEED_TIMEOUT = 7000
const ACCURACY_TIMEOUT = 10000
const NEXT_TARGET_DELAY_MS = 600

type MultiGamePhase = 'waiting' | 'playing' | 'results'

export type UseMultiplayerGameResult = {
  phase: MultiGamePhase
  mode: MultiMode
  players: PlayerState[]
  currentTarget: MultiTarget | null
  targetCount: number
  sendHit: (accuracy: number) => void
  sendReady: () => void
  sendModeChange: (mode: MultiMode) => void
  startNextGame: () => void
  applyGameStart: (mode: MultiMode, playerOrder: string[]) => void
}

export function useMultiplayerGame({
  gameChannel,
  userId,
  isAdmin,
  initialPlayers,
}: {
  gameChannel: GameChannel | null
  userId: string | null
  isAdmin: boolean
  initialPlayers: RoomPlayer[]
}): UseMultiplayerGameResult {
  const [phase, setPhase] = useState<MultiGamePhase>('waiting')
  const [mode, setMode] = useState<MultiMode>('accuracy')
  const [players, setPlayers] = useState<PlayerState[]>([])
  const [currentTarget, setCurrentTarget] = useState<MultiTarget | null>(null)
  const [targetCount, setTargetCount] = useState(0)

  // Mutable state refs — safe to read inside callbacks without stale closures.
  const modeRef = useRef<MultiMode>('accuracy')
  const playersRef = useRef<PlayerState[]>([])
  const currentTargetRef = useRef<MultiTarget | null>(null)
  const targetCountRef = useRef(0)
  const nextTargetIdRef = useRef(0)
  const hitCollectionRef = useRef<Record<string, number>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAdminRef = useRef(isAdmin)
  const userIdRef = useRef(userId)
  const channelRef = useRef<GameChannel | null>(null)
  const resolveRef = useRef<(targetId: number) => void>(() => {})

  // Keep refs in sync.
  useEffect(() => {
    isAdminRef.current = isAdmin
  }, [isAdmin])
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  // Sync initial player list into state when waiting room updates.
  useEffect(() => {
    if (phase !== 'waiting') return
    const states = initialPlayers.map((p) => ({
      userId: p.user_id,
      nickname: p.nickname,
      score: 0,
      ready: false,
      hitCurrentTarget: false,
    }))
    setPlayers(states)
    playersRef.current = states
  }, [initialPlayers, phase])

  // Helpers that update both state and ref atomically.
  const syncPlayers = useCallback((updater: (prev: PlayerState[]) => PlayerState[]) => {
    setPlayers((prev) => {
      const next = updater(prev)
      playersRef.current = next
      return next
    })
  }, [])

  const spawnNextTarget = useCallback(() => {
    const ch = channelRef.current
    if (!ch) return
    const id = nextTargetIdRef.current++
    const value = Math.floor(Math.random() * (MAX_TARGET + 1))
    const spawnedAt = Date.now()
    const target: MultiTarget = { id, value, spawnedAt }

    hitCollectionRef.current = {}
    setCurrentTarget(target)
    currentTargetRef.current = target
    syncPlayers((prev) => prev.map((p) => ({ ...p, hitCurrentTarget: false })))

    broadcastEvent(ch, { type: 'TARGET_SPAWN', id, value, spawnedAt })

    if (timerRef.current) clearTimeout(timerRef.current)
    const duration = modeRef.current === 'speed' ? SPEED_TIMEOUT : ACCURACY_TIMEOUT
    timerRef.current = setTimeout(() => {
      resolveRef.current(id)
    }, duration)
  }, [syncPlayers])

  const resolveCurrentTarget = useCallback(
    (targetId: number) => {
      const ch = channelRef.current
      if (!ch) return
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      const hits = hitCollectionRef.current
      const n = playersRef.current.length
      const scoreDelta: Record<string, number> = {}

      if (modeRef.current === 'speed') {
        const firstHitter = Object.keys(hits)[0]
        if (firstHitter) scoreDelta[firstHitter] = 1
      } else {
        const sorted = Object.entries(hits).sort((a, b) => b[1] - a[1])
        sorted.forEach(([uid], rank) => {
          scoreDelta[uid] = Math.max(0, n - 1 - rank)
        })
      }

      // Apply locally for admin.
      syncPlayers((prev) =>
        prev.map((p) => ({
          ...p,
          score: p.score + (scoreDelta[p.userId] ?? 0),
          hitCurrentTarget: false,
        })),
      )
      setCurrentTarget(null)
      currentTargetRef.current = null

      broadcastEvent(ch, { type: 'TARGET_RESOLVED', targetId, scoreDelta })

      hitCollectionRef.current = {}
      const newCount = targetCountRef.current + 1
      targetCountRef.current = newCount
      setTargetCount(newCount)

      if (newCount >= 10) {
        const finalScores = Object.fromEntries(
          playersRef.current.map((p) => [p.userId, p.score]),
        )
        broadcastEvent(ch, { type: 'GAME_OVER', finalScores })
        setPhase('results')
      } else {
        timerRef.current = setTimeout(() => {
          spawnNextTarget()
        }, NEXT_TARGET_DELAY_MS)
      }
    },
    [syncPlayers, spawnNextTarget],
  )

  // Keep resolveRef up-to-date so the setTimeout callback is never stale.
  useEffect(() => {
    resolveRef.current = resolveCurrentTarget
  }, [resolveCurrentTarget])

  // Process a broadcast event (called for events received from others).
  const applyEvent = useCallback(
    (event: MultiEvent) => {
      switch (event.type) {
        case 'GAME_START': {
          modeRef.current = event.mode
          setMode(event.mode)
          targetCountRef.current = 0
          nextTargetIdRef.current = 0
          setTargetCount(0)
          hitCollectionRef.current = {}
          syncPlayers((prev) => {
            const byId = Object.fromEntries(prev.map((p) => [p.userId, p]))
            return event.playerOrder.map(
              (uid) =>
                byId[uid] ?? {
                  userId: uid,
                  nickname: uid.slice(0, 6),
                  score: 0,
                  ready: false,
                  hitCurrentTarget: false,
                },
            )
          })
          setPhase('playing')
          if (isAdminRef.current) spawnNextTarget()
          break
        }
        case 'TARGET_SPAWN': {
          const t: MultiTarget = {
            id: event.id,
            value: event.value,
            spawnedAt: event.spawnedAt,
          }
          setCurrentTarget(t)
          currentTargetRef.current = t
          hitCollectionRef.current = {}
          syncPlayers((prev) => prev.map((p) => ({ ...p, hitCurrentTarget: false })))
          // Non-admin: visual countdown only; resolution driven by broadcasts.
          break
        }
        case 'PLAYER_HIT': {
          syncPlayers((prev) =>
            prev.map((p) =>
              p.userId === event.userId ? { ...p, hitCurrentTarget: true } : p,
            ),
          )
          if (isAdminRef.current) {
            hitCollectionRef.current[event.userId] = event.accuracy
            const n = playersRef.current.length
            const hitCount = Object.keys(hitCollectionRef.current).length
            const isFirstHit = hitCount === 1
            const allHit = hitCount >= n
            const resolveId = currentTargetRef.current?.id ?? event.targetId
            if (
              (modeRef.current === 'speed' && isFirstHit) ||
              (modeRef.current === 'accuracy' && allHit)
            ) {
              resolveRef.current(resolveId)
            }
          }
          break
        }
        case 'TARGET_RESOLVED': {
          syncPlayers((prev) =>
            prev.map((p) => ({
              ...p,
              score: p.score + (event.scoreDelta[p.userId] ?? 0),
              hitCurrentTarget: false,
            })),
          )
          setCurrentTarget(null)
          currentTargetRef.current = null
          const newCount = targetCountRef.current + 1
          targetCountRef.current = newCount
          setTargetCount(newCount)
          break
        }
        case 'GAME_OVER': {
          syncPlayers((prev) =>
            prev.map((p) => ({ ...p, score: event.finalScores[p.userId] ?? p.score })),
          )
          setCurrentTarget(null)
          currentTargetRef.current = null
          setPhase('results')
          break
        }
        case 'PLAYER_READY': {
          syncPlayers((prev) =>
            prev.map((p) => (p.userId === event.userId ? { ...p, ready: true } : p)),
          )
          break
        }
        case 'MODE_CHANGE': {
          modeRef.current = event.mode
          setMode(event.mode)
          break
        }
        case 'GAME_RESTART': {
          modeRef.current = event.mode
          setMode(event.mode)
          targetCountRef.current = 0
          nextTargetIdRef.current = 0
          setTargetCount(0)
          hitCollectionRef.current = {}
          syncPlayers((prev) => {
            const byId = Object.fromEntries(prev.map((p) => [p.userId, p]))
            return event.playerOrder.map((uid) => ({
              ...(byId[uid] ?? { userId: uid, nickname: uid.slice(0, 6) }),
              score: 0,
              ready: false,
              hitCurrentTarget: false,
            }))
          })
          setPhase('playing')
          if (isAdminRef.current) spawnNextTarget()
          break
        }
      }
    },
    [syncPlayers, spawnNextTarget],
  )

  // Keep applyEvent ref up-to-date.
  const applyEventRef = useRef(applyEvent)
  useEffect(() => {
    applyEventRef.current = applyEvent
  }, [applyEvent])

  // Reset all game state when channel goes away (room left).
  useEffect(() => {
    channelRef.current = gameChannel
    if (gameChannel) return
    setPhase('waiting')
    setPlayers([])
    playersRef.current = []
    setCurrentTarget(null)
    currentTargetRef.current = null
    setTargetCount(0)
    targetCountRef.current = 0
    hitCollectionRef.current = {}
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [gameChannel])

  // Subscribe to broadcast channel.
  useEffect(() => {
    if (!gameChannel) return

    gameChannel.on(
      'broadcast',
      { event: '*' },
      ({
        event: evtType,
        payload,
      }: {
        event: string
        payload: Record<string, unknown>
      }) => {
        // Skip events the admin already applied locally (self:false is default).
        const adminSentTypes = [
          'TARGET_SPAWN',
          'TARGET_RESOLVED',
          'GAME_OVER',
          'GAME_RESTART',
        ]
        if (isAdminRef.current && adminSentTypes.includes(evtType)) return
        applyEventRef.current({ ...payload, type: evtType } as MultiEvent)
      },
    )
  }, [gameChannel])

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const sendHit = useCallback(
    (accuracy: number) => {
      const ch = channelRef.current
      const target = currentTargetRef.current
      const uid = userIdRef.current
      if (!ch || !target || !uid) return

      // Update own state immediately.
      syncPlayers((prev) =>
        prev.map((p) => (p.userId === uid ? { ...p, hitCurrentTarget: true } : p)),
      )
      broadcastEvent(ch, {
        type: 'PLAYER_HIT',
        targetId: target.id,
        userId: uid,
        accuracy,
      })
      // Admin processes own hit inline.
      if (isAdminRef.current) {
        hitCollectionRef.current[uid] = accuracy
        const n = playersRef.current.length
        const hitCount = Object.keys(hitCollectionRef.current).length
        if (
          (modeRef.current === 'speed' && hitCount === 1) ||
          (modeRef.current === 'accuracy' && hitCount >= n)
        ) {
          resolveRef.current(target.id)
        }
      }
    },
    [syncPlayers],
  )

  const sendReady = useCallback(() => {
    const ch = channelRef.current
    const uid = userIdRef.current
    if (!ch || !uid) return
    syncPlayers((prev) => prev.map((p) => (p.userId === uid ? { ...p, ready: true } : p)))
    broadcastEvent(ch, { type: 'PLAYER_READY', userId: uid })
  }, [syncPlayers])

  const sendModeChange = useCallback((newMode: MultiMode) => {
    const ch = channelRef.current
    if (!ch) return
    modeRef.current = newMode
    setMode(newMode)
    broadcastEvent(ch, { type: 'MODE_CHANGE', mode: newMode })
  }, [])

  const startNextGame = useCallback(() => {
    const ch = channelRef.current
    if (!ch) return
    const playerOrder = playersRef.current.map((p) => p.userId)
    const evt: MultiEvent = { type: 'GAME_RESTART', mode: modeRef.current, playerOrder }
    applyEventRef.current(evt)
    broadcastEvent(ch, evt)
  }, [])

  // Called by admin directly (no self-echo with self:false default).
  const applyGameStart = useCallback(
    (newMode: MultiMode, playerOrder: string[]) => {
      applyEvent({ type: 'GAME_START', mode: newMode, playerOrder })
    },
    [applyEvent],
  )

  return {
    phase,
    mode,
    players,
    currentTarget,
    targetCount,
    sendHit,
    sendReady,
    sendModeChange,
    startNextGame,
    applyGameStart,
  }
}
