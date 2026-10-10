#!/usr/bin/env node

// `supabase config push`, with the two checks that have to pass before it runs.
//
// The push sends the pushable half of supabase/config.toml to the linked project. Two
// values in it come from outside the file, and both fail silently rather than loudly:
//
//   - `pass = "env(RESEND_API_KEY)"` resolves to an empty string when the variable is
//     unset, and an empty SMTP password hands production back to Supabase's built-in
//     sender and its two-emails-an-hour cap. Nothing errors. The first anybody hears of
//     it is a player who cannot get a code.
//   - `admin_email` shipped as a placeholder until somebody filled in the verified address
//     on the Resend sending domain, which is not something the repo could know. A push
//     carrying the wrong sender takes every code email down with it, and the send still
//     looks like it worked. The check outlives the one it was written for: a second remote
//     block starts life as a copy of the first, placeholder and all.
//
// So this refuses rather than pushes, and says which value is missing. Everything else is
// the CLI's: it prints the diff and asks before applying, and that prompt is the point —
// the diff carries every pushable key in the file, not only the ones somebody just
// edited, so it is worth reading rather than confirming past.

const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')

const CONFIG = 'supabase/config.toml'
// What the placeholder sender says. Matched on the local part alone so that filling in a
// real address on any domain passes, and so that a second placeholder cannot be invented
// by changing the domain.
const PLACEHOLDER = 'unset@'
const KEY = 'RESEND_API_KEY'

const fail = (...lines) => {
  for (const line of lines) console.error(line)
  process.exit(1)
}

// The CLI reads `env()` from the process environment and from a `.env` at the project
// root. Both are checked here for the same reason: a developer with the key only in
// `.env` must not be told it is missing, and CI, which has it only in the environment,
// must not be told to go and write a file.
//
// Parsed rather than loaded — nothing here wants the value, only whether there is one —
// which is also why no part of it is ever printed.
const hasKey = () => {
  if ((process.env[KEY] ?? '').trim() !== '') return true
  if (!existsSync('.env')) return false
  return readFileSync('.env', 'utf8')
    .split('\n')
    .some((line) => {
      const match = new RegExp(`^\\s*(?:export\\s+)?${KEY}\\s*=\\s*(.*)$`).exec(line)
      if (match === null) return false
      // Quotes count as part of the shell's syntax rather than the value, so `KEY=""` is
      // as empty as no line at all.
      return (
        match[1]
          .trim()
          .replace(/^['"]|['"]$/g, '')
          .trim() !== ''
      )
    })
}

if (!existsSync(CONFIG)) {
  fail(`${CONFIG} not found — run this from the repo root.`)
}

if (readFileSync(CONFIG, 'utf8').includes(PLACEHOLDER)) {
  fail(
    `${CONFIG} still has the placeholder sender (${PLACEHOLDER}…).`,
    '',
    'Set `admin_email` under [remotes.production.auth.email.smtp] to the verified',
    'address on the Resend sending domain. A push with the wrong sender breaks every',
    'code email in production, and the send still reports success.',
  )
}

if (!hasKey()) {
  fail(
    `${KEY} is not set, in the environment or in .env.`,
    '',
    'The push would send an empty SMTP password, which drops production onto',
    "Supabase's built-in sender and its two-emails-an-hour cap. Copy the key from",
    'the Resend dashboard — see .env.example.',
  )
}

// Inherits stdio: the CLI's diff and its confirmation prompt are the whole of the
// interaction, and swallowing either would make this a script that pushes without asking.
try {
  execFileSync('npx', ['supabase', 'config', 'push'], { stdio: 'inherit' })
} catch {
  // The CLI has already said what went wrong on stderr. Repeating it here, with a stack
  // trace on top, would bury it.
  process.exit(1)
}
