import { useSyncExternalStore } from 'react'

const KEY = 'atelier-show-done'

/**
 * Shared "show completed work" view preference: the project board and the day
 * timeline read the same flag so one toggle hides done work everywhere.
 * Per-device (localStorage), like zoom and pane width.
 */
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

let value = read()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function setShowCompleted(next: boolean) {
  if (next === value) return
  value = next
  try {
    localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    /* per-device preference only */
  }
  for (const fn of listeners) fn()
}

export function useShowCompleted(): [boolean, (next: boolean) => void] {
  const show = useSyncExternalStore(
    subscribe,
    () => value,
    () => true,
  )
  return [show, setShowCompleted]
}
