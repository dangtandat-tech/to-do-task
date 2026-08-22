import { useState } from 'react'
import { addWeeks, format, isBefore, startOfDay } from 'date-fns'
import { toDateStr, weekDays } from '../../lib/time'
import { Icon } from '../Icon'

interface Props {
  selected: Set<string>
  onToggle: (day: string) => void
  disablePast?: boolean
}

/** Week-at-a-time multi-select day picker used inside sheets. */
export function MiniWeekPicker({ selected, onToggle, disablePast = true }: Props) {
  const [anchor, setAnchor] = useState(() => new Date())
  const week = weekDays(anchor)
  const today = startOfDay(new Date())

  return (
    <>
      <div className="mini-week__nav">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous week"
          onClick={() => setAnchor((a) => addWeeks(a, -1))}
        >
          <Icon name="chevronLeft" />
        </button>
        <span className="mini-week__label">{format(week[0], 'MMMM yyyy')}</span>
        <button
          type="button"
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
          const past = disablePast && isBefore(d, today)
          return (
            <button
              key={s}
              type="button"
              disabled={past}
              className={`mini-week__day${selected.has(s) ? ' mini-week__day--on' : ''}`}
              onClick={() => onToggle(s)}
            >
              <span className="mini-week__dow">{format(d, 'EEEEE')}</span>
              <span className="mini-week__num">{format(d, 'd')}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
