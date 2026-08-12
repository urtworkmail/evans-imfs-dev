import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'

const FeatureIcon = ({ d }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

const FEATURES = [
  {
    label: 'Real-time inventory across fabric and finished goods',
    icon: <FeatureIcon d={<><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>} />,
  },
  {
    label: 'Demand forecasting with seasonal adjustments',
    icon: <FeatureIcon d={<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>} />,
  },
  {
    label: 'Shopify & QuickBooks sales, unified in one view',
    icon: <FeatureIcon d={<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>} />,
  },
]

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needsTotp, setNeedsTotp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password, needsTotp ? totpCode : undefined)
      navigate('/')
    } catch (err) {
      if (err.response?.data?.detail === 'totp_required') {
        setNeedsTotp(true)
        setError(totpCode ? 'Invalid authentication code. Try again.' : '')
        setTotpCode('')
      } else {
        setError(err.response?.data?.detail || 'Invalid username or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  const backToPassword = () => {
    setNeedsTotp(false)
    setTotpCode('')
    setError('')
  }

  return (
    <div className="login-split">
      {/* Left — brand panel */}
      <div className="login-brand">
        <div className="login-brand-mark">
          <div className="login-brand-mark-icon">⛳</div>
          Evans Golf IMFS
        </div>

        <div className="login-brand-body">
          <div className="login-brand-title">One system, every unit tracked.</div>
          <div className="login-brand-sub">
            Inventory, purchasing, and demand forecasting for Evans Golf —
            in one place, always up to date.
          </div>
        </div>

        <div className="login-brand-features">
          {FEATURES.map(f => (
            <div className="login-brand-feature" key={f.label}>
              <div className="login-brand-feature-icon">{f.icon}</div>
              <div>{f.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — form panel */}
      <div className="login-form-panel">
        <div className="login-theme-toggle">
          <ThemeToggle />
        </div>

        <div className="login-form-wrap">
          <div className="login-form-header">
            <div className="login-form-title">{needsTotp ? 'Two-factor authentication' : 'Welcome back'}</div>
            <div className="login-form-sub">
              {needsTotp
                ? 'Enter the 6-digit code from your authenticator app'
                : 'Sign in to your Evans Golf IMFS account'}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {!needsTotp && (
              <>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    className="form-input"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. admin"
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    className="form-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </>
            )}

            {needsTotp && (
              <div className="form-group">
                <label className="form-label">Authentication code</label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  autoFocus
                  required
                />
              </div>
            )}

            {error && <div className="login-error">{error}</div>}
            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : needsTotp ? 'Verify' : 'Sign In'}
            </button>
            {needsTotp && (
              <button
                type="button"
                className="link-btn"
                style={{ display: 'block', margin: '14px auto 0' }}
                onClick={backToPassword}
              >
                ← Back
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
