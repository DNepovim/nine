#!/usr/bin/env node

// Runs every assertion file in supabase/tests/ against the local Supabase stack.
//
// Not part of `pnpm check`: it needs Docker and a running `supabase start`, and a gate
// that cannot run on a laptop without one is a gate people learn to skip. It is still
// the only automated test the resolve has — the rules live in SQL on purpose, and
// mirroring them in TypeScript to reach Vitest would create the second copy the design
// exists to avoid.
//
// It opens with `supabase db reset`, which wipes the stack — the tests assert the shipped
// defaults and so have to read a database nobody has touched. That used to cost the
// operator their admin role, their feature switches and whatever session they had
// planned, every time they ran the suite. The fixtures are put back at the end; see
// supabase/dev-fixtures.sql for why they cannot simply live in the seed.

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

// Put the local fixtures back. After the tests, so they never read a stack that has had
// features switched on under them — and outside the loop above, so a failing assertion
// leaves the database exactly as it failed for inspection rather than being tidied up.
console.log('\n── restoring dev fixtures ──')
execFileSync('node', ['scripts/dev-fixtures.js'], { stdio: 'inherit' })
