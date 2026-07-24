export type MultiMode = 'accuracy' | 'speed'

export type RoomPlayer = {
  user_id: string
  nickname: string
  joined_at: string
}

export type Room = {
  id: string
  code: string
  admin_id: string
  mode: MultiMode
  status: 'waiting' | 'playing' | 'finished'
}

// Events broadcast on `game:{room_id}` channel.
export type MultiEvent =
  | { type: 'GAME_START'; mode: MultiMode; playerOrder: string[] }
  | { type: 'TARGET_SPAWN'; id: number; value: number; spawnedAt: number }
  | { type: 'PLAYER_HIT'; targetId: number; userId: string; accuracy: number }
  | { type: 'TARGET_RESOLVED'; targetId: number; scoreDelta: Record<string, number> }
  | { type: 'GAME_OVER'; finalScores: Record<string, number> }
  | { type: 'PLAYER_READY'; userId: string }
  | { type: 'MODE_CHANGE'; mode: MultiMode }
  | { type: 'GAME_RESTART'; mode: MultiMode; playerOrder: string[] }

export type PlayerState = {
  userId: string
  nickname: string
  score: number
  ready: boolean
  hitCurrentTarget: boolean
}

export type MultiTarget = {
  id: number
  value: number
  spawnedAt: number
}
