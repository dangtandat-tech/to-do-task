import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function AuthPage() {
  const { session } = useAuth()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  const submit = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session)
          setNotice('Account created — check your email to confirm, then sign in.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-brand">Atelier</h1>
        <p className="auth-tagline">A quiet place to plan your days</p>

        {!isSupabaseConfigured && (
          <p className="error-text">
            Supabase is not configured. Copy <code>.env.example</code> to{' '}
            <code>.env.local</code> and fill in your project URL and anon key.
          </p>
        )}

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === 'signin' ? ' auth-tab--on' : ''}`}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            className={`auth-tab${mode === 'register' ? ' auth-tab--on' : ''}`}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="field__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="field__input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </label>

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="notice-text">{notice}</p>}

        <button
          className="btn btn--primary btn--full"
          disabled={busy || !email || password.length < 6}
          onClick={submit}
        >
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        {mode === 'register' && (
          <p className="sheet__hint">Password must be at least 6 characters.</p>
        )}
      </div>
    </div>
  )
}
