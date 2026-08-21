import { durationLabel } from '../../lib/time'

const PRESETS = [15, 30, 60, 120, 240]

export function EstimatePicker({
  value,
  onChange,
  allowNone = true,
}: {
  value: number | null
  onChange: (min: number | null) => void
  allowNone?: boolean
}) {
  return (
    <div className="chip-row">
      {allowNone && (
        <button
          type="button"
          className={`chip${value === null ? ' chip--on' : ''}`}
          onClick={() => onChange(null)}
        >
          None
        </button>
      )}
      {PRESETS.map((m) => (
        <button
          key={m}
          type="button"
          className={`chip${value === m ? ' chip--on' : ''}`}
          onClick={() => onChange(m)}
        >
          {durationLabel(m)}
        </button>
      ))}
      <span className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label="Less time"
          disabled={value === null || value <= 15}
          onClick={() => onChange(Math.max(15, (value ?? 30) - 15))}
        >
          −
        </button>
        <span className="stepper__val">{value === null ? '—' : durationLabel(value)}</span>
        <button
          type="button"
          className="stepper__btn"
          aria-label="More time"
          onClick={() => onChange((value ?? 0) + 15)}
        >
          +
        </button>
      </span>
    </div>
  )
}
