import { useState, type FormEvent } from 'react'

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>
  onSwitchToRegister: () => void
  error: string | null
  clearError: () => void
}

export function LoginForm({
  onSubmit,
  onSwitchToRegister,
  error,
  clearError,
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLoading(true)
    try {
      await onSubmit(email.trim(), password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-xl font-semibold text-bitchat-cyan mb-1">Iniciar sesión</h2>
      {error && (
        <div
          className="text-sm text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2"
          role="alert"
        >
          {error}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-xl bg-bitchat-panel border border-bitchat-border px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-bitchat-cyan/50 focus:border-bitchat-cyan"
          placeholder="tu@email.com"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="rounded-xl bg-bitchat-panel border border-bitchat-border px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-bitchat-cyan/50 focus:border-bitchat-cyan"
          placeholder="••••••••"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-bitchat-cyan text-bitchat-blue-dark font-semibold py-2.5 hover:bg-bitchat-cyan-bright focus:outline-none focus:ring-2 focus:ring-bitchat-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-sm text-slate-500 text-center mt-2">
        ¿No tienes cuenta?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-bitchat-cyan hover:underline"
        >
          Regístrate
        </button>
      </p>
    </form>
  )
}
