import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { PlanFields, ScheduleBlock, Task } from '../../lib/types'
import { fromDateStr, todayStr } from '../../lib/time'
import { BottomSheet } from './BottomSheet'
import { SchedulePicker } from '../pickers/SchedulePicker'

interface Props {
  task: Task
  onClose: () => void
  /** receives the task's FULL schedule; the caller replaces the old one */
  onSave: (plan: PlanFields) => void
}

/**
 * The single place to manage a task's schedule. Always opens showing the
 * current schedule (days, start, duration); saving replaces it entirely.
 * Clearing every day and saving unschedules the task.
 */
export function PlanScheduleSheet({ task, onClose, onSave }: Props) {
  const { data: existing } = useQuery({
    queryKey: ['taskBlocks', task.id],
    queryFn: async (): Promise<ScheduleBlock[]> => {
      const { data, error } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('task_id', task.id)
        .order('day')
      if (error) throw new Error(error.message)
      return (data ?? []) as ScheduleBlock[]
    },
  })

  const [loaded, setLoaded] = useState(false)
  const [days, setDays] = useState<Set<string>>(() => new Set())
  const [auto, setAuto] = useState(true)
  const [startMin, setStartMin] = useState(540)
  const [duration, setDuration] = useState(task.estimate_min ?? 60)
  const [hadSchedule, setHadSchedule] = useState(false)

  useEffect(() => {
    if (loaded || existing === undefined) return
    if (existing.length > 0) {
      setDays(new Set(existing.map((b) => b.day)))
      setStartMin(existing[0].start_min)
      setDuration(existing[0].duration_min)
      setHadSchedule(true)
      setAuto(false) // keep the times the user already has unless they opt in
    } else {
      setDays(new Set([todayStr()]))
    }
    setLoaded(true)
  }, [existing, loaded])

  const toggleDay = (d: string) => {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const save = () => {
    onSave({ days: [...days].sort(), auto, start_min: startMin, duration_min: duration })
    onClose()
  }

  const firstDay = [...days].sort()[0]

  return (
    <BottomSheet
      title={hadSchedule ? `Schedule of “${task.title}”` : `Plan “${task.title}”`}
      onClose={onClose}
    >
      {!loaded ? (
        <div className="skeleton" />
      ) : (
        <>
          <SchedulePicker
            days={days}
            auto={auto}
            startMin={startMin}
            duration={duration}
            estimateMin={task.estimate_min}
            onToggleDay={toggleDay}
            onAuto={setAuto}
            onStart={setStartMin}
            onDuration={setDuration}
            disablePast={!hadSchedule}
            initialAnchor={firstDay ? fromDateStr(firstDay) : undefined}
          />
          {hadSchedule && (
            <p className="sheet__hint">
              {days.size === 0
                ? 'Saving will remove this task from the calendar.'
                : 'Saving replaces the current schedule.'}
            </p>
          )}
          <div className="sheet-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className={`btn ${days.size === 0 && hadSchedule ? 'btn--danger' : 'btn--primary'}`}
              disabled={days.size === 0 && !hadSchedule}
              onClick={save}
            >
              {days.size === 0 ? 'Unschedule' : hadSchedule ? 'Save' : 'Plan'}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}
