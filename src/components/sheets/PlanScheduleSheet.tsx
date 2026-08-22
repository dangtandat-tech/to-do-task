import { useState } from 'react'
import type { Task } from '../../lib/types'
import type { PlanInput } from '../../hooks/useMutations'
import { durationLabel, todayStr } from '../../lib/time'
import { BottomSheet } from './BottomSheet'
import { MiniWeekPicker } from '../pickers/MiniWeekPicker'
import { TimeStepper } from '../pickers/TimeStepper'
import { EstimatePicker } from '../pickers/EstimatePicker'

interface Props {
  task: Task
  onClose: () => void
  onSave: (input: PlanInput) => void
}

/**
 * Pick one or more days + a start time + a per-day duration.
 * A multi-day selection becomes one plan (N blocks, one plan_group_id).
 */
export function PlanScheduleSheet({ task, onClose, onSave }: Props) {
  const [days, setDays] = useState<Set<string>>(() => new Set([todayStr()]))
  const [startMin, setStartMin] = useState(540)
  const [duration, setDuration] = useState<number | null>(task.estimate_min ?? 60)

  const toggleDay = (d: string) => {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const save = () => {
    if (days.size === 0 || !duration) return
    onSave({
      task_id: task.id,
      days: [...days].sort(),
      start_min: startMin,
      duration_min: duration,
    })
    onClose()
  }

  return (
    <BottomSheet title={`Plan “${task.title}”`} onClose={onClose}>
      <MiniWeekPicker selected={days} onToggle={toggleDay} />
      {days.size > 1 && (
        <p className="sheet__hint">
          One plan across {days.size} days — {durationLabel((duration ?? 0) * days.size)} in
          total.
        </p>
      )}

      <span className="field__label">Start time</span>
      <TimeStepper value={startMin} onChange={setStartMin} />

      <span className="field__label">{days.size > 1 ? 'Duration per day' : 'Duration'}</span>
      <EstimatePicker value={duration} onChange={setDuration} allowNone={false} />

      <div className="sheet-actions">
        <button className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          disabled={days.size === 0 || !duration}
          onClick={save}
        >
          Plan
        </button>
      </div>
    </BottomSheet>
  )
}
