import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { ResetPasswordForm } from './ResetPasswordForm'

type AuthView = 'login' | 'register' | 'forgot' | 'reset'

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
    <div className="flex min-h-screen min-h-dvh flex-col items-center bg-talkapp-bg p-4 pt-8 sm:pt-12 safe-t safe-b safe-l safe-r">
      <div className="flex flex-col items-center gap-0 w-full max-w-sm">
        <img src="/img/Talk-app_sin-fondo.png" alt="TalkApp" className="h-28 w-auto sm:h-40 md:h-44 block" />
        <div className="w-full rounded-2xl border border-talkapp-border bg-talkapp-panel p-4 sm:p-6">
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
  )
}
