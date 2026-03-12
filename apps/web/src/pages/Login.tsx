import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { theme } from '../theme'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, user } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      const to = user.role === 'super_admin' ? '/super/dashboard' : '/merchant/dashboard'
      navigate(to, { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: '100%',
          padding: 32,
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.borderMuted}`,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <span
            style={{ fontSize: 24, fontWeight: 700, color: theme.text, letterSpacing: '-0.02em' }}
          >
            ArmAI
          </span>
          <span
            style={{
              fontSize: 11,
              color: theme.primary,
              marginLeft: 8,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Platform
          </span>
        </div>
        <p style={{ color: theme.textSecondary, marginBottom: 28, fontSize: 14 }}>
          {t('login.continue')}
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontWeight: 500,
                color: theme.textSecondary,
                fontSize: 13,
              }}
              htmlFor="login-email"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ width: '100%', padding: 12 }}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontWeight: 500,
                color: theme.textSecondary,
                fontSize: 13,
              }}
              htmlFor="login-password"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ width: '100%', padding: 12 }}
            />
          </div>
          {error && (
            <p
              id="login-error"
              role="alert"
              style={{ color: theme.danger, marginBottom: 16, fontSize: 13 }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 12,
              background: theme.primary,
              color: theme.background,
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
            }}
            aria-busy={loading}
          >
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
