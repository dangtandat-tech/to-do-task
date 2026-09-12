/**
 * Failed writes used to vanish: the mutation threw, React Query swallowed it,
 * and the UI simply did nothing — indistinguishable from a dead button.
 * Everything that throws lands here so the app can say what went wrong.
 */
const listeners = new Set<() => void>()
let current: string | null = null

function emit() {
  for (const fn of listeners) fn()
}

export function reportError(err: unknown) {
  current = err instanceof Error ? err.message : String(err)
  emit()
}

export function clearError() {
  current = null
  emit()
}

export function subscribeErrors(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getError(): string | null {
  return current
}
