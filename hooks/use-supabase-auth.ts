import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

type AuthState = {
  userId: string | null
  nickname: string | null
  isReady: boolean
  updateNickname: (name: string) => Promise<{ error: string | null }>
}

export function useSupabaseAuth(): AuthState {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    void (async () => {
      // Reuse existing session or sign in anonymously.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      let uid = session?.user.id ?? null

      if (!uid) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error && data.user) uid = data.user.id
      }

      if (uid) {
        setUserId(uid)
        const { data } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', uid)
          .single()
        const nick = typeof data?.nickname === 'string' ? data.nickname : null
        setNickname(nick)
      }

      setIsReady(true)
    })()
  }, [])

  const updateNickname = async (name: string): Promise<{ error: string | null }> => {
    if (!userId) return { error: 'not_authenticated' }
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: name })
      .eq('id', userId)
    if (error) {
      if (error.code === '23505') return { error: 'already_taken' }
      return { error: error.message }
    }
    setNickname(name)
    return { error: null }
  }

  return { userId, nickname, isReady, updateNickname }
}
