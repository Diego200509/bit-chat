import { useState, type FormEvent } from 'react'
import * as api from '../../lib/api'

interface ForgotPasswordFormProps {
  onBackToLogin: () => void
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="auth-form">
        <div className="auth-form-header">
          <h2 className="auth-form-title">Revisa tu correo</h2>
          <p className="auth-form-subtitle">Enlace enviado exitosamente</p>
        </div>
        <div className="auth-sent-notice">
          <span className="auth-sent-icon">📬</span>
          <p className="auth-sent-text">
            Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToLogin}
          className="auth-submit-btn"
        >
          <span>Volver a iniciar sesión</span>
          <ArrowRightIcon />
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-form-header">
        <h2 className="auth-form-title">Recuperar contraseña</h2>
        <p className="auth-form-subtitle">Te enviaremos un enlace de restablecimiento</p>
      </div>

      {error && (
        <div className="auth-error-banner" role="alert">
          <span className="auth-error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="auth-fields">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="forgot-email">
            Correo electrónico
          </label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon">
              <EmailIcon />
            </span>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="auth-input auth-input-with-icon"
              placeholder="nombre@ejemplo.com"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="auth-submit-btn"
      >
        {loading ? (
          <span className="auth-spinner" />
        ) : (
          <>
            <span>Enviar enlace</span>
            <ArrowRightIcon />
          </>
        )}
      </button>

      <p className="auth-switch-text">
        <button
          type="button"
          onClick={onBackToLogin}
          className="auth-switch-link"
        >
          ← Volver a iniciar sesión
        </button>
      </p>
    </form>
  )
}

function EmailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
      <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
    </svg>
  )
}
