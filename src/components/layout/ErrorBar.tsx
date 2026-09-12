import { useSyncExternalStore } from 'react'
import { clearError, getError, subscribeErrors } from '../../lib/errors'
import { Icon } from '../Icon'

/** Shows the last failed write instead of leaving a button looking dead. */
export function ErrorBar() {
  const message = useSyncExternalStore(subscribeErrors, getError, () => null)
  if (!message) return null
  const missingColumn = message.includes('completed_at')
  return (
    <div className="error-bar" role="alert">
      <Icon name="warning" size={16} />
      <span className="error-bar__text">
        {missingColumn
          ? 'Database is missing the per-day column — run supabase/migrations/0003_session_completion.sql in the Supabase SQL editor.'
          : message}
      </span>
      <button className="icon-btn" aria-label="Dismiss" onClick={clearError}>
        <Icon name="x" size={15} />
      </button>
    </div>
  )
}
