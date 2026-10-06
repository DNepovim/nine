#!/usr/bin/env node

// Runs every assertion file in supabase/tests/ against the local Supabase stack.
//
// Not part of `pnpm check`: it needs Docker and a running `supabase start`, and a gate
// that cannot run on a laptop without one is a gate people learn to skip. It is still
// the only automated test the resolve has — the rules live in SQL on purpose, and
// mirroring them in TypeScript to reach Vitest would create the second copy the design
// exists to avoid.

const { execFileSync } = require('node:child_process')
const { readdirSync } = require('node:fs')
const { join } = require('node:path')

const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIR = 'supabase/tests'

execFileSync('pnpm', ['exec', 'supabase', 'db', 'reset'], { stdio: 'inherit' })

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()

for (const name of files) {
  console.log(`\n── ${name} ──`)
  execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-f', join(DIR, name)], {
    stdio: 'inherit',
  })
}

console.log(`\n${files.length} SQL test file(s) passed.`)
