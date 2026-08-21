import type { CSSProperties } from 'react'
import { QUADRANT_COLOR, QUADRANT_LABEL, QUADRANTS } from '../../lib/quadrant'
import type { Quadrant } from '../../lib/types'

export function QuadrantPicker({
  value,
  onChange,
}: {
  value: Quadrant
  onChange: (q: Quadrant) => void
}) {
  return (
    <div className="quad-grid" role="radiogroup" aria-label="Priority">
      {QUADRANTS.map((q) => (
        <button
          key={q}
          type="button"
          role="radio"
          aria-checked={value === q}
          className={`quad-cell${value === q ? ' quad-cell--on' : ''}`}
          style={{ '--q': QUADRANT_COLOR[q] } as CSSProperties}
          onClick={() => onChange(q)}
        >
          <span className="quad-cell__dot" />
          {QUADRANT_LABEL[q]}
        </button>
      ))}
    </div>
  )
}
