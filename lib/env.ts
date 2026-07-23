import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

// Validates EXPO_PUBLIC_* env vars at module load time.
// During `expo export --platform web`, this runs in Node.js (SSG step) and
// throws if any required var is missing — failing the build before deployment.
export const env = createEnv({
  clientPrefix: 'EXPO_PUBLIC_',
  client: {
    EXPO_PUBLIC_SUPABASE_URL: z.url(),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  // Explicit mapping required — Metro statically replaces process.env.EXPO_PUBLIC_*
  // and doesn't support dynamic process.env access.
  runtimeEnvStrict: {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
})
