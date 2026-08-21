import { useState } from 'react'
import { addWeeks, format, isBefore, startOfDay } from 'date-fns'
import type { Task } from '../../lib/types'
import type { PlanInput } from '../../hooks/useMutations'
import { durationLabel, toDateStr, todayStr, weekDays } from '../../lib/time'
import { BottomSheet } from './BottomSheet'
import { TimeStepper } from '../pickers/TimeStepper'
import { EstimatePicker } from '../pickers/EstimatePicker'
import { Icon } from '../Icon'

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
  const [anchor, setAnchor] = useState(() => new Date())
  const [days, setDays] = useState<Set<string>>(() => new Set([todayStr()]))
  const [startMin, setStartMin] = useState(540)
  const [duration, setDuration] = useState<number | null>(task.estimate_min ?? 60)

  const week = weekDays(anchor)
  const today = startOfDay(new Date())

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
      <div className="mini-week__nav">
        <button
          className="icon-btn"
          aria-label="Previous week"
          onClick={() => setAnchor((a) => addWeeks(a, -1))}
        >
          <Icon name="chevronLeft" />
        </button>
        <span className="mini-week__label">{format(week[0], 'MMMM yyyy')}</span>
        <button
          className="icon-btn"
          aria-label="Next week"
          onClick={() => setAnchor((a) => addWeeks(a, 1))}
        >
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="mini-week">
        {week.map((d) => {
          const s = toDateStr(d)
          const past = isBefore(d, today)
          return (
            <button
              key={s}
              type="button"
              disabled={past}
              className={`mini-week__day${days.has(s) ? ' mini-week__day--on' : ''}`}
              onClick={() => toggleDay(s)}
            >
              <span className="mini-week__dow">{format(d, 'EEEEE')}</span>
              <span className="mini-week__num">{format(d, 'd')}</span>
            </button>
          )
        })}
      </div>
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
