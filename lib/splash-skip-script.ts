import { LEFT_AT_KEY, RETURN_WINDOW_MS } from '@/lib/recent-return.web'
import { SKIP_SPLASH_CLASS, SPLASH_TEST_ID } from '@/lib/splash-skip'
import { UPDATE_RELOAD_KEY } from '@/lib/update-reload.web'

// The inline script and the rule it switches on, for app/+html.tsx — see lib/splash-skip.ts.
// Web-only by where it is used: nothing in the bundle imports this.
export const SKIP_SPLASH_CSS = `html.${SKIP_SPLASH_CLASS} [data-testid="${SPLASH_TEST_ID}"]{display:none!important}`

export const SKIP_SPLASH_SCRIPT = `
try {
  var skip = sessionStorage.getItem('${UPDATE_RELOAD_KEY}') !== null;
  if (!skip) {
    var left = Number(localStorage.getItem('${LEFT_AT_KEY}'));
    var since = Date.now() - left;
    skip = left > 0 && since >= 0 && since < ${RETURN_WINDOW_MS};
  }
  if (skip) document.documentElement.classList.add('${SKIP_SPLASH_CLASS}');
} catch (e) {}
`
