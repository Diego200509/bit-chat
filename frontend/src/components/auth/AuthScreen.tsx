import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

export function AuthScreen() {
  const { login, register, error, clearError } = useAuth()
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="flex min-h-screen min-h-dvh flex-col items-center justify-center bg-bitchat-bg p-4 safe-t safe-b safe-l safe-r">
      <div className="mb-6 flex items-center gap-3 sm:mb-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bitchat-cyan text-bitchat-blue-dark font-bold text-xl sm:h-14 sm:w-14 sm:text-2xl">
          b
        </div>
        <h1 className="text-xl font-semibold text-bitchat-cyan sm:text-2xl">BitChat</h1>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-bitchat-border bg-bitchat-panel p-4 sm:p-6">
        {isLogin ? (
          <LoginForm
            onSubmit={login}
            onSwitchToRegister={() => setIsLogin(false)}
            error={error}
            clearError={clearError}
          />
        ) : (
          <RegisterForm
            onSubmit={register}
            onSwitchToLogin={() => setIsLogin(true)}
            error={error}
            clearError={clearError}
          />
        )}
      </div>
    </div>
  )
}
