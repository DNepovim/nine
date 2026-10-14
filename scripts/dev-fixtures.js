#!/usr/bin/env node

// Applies supabase/dev-fixtures.sql to the local stack.
//
// Separate from the seed on purpose — see the header of that file. The short version is
// that the SQL tests assert the shipped defaults, so the state a person wants to look at
// cannot live in the state the tests read.
//
// Safe to run at any time, and run for you by `pnpm db:reset` and at the end of
// `pnpm db:test`, which are the two things that wipe the stack.

const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')

const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FILE = 'supabase/dev-fixtures.sql'

if (!existsSync(FILE)) {
  console.error(`dev-fixtures: ${FILE} is missing`)
  process.exit(1)
}

try {
  execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-q', '-f', FILE], {
    stdio: 'inherit',
  })
} catch {
  // The overwhelmingly likely cause is a stack that is not up, which is not worth a
  // stack trace — `supabase start` is the whole fix.
  console.error('\ndev-fixtures: could not reach the local database.')
  console.error('Is the stack up? `pnpm db:start`')
  process.exit(1)
}
