import { useDroppable } from '@dnd-kit/core'
import { format } from 'date-fns'
import { toDateStr, todayStr, weekDays } from '../../lib/time'
import { Icon } from '../Icon'

function DayCell({
  date,
  selected,
  overloaded,
  onSelect,
}: {
  date: Date
  selected: boolean
  overloaded: boolean
  onSelect: (day: string) => void
}) {
  const s = toDateStr(date)
  const { setNodeRef, isOver } = useDroppable({ id: `day:${s}` })
  const isToday = s === todayStr()
  return (
    <button
      ref={setNodeRef}
      className={[
        'day-cell',
        selected ? 'day-cell--selected' : '',
        isToday ? 'day-cell--today' : '',
        isOver ? 'day-cell--over' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(s)}
    >
      <span className="day-cell__dow">{format(date, 'EEE')}</span>
      <span className="day-cell__num">{format(date, 'd')}</span>
      {overloaded && <span className="day-cell__dot" title="Planned over capacity" />}
    </button>
  )
}

interface Props {
  anchor: Date
  selectedDay: string
  overloadedDays: Set<string>
  onSelect: (day: string) => void
  onShiftWeek: (delta: number) => void
  onToday: () => void
}

export function WeekStrip({
  anchor,
  selectedDay,
  overloadedDays,
  onSelect,
  onShiftWeek,
  onToday,
}: Props) {
  const days = weekDays(anchor)
  return (
    <div className="week-strip">
      <div className="week-strip__nav">
        <button className="icon-btn" aria-label="Previous week" onClick={() => onShiftWeek(-1)}>
          <Icon name="chevronLeft" />
        </button>
        <span className="week-strip__label">{format(days[0], 'MMMM yyyy')}</span>
        <button className="week-strip__today" onClick={onToday}>
          Today
        </button>
        <button className="icon-btn" aria-label="Next week" onClick={() => onShiftWeek(1)}>
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="week-strip__days">
        {days.map((d) => {
          const s = toDateStr(d)
          return (
            <DayCell
              key={s}
              date={d}
              selected={s === selectedDay}
              overloaded={overloadedDays.has(s)}
              onSelect={onSelect}
            />
          )
        })}
      </div>
    </div>
  )
}
