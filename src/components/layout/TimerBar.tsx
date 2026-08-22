import { useEffect, useState } from 'react'
import { useTasks } from '../../hooks/useData'
import { useTimer } from '../../context/TimerContext'
import { durationLabel } from '../../lib/time'
import { Icon } from '../Icon'

function elapsedLabel(startedAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Persistent focus-timer strip shown above the bottom navigation. */
export function TimerBar() {
  const { session, stop, discard } = useTimer()
  const { data: tasks } = useTasks()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!session) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [session])

  if (!session) return null
  const task = tasks?.find((t) => t.id === session.taskId)
  if (tasks && !task) {
    // the timed task was deleted meanwhile
    discard()
    return null
  }

  return (
    <div className="timer-bar">
      <span className="timer-bar__pulse" />
      <span className="timer-bar__info">
        <span className="timer-bar__task">{task?.title ?? '…'}</span>
        {task?.estimate_min != null && (
          <span className="timer-bar__estimate">
            {durationLabel(task.spent_min)} logged · est {durationLabel(task.estimate_min)}
          </span>
        )}
      </span>
      <span className="timer-bar__clock">{elapsedLabel(session.startedAt, now)}</span>
      <button
        className="icon-btn timer-bar__btn"
        aria-label="Stop and log time"
        title="Stop — log the time, keep the task open"
        onClick={() => void stop()}
      >
        <Icon name="stop" size={17} />
      </button>
      <button
        className="icon-btn timer-bar__btn timer-bar__btn--done"
        aria-label="Finish task"
        title="Done — log the time and complete the task"
        onClick={() => void stop({ complete: true })}
      >
        <Icon name="check" size={17} />
      </button>
    </div>
  )
}
