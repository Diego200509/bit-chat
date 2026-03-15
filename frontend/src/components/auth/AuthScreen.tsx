import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { ResetPasswordForm } from './ResetPasswordForm'

type AuthView = 'login' | 'register' | 'forgot' | 'reset'

function FloatingOrb({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`}
    />
  )
}

export function AuthScreen() {
  const { login, register, error, clearError } = useAuth()
  const [view, setView] = useState<AuthView>('login')
  const [resetToken, setResetToken] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setView('reset')
      setResetToken(token)
    }
  }, [])

  const goToLogin = () => {
    setView('login')
    setResetToken(null)
    clearError()
    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  return (
    <div className="auth-screen-root">
      {/* Fondo decorativo con orbs */}
      <FloatingOrb className="auth-orb auth-orb-1" />
      <FloatingOrb className="auth-orb auth-orb-2" />
      <FloatingOrb className="auth-orb auth-orb-3" />

      {/* Grid pattern overlay */}
      <div className="auth-grid-overlay" />

      {/* Layout: izquierda branding | derecha formulario */}
      <div className="auth-layout">
        {/* Panel izquierdo — solo visible en desktop */}
        <div className="auth-branding-panel">
          <div className="auth-branding-content auth-branding-centered">
            <div className="auth-logo-wrap">
              <img
                src="/img/Talk-app_sin-fondo.png"
                alt="TalkApp"
                className="auth-logo-img"
              />
            </div>
            <h1 className="auth-brand-title">TalkApp</h1>
            <p className="auth-brand-tagline">
              Conecta. Habla. Colabora.
            </p>
          </div>
        </div>

        {/* Panel derecho — formulario */}
        <div className="auth-form-panel">
          <div className="auth-form-container">
            {/* Logo móvil */}
            <div className="auth-mobile-logo">
              <img
                src="/img/Talk-app_sin-fondo.png"
                alt="TalkApp"
                className="auth-mobile-logo-img"
              />
              <span className="auth-mobile-brand">TalkApp</span>
            </div>

            <div className="auth-card">
              {view === 'login' && (
                <LoginForm
                  onSubmit={login}
                  onSwitchToRegister={() => setView('register')}
                  onSwitchToForgot={() => setView('forgot')}
                  error={error}
                  clearError={clearError}
                />
              )}
              {view === 'register' && (
                <RegisterForm
                  onSubmit={register}
                  onSwitchToLogin={() => setView('login')}
                  error={error}
                  clearError={clearError}
                />
              )}
              {view === 'forgot' && (
                <ForgotPasswordForm onBackToLogin={goToLogin} />
              )}
              {view === 'reset' && resetToken && (
                <ResetPasswordForm token={resetToken} onSuccess={goToLogin} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


