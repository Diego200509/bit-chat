import { useState, type FormEvent } from 'react'

interface RegisterFormProps {
  onSubmit: (email: string, password: string, name: string) => Promise<void>
  onSwitchToLogin: () => void
  error: string | null
  clearError: () => void
}

export function RegisterForm({
  onSubmit,
  onSwitchToLogin,
  error,
  clearError,
}: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLoading(true)
    try {
      await onSubmit(email.trim(), password, name.trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-xl font-semibold text-bitchat-cyan mb-1">Crear cuenta</h2>
      {error && (
        <div
          className="text-sm text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2"
          role="alert"
        >
          {error}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-bitchat-fg-muted">Nombre</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          className="rounded-xl bg-bitchat-panel border border-bitchat-border px-4 py-2.5 text-bitchat-fg placeholder-bitchat-fg-muted focus:outline-none focus:ring-2 focus:ring-bitchat-cyan/50 focus:border-bitchat-cyan"
          placeholder="Tu nombre"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-bitchat-fg-muted">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-xl bg-bitchat-panel border border-bitchat-border px-4 py-2.5 text-bitchat-fg placeholder-bitchat-fg-muted focus:outline-none focus:ring-2 focus:ring-bitchat-cyan/50 focus:border-bitchat-cyan"
          placeholder="tu@email.com"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-bitchat-fg-muted">Contraseña (mín. 6)</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="rounded-xl bg-bitchat-panel border border-bitchat-border px-4 py-2.5 text-bitchat-fg placeholder-bitchat-fg-muted focus:outline-none focus:ring-2 focus:ring-bitchat-cyan/50 focus:border-bitchat-cyan"
          placeholder="••••••••"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-bitchat-cyan text-bitchat-blue-dark font-semibold py-2.5 hover:bg-bitchat-cyan-bright focus:outline-none focus:ring-2 focus:ring-bitchat-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creando cuenta…' : 'Registrarme'}
      </button>
      <p className="text-sm text-bitchat-fg-muted text-center mt-2">
        ¿Ya tienes cuenta?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-bitchat-cyan hover:underline"
        >
          Inicia sesión
        </button>
      </p>
    </form>
  )
}
