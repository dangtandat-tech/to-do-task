import { clamp, minToLabel } from '../../lib/time'

const PRESETS = [540, 840, 1200] // 09:00, 14:00, 20:00

export function TimeStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (min: number) => void
}) {
  return (
    <div className="chip-row">
      {PRESETS.map((m) => (
        <button
          key={m}
          type="button"
          className={`chip${value === m ? ' chip--on' : ''}`}
          onClick={() => onChange(m)}
        >
          {minToLabel(m)}
        </button>
      ))}
      <span className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label="Earlier"
          onClick={() => onChange(clamp(value - 15, 0, 1425))}
        >
          −
        </button>
        <span className="stepper__val">{minToLabel(value)}</span>
        <button
          type="button"
          className="stepper__btn"
          aria-label="Later"
          onClick={() => onChange(clamp(value + 15, 0, 1425))}
        >
          +
        </button>
      </span>
    </div>
  )
}
