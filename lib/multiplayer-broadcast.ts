import { supabase } from '@/lib/supabase'
import type { MultiEvent } from '@/types/multiplayer'

export type GameChannel = ReturnType<typeof supabase.channel>

export function createGameChannel(roomId: string): GameChannel {
  return supabase.channel(`game:${roomId}`)
}

export function broadcastEvent(channel: GameChannel, event: MultiEvent): void {
  void channel.send({ type: 'broadcast', event: event.type, payload: event })
}
