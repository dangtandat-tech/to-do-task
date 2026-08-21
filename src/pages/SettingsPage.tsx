import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useData'
import { useProfileMutations } from '../hooks/useMutations'
import { durationLabel, minToLabel } from '../lib/time'

function MinStepper({
  value,
  step,
  min,
  max,
  label,
  format,
  onChange,
}: {
  value: number
  step: number
  min: number
  max: number
  label: string
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="setting-row">
      <span className="setting-row__label">{label}</span>
      <span className="stepper">
        <button
          className="stepper__btn"
          aria-label={`Decrease ${label}`}
          disabled={value - step < min}
          onClick={() => onChange(value - step)}
        >
          −
        </button>
        <span className="stepper__val">{format(value)}</span>
        <button
          className="stepper__btn"
          aria-label={`Increase ${label}`}
          disabled={value + step > max}
          onClick={() => onChange(value + step)}
        >
          +
        </button>
      </span>
    </div>
  )
}

export function SettingsPage() {
  const { data: profile } = useProfile()
  const { updateProfile } = useProfileMutations()
  const [name, setName] = useState<string | null>(null)

  if (!profile) return <div className="page"><div className="skeleton" /></div>

  const displayName = name ?? profile.display_name ?? ''

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <section className="settings-card">
        <label className="field">
          <span className="field__label">Display name</span>
          <input
            className="field__input"
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name !== null && name !== profile.display_name)
                updateProfile.mutate({ display_name: name })
            }}
          />
        </label>
      </section>

      <section className="settings-card">
        <h2 className="section-label">Daily rhythm</h2>
        <MinStepper
          label="Daily capacity"
          value={profile.day_capacity_min}
          step={30}
          min={60}
          max={1440}
          format={durationLabel}
          onChange={(v) => updateProfile.mutate({ day_capacity_min: v })}
        />
        <MinStepper
          label="Day starts"
          value={profile.day_start_min}
          step={30}
          min={0}
          max={profile.day_end_min - 60}
          format={minToLabel}
          onChange={(v) => updateProfile.mutate({ day_start_min: v })}
        />
        <MinStepper
          label="Day ends"
          value={profile.day_end_min}
          step={30}
          min={profile.day_start_min + 60}
          max={1439}
          format={minToLabel}
          onChange={(v) => updateProfile.mutate({ day_end_min: v })}
        />
        <p className="sheet__hint">
          The capacity is the threshold for over-planning warnings; day start and end bound
          the timeline.
        </p>
      </section>

      <button className="btn btn--ghost" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  )
}
