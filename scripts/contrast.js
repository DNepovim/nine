#!/usr/bin/env node
// What a colour pair actually measures, so a contrast decision is a number rather than a
// look at a screenshot.
//
// The design-guide skill's accessibility pass is written against this — see
// `.claude/skills/design-guide/references/accessibility.md`. It exists because every
// contrast claim in `constants/colors.ts` is written as a ratio ("about 5.1:1 on
// surface"), and a claim nobody can re-run is a claim that goes stale the first time the
// token under it moves.
//
//   node scripts/contrast.js                      every app ink against every ground
//   node scripts/contrast.js '#4e4a43' '#f3efe9'  one pair
//
// WCAG 2.1 contrast, which is a ratio of relative luminances: 4.5:1 for ordinary text,
// 3:1 for large text (18.5px+, or 14px bold) and for the parts of an icon that carry
// meaning, 7:1 for AAA. This app's own floor is the 4.5 — including for the 9 and 10px
// labels, where the standard would technically allow nothing lower either.

const token = (hex) => {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
}

const luminance = (hex) => {
  const [r, g, b] = token(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The verdict in the words the guide uses, so the output says what to do rather than
// leaving the reader to compare two numbers.
const verdict = (ratio) => {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'large text / icons only'
  return 'FAILS'
}

// The grounds anything in this app is drawn on, and the inks drawn on them. Kept here
// rather than imported from `constants/colors.ts` — that file is TypeScript with `@/`
// imports behind it, and a check that needs a bundler to run is a check nobody runs.
// The cost is that these are a copy, so the table below is a list of claims to re-check
// rather than the source of truth. `pnpm check` does not run this; a person does.
const GROUNDS = {
  surface: '#f3efe9',
  card: '#e8e4dc',
  elevated: '#fdfcfa',
  strong: '#1c1928',
}

const INKS = {
  primary: '#1c1928',
  dim: '#4e4a43',
  muted: '#d4d0c8',
  score: '#147a32',
  fortune: '#a82a22',
  pie: '#171421',
  factor: '#9a96a8',
  'on-strong': '#d8d2f4',
  'gold-ink': '#6B4E00',
  'arcade-ink': '#9A4F06',
}

// Which pairs are meant to be read, so a pair nothing ever draws is not reported as a
// failure. `on-strong` is for the dark button and nothing else, and the dark button
// carries that ink and nothing else — the two exclusions are the same fact from either
// side. `muted` and `factor` are marks rather than text and are flagged as such.
const SKIP = new Set(['on-strong:surface', 'on-strong:card', 'on-strong:elevated'])
const ONLY_ON_STRONG = new Set(['on-strong', 'muted', 'factor'])
const NOT_TEXT = new Set(['muted', 'factor'])

const pad = (s, n) => String(s).padEnd(n)

const [, , a, b] = process.argv

if (a !== undefined && b !== undefined) {
  const ratio = contrast(a, b)
  console.log(`${a} on ${b}  ${ratio.toFixed(2)}:1  ${verdict(ratio)}`)
} else {
  console.log(
    `${pad('ink', 12)}${Object.keys(GROUNDS)
      .map((g) => pad(g, 14))
      .join('')}`,
  )
  for (const [inkName, ink] of Object.entries(INKS)) {
    const cells = Object.entries(GROUNDS).map(([groundName, ground]) => {
      if (SKIP.has(`${inkName}:${groundName}`)) return pad('—', 14)
      // Nothing but the button's own ink is ever drawn on the button.
      if (groundName === 'strong' && !ONLY_ON_STRONG.has(inkName)) return pad('—', 14)
      const ratio = contrast(ink, ground)
      const flag = ratio >= 4.5 ? ' ' : NOT_TEXT.has(inkName) ? '·' : '!'
      return pad(`${ratio.toFixed(2)}:1 ${flag}`, 14)
    })
    console.log(`${pad(inkName, 12)}${cells.join('')}`)
  }
  console.log('\n! below 4.5:1 and used as text    · not text (hairline, decoration)')
}
