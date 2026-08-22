import { durationLabel } from '../../lib/time'
import { MiniWeekPicker } from './MiniWeekPicker'
import { TimeStepper } from './TimeStepper'
import { EstimatePicker } from './EstimatePicker'

interface Props {
  days: Set<string>
  startMin: number
  duration: number
  onToggleDay: (d: string) => void
  onStart: (min: number) => void
  onDuration: (min: number) => void
  disablePast?: boolean
  initialAnchor?: Date
}

/** The one schedule editor: pick work days + start time + per-day duration. */
export function SchedulePicker({
  days,
  startMin,
  duration,
  onToggleDay,
  onStart,
  onDuration,
  disablePast,
  initialAnchor,
}: Props) {
  return (
    <>
      <MiniWeekPicker
        selected={days}
        onToggle={onToggleDay}
        disablePast={disablePast}
        initialAnchor={initialAnchor}
      />
      <span className="field__label">Start time</span>
      <TimeStepper value={startMin} onChange={onStart} />
      <span className="field__label">{days.size > 1 ? 'Duration per day' : 'Duration'}</span>
      <EstimatePicker
        value={duration}
        onChange={(m) => {
          if (m !== null) onDuration(m)
        }}
        allowNone={false}
      />
      {days.size > 1 && (
        <p className="sheet__hint">
          One plan across {days.size} days — {durationLabel(duration * days.size)} in total.
        </p>
      )}
    </>
  )
}
