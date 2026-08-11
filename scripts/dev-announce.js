// Paste into the browser console (pnpm web) to watch the announcements without having
// to beat a record or wait for a rival to take one.
//
//   Start a run first. The menu overlay paints over the whole screen, so an effect
//   fired from the menu is hidden behind it.
//
// The trigger is registered by hooks/use-announcements.ts and only exists in dev
// builds — `nineAnnounce` is undefined in production.
//
//   nineAnnounce('ever')              // your own all-time record
//   nineAnnounce('everLost', 'BOLT')  // BOLT took it off you
//   nineAnnounceIds                   // every id, in order
//
// Your own records: 'record' (confetti) | 'today' (gold confetti)
//                   'week' (fireworks)  | 'ever' (hyperspace)
// A rival raised a board record, no effect: 'todayRaised' | 'weekRaised' | 'everRaised'
// A rival took one off you, implosion:      'todayLost'   | 'weekLost'   | 'everLost'
//
// The whole tour, one after another:

;(async () => {
  if (typeof nineAnnounce !== 'function') {
    console.error(
      'nineAnnounce is not available. Is this a dev build, and has the game screen mounted?',
    )
    return
  }

  // Fall back to a hard-coded list if an older build has no nineAnnounceIds.
  const ids =
    typeof nineAnnounceIds === 'undefined'
      ? ['record', 'today', 'week', 'ever']
      : nineAnnounceIds

  // Rotate a few names so the truncation and the fallback both get seen.
  const names = ['BOLT', 'ACE', 'A-VERY-LONG-NICKNAME', 'CIRA']
  // Announcements live for 5 s, so leave a beat between them.
  const gap = 6000

  for (const [i, id] of ids.entries()) {
    const name = names[i % names.length]
    console.log(`▶ ${id}${id === id.toLowerCase() ? '' : ` — ${name}`}`)
    nineAnnounce(id, name)
    await new Promise((resolve) => setTimeout(resolve, gap))
  }
  console.log('✔ done')
})()
