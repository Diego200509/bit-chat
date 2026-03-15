import { useState, type FormEvent } from 'react'
import * as api from '../../lib/api'

interface ResetPasswordFormProps {
  token: string
  onSuccess: () => void
}

export function ResetPasswordForm({ token, onSuccess }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      await api.resetPassword(token, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-xl font-semibold text-talkapp-primary mb-1">Nueva contraseña</h2>
      <p className="text-sm text-talkapp-fg-muted">
        Elige una contraseña nueva (mínimo 6 caracteres).
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
        <span className="text-sm text-talkapp-fg-muted">Nueva contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="rounded-xl bg-talkapp-panel border border-talkapp-border px-4 py-2.5 text-talkapp-fg placeholder-talkapp-fg-muted focus:outline-none focus:ring-2 focus:ring-talkapp-primary/50 focus:border-talkapp-primary"
          placeholder="••••••••"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-talkapp-fg-muted">Repetir contraseña</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="rounded-xl bg-talkapp-panel border border-talkapp-border px-4 py-2.5 text-talkapp-fg placeholder-talkapp-fg-muted focus:outline-none focus:ring-2 focus:ring-talkapp-primary/50 focus:border-talkapp-primary"
          placeholder="••••••••"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-talkapp-primary text-talkapp-on-primary font-semibold py-2.5 hover:bg-talkapp-accent focus:outline-none focus:ring-2 focus:ring-talkapp-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Guardando…' : 'Restablecer contraseña'}
      </button>
      <p className="text-sm text-talkapp-fg-muted text-center mt-2">
        <button
          type="button"
          onClick={onSuccess}
          className="text-talkapp-primary hover:underline"
        >
          Volver a iniciar sesión
        </button>
      </p>
    </form>
  )
}
