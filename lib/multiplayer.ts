import { supabase } from '@/lib/supabase'
import type { MultiMode, Room, RoomPlayer } from '@/types/multiplayer'

type CreateRoomRow = { room_id: string; code: string }
type JoinRoomRow = { out_room_id: string; out_admin_id: string; out_mode: string }

export async function createRoom(
  mode: MultiMode,
): Promise<{ roomId: string; code: string } | { error: string }> {
  const res = await supabase.rpc('create_room', { p_mode: mode })
  if (res.error) return { error: res.error.message }
  const row = (res.data as CreateRoomRow[] | null)?.[0]
  if (!row) return { error: 'no_data' }
  return { roomId: row.room_id, code: row.code }
}

export async function joinRoom(
  code: string,
): Promise<{ roomId: string; adminId: string; mode: MultiMode } | { error: string }> {
  const res = await supabase.rpc('join_room', { p_code: code })
  if (res.error) {
    const msg = res.error.message
    if (msg.includes('ROOM_NOT_FOUND')) return { error: 'ROOM NOT FOUND' }
    if (msg.includes('ROOM_FULL')) return { error: 'ROOM IS FULL' }
    return { error: msg }
  }
  const row = (res.data as JoinRoomRow[] | null)?.[0]
  if (!row) return { error: 'no_data' }
  return {
    roomId: row.out_room_id,
    adminId: row.out_admin_id,
    mode: row.out_mode as MultiMode,
  }
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  await supabase.from('room_players').delete().eq('room_id', roomId).eq('user_id', userId)
}

export async function finishRoom(roomId: string): Promise<void> {
  await supabase.rpc('finish_room', { p_room_id: roomId })
}

export async function startRoomInDb(roomId: string): Promise<void> {
  await supabase.rpc('start_room', { p_room_id: roomId })
}

export async function fetchRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  const { data } = await supabase
    .from('room_players')
    .select('user_id, joined_at, profiles(nickname)')
    .eq('room_id', roomId)
    .order('joined_at')

  if (!data) return []
  return data.map((row) => {
    const prof = row.profiles as unknown as { nickname: string | null } | null
    const uid = String(row.user_id)
    return {
      user_id: uid,
      nickname: prof?.nickname ?? uid.slice(0, 6),
      joined_at: String(row.joined_at),
    }
  })
}

export function subscribeRoom(
  roomId: string,
  onPlayersChange: () => void,
  onRoomUpdate: (room: Partial<Room>) => void,
) {
  return supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      },
      onPlayersChange,
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        onRoomUpdate(payload.new)
      },
    )
    .subscribe()
}
