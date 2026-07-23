#!/usr/bin/env node

// Validates that all required env vars are present.
// Runs in the CI check job (where EAS secrets are injected) to fail the
// pipeline before the expensive build step rather than mid-build.

const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']

const missing = REQUIRED.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error('Missing required environment variables:')
  for (const key of missing) {
    console.error(`  ${key}`)
  }
  process.exit(1)
}

console.log('All required environment variables are set.')
