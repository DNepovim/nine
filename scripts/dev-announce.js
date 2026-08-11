// Paste into the browser console (pnpm web) to watch the announcement celebrations
// without having to actually beat a record.
//
//   Start a run first. The menu overlay paints over the whole screen, so an effect
//   fired from the menu is hidden behind it.
//
// The trigger is registered by hooks/use-announcements.ts and only exists in dev
// builds — `nineAnnounce` is undefined in production.
//
// Single announcement:  nineAnnounce('ever')
// Ids: 'record' (confetti) | 'today' (gold confetti) | 'week' (fireworks)
//      | 'ever' (hyperspace)
//
// The whole tour, one after another:

;(async () => {
  const ids = ['record', 'today', 'week', 'ever']
  // Announcements live for 5 s, so leave a beat between them.
  const gap = 6000

  if (typeof nineAnnounce !== 'function') {
    console.error(
      'nineAnnounce is not available. Is this a dev build, and has the game screen mounted?',
    )
    return
  }

  for (const id of ids) {
    console.log(`▶ ${id}`)
    nineAnnounce(id)
    await new Promise((resolve) => setTimeout(resolve, gap))
  }
  console.log('✔ done')
})()
