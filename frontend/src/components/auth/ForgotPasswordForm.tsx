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
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <h2 className="text-xl font-semibold text-talkapp-primary mb-1">Revisa tu correo</h2>
        <p className="text-sm text-talkapp-fg-muted">
          Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.
        </p>
        <button
          type="button"
          onClick={onBackToLogin}
          className="mt-2 rounded-xl bg-talkapp-primary text-talkapp-on-primary font-semibold py-2.5 hover:bg-talkapp-accent focus:outline-none focus:ring-2 focus:ring-talkapp-primary"
        >
          Volver a iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-xl font-semibold text-talkapp-primary mb-1">Recuperar contraseña</h2>
      <p className="text-sm text-talkapp-fg-muted">
        Indica el email de tu cuenta y te enviaremos un enlace para restablecer la contraseña.
      </p>
      {error && (
        <div
          className="text-sm text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2"
          role="alert"
        >
          {error}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-talkapp-fg-muted">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-xl bg-talkapp-panel border border-talkapp-border px-4 py-2.5 text-talkapp-fg placeholder-talkapp-fg-muted focus:outline-none focus:ring-2 focus:ring-talkapp-primary/50 focus:border-talkapp-primary"
          placeholder="tu@email.com"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-talkapp-primary text-talkapp-on-primary font-semibold py-2.5 hover:bg-talkapp-accent focus:outline-none focus:ring-2 focus:ring-talkapp-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Enviando…' : 'Enviar enlace'}
      </button>
      <p className="text-sm text-talkapp-fg-muted text-center mt-2">
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-talkapp-primary hover:underline"
        >
          Volver a iniciar sesión
        </button>
      </p>
    </form>
  )
}
