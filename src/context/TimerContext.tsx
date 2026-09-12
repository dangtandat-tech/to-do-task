import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Task } from '../lib/types'

const STORAGE_KEY = 'atelier-timer'

export interface TimerSession {
  taskId: string
  startedAt: number
}

interface TimerApi {
  session: TimerSession | null
  /** starts timing a task; a running session is logged first */
  start: (taskId: string) => void
  /** logs elapsed minutes onto the task; optionally marks it done */
  stop: (opts?: { complete?: boolean }) => Promise<void>
  /** drops the session without logging any time */
  discard: () => void
}

const TimerContext = createContext<TimerApi>({
  session: null,
  start: () => {},
  stop: async () => {},
  discard: () => {},
})

function load(): TimerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TimerSession) : null
  } catch {
    return null
  }
}

function persist(s: TimerSession | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable — timer just won't survive reloads */
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<TimerSession | null>(load)

  const log = useCallback(
    async (s: TimerSession, complete: boolean) => {
      const minutes = Math.max(1, Math.round((Date.now() - s.startedAt) / 60_000))
      const tasks = qc.getQueryData<Task[]>(['tasks'])
      const current = tasks?.find((t) => t.id === s.taskId)
      const patch: Record<string, unknown> = {
        spent_min: (current?.spent_min ?? 0) + minutes,
      }
      if (complete) patch.completed_at = new Date().toISOString()
      await supabase.from('tasks').update(patch).eq('id', s.taskId)
      if (complete) {
        // finishing from the timer finishes the task outright, planned days included
        await supabase
          .from('schedule_blocks')
          .update({ completed_at: patch.completed_at })
          .eq('task_id', s.taskId)
      }
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['blocks'] })
      qc.invalidateQueries({ queryKey: ['taskBlocks'] })
    },
    [qc],
  )

  const start = useCallback(
    (taskId: string) => {
      setSession((prev) => {
        if (prev && prev.taskId !== taskId) void log(prev, false)
        const next = { taskId, startedAt: Date.now() }
        persist(next)
        return next
      })
    },
    [log],
  )

  const stop = useCallback(
    async (opts?: { complete?: boolean }) => {
      if (!session) return
      persist(null)
      setSession(null)
      await log(session, opts?.complete ?? false)
    },
    [session, log],
  )

  const discard = useCallback(() => {
    persist(null)
    setSession(null)
  }, [])

  return (
    <TimerContext.Provider value={{ session, start, stop, discard }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  return useContext(TimerContext)
}
