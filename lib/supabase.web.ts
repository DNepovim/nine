import { createClient } from '@supabase/supabase-js'

import { env } from './env'

// On web, use localStorage instead of AsyncStorage. Guard every access so
// server-side rendering (where window is undefined) doesn't crash.
const webStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, value)
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(key)
  },
}

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: webStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
)
