import { durationLabel } from '../../lib/time'
import { splitDuration } from '../../lib/smart'
import { MiniWeekPicker } from './MiniWeekPicker'
import { TimeStepper } from './TimeStepper'
import { EstimatePicker } from './EstimatePicker'

interface Props {
  days: Set<string>
  auto: boolean
  startMin: number
  duration: number
  /** the task's estimate, used to preview the auto per-day split */
  estimateMin: number | null
  onToggleDay: (d: string) => void
  onAuto: (auto: boolean) => void
  onStart: (min: number) => void
  onDuration: (min: number) => void
  disablePast?: boolean
  initialAnchor?: Date
}

/**
 * The one schedule editor. Default is Auto: pick days only — the estimate is
 * split across them and each block lands in the first free gap of its day.
 * Custom reveals manual start-time and duration controls.
 */
export function SchedulePicker({
  days,
  auto,
  startMin,
  duration,
  estimateMin,
  onToggleDay,
  onAuto,
  onStart,
  onDuration,
  disablePast,
  initialAnchor,
}: Props) {
  const autoPerDay = splitDuration(estimateMin, Math.max(1, days.size))
  return (
    <>
      <MiniWeekPicker
        selected={days}
        onToggle={onToggleDay}
        disablePast={disablePast}
        initialAnchor={initialAnchor}
      />
      <div className="chip-row schedule-mode">
        <button
          type="button"
          className={`chip${auto ? ' chip--on' : ''}`}
          onClick={() => onAuto(true)}
        >
          Auto
        </button>
        <button
          type="button"
          className={`chip${!auto ? ' chip--on' : ''}`}
          onClick={() => onAuto(false)}
        >
          Custom
        </button>
      </div>
      {auto ? (
        days.size > 0 && (
          <p className="sheet__hint">
            {durationLabel(autoPerDay)}
            {days.size > 1 ? ' per day' : ''} from the estimate, placed in the first free
            slot of each day.
          </p>
        )
      ) : (
        <>
          <span className="field__label">Start time</span>
          <TimeStepper value={startMin} onChange={onStart} />
          <span className="field__label">
            {days.size > 1 ? 'Duration per day' : 'Duration'}
          </span>
          <EstimatePicker
            value={duration}
            onChange={(m) => {
              if (m !== null) onDuration(m)
            }}
            allowNone={false}
          />
          {days.size > 1 && (
            <p className="sheet__hint">
              One plan across {days.size} days — {durationLabel(duration * days.size)} in
              total.
            </p>
          )}
        </>
      )}
    </>
  )
}
