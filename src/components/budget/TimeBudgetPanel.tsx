import { useState } from 'react'
import { useTimeBudget } from '../../hooks/useDerived'
import { QUADRANT_COLOR, QUADRANT_LABEL } from '../../lib/quadrant'
import { durationLabel } from '../../lib/time'
import type { ScheduleBlock, Task } from '../../lib/types'
import { Icon } from '../Icon'

interface Props {
  selectedDay: string
  weekDayStrs: string[]
  blocks: ScheduleBlock[] | undefined
  tasks: Task[] | undefined
  dayCapacityMin: number
}

export function TimeBudgetPanel({
  selectedDay,
  weekDayStrs,
  blocks,
  tasks,
  dayCapacityMin,
}: Props) {
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const days = mode === 'day' ? [selectedDay] : weekDayStrs
  const budget = useTimeBudget(days, blocks, tasks, dayCapacityMin)
  const over = budget.overBy > 0

  return (
    <section className={`budget${over ? ' budget--over' : ''}`}>
      <header className="budget__header">
        <h3 className="budget__title">
          {over && <Icon name="warning" size={15} />} Time budget
        </h3>
        <span className="budget__toggle">
          <button
            className={`chip${mode === 'day' ? ' chip--on' : ''}`}
            onClick={() => setMode('day')}
          >
            Day
          </button>
          <button
            className={`chip${mode === 'week' ? ' chip--on' : ''}`}
            onClick={() => setMode('week')}
          >
            Week
          </button>
        </span>
      </header>

      <p className="budget__summary">
        {durationLabel(budget.totalMin)} planned of {durationLabel(budget.capacityMin)}
        {over && <span className="budget__over-tag">Over by {durationLabel(budget.overBy)}</span>}
      </p>

      {budget.rows.map((r) => {
        const pct = budget.capacityMin
          ? Math.min(100, (r.minutes / budget.capacityMin) * 100)
          : 0
        return (
          <div className="meter" key={r.quadrant}>
            <span
              className="quad-dot"
              style={{ background: QUADRANT_COLOR[r.quadrant] }}
            />
            <span className="meter__label">{QUADRANT_LABEL[r.quadrant]}</span>
            <span className="meter__value">
              {r.minutes > 0 ? durationLabel(r.minutes) : '—'}
            </span>
            <span className="meter__bar">
              <span
                className="meter__fill"
                style={{ width: `${pct}%`, background: QUADRANT_COLOR[r.quadrant] }}
              />
            </span>
          </div>
        )
      })}

      {budget.unplannedDueMin > 0 && (
        <p className="budget__unplanned">
          Due {mode === 'day' ? 'this day' : 'this week'}, not yet planned:{' '}
          {durationLabel(budget.unplannedDueMin)}
        </p>
      )}
    </section>
  )
}
