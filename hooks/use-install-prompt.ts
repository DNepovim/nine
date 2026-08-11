import type { InstallTarget } from '@/types/install'

// Native builds are the installed app — there is nothing to offer. The web
// implementation lives in use-install-prompt.web.ts; this variant exists so the
// native bundle never reaches for a DOM API.
export function useInstallPrompt(): {
  target: InstallTarget
  install: () => void
  dismiss: () => void
} {
  return { target: 'none', install: () => {}, dismiss: () => {} }
}
