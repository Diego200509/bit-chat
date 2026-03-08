import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

export function AuthScreen() {
  const { login, register, error, clearError } = useAuth()
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="flex min-h-screen min-h-dvh flex-col items-center bg-bitchat-bg p-4 pt-8 sm:pt-12 safe-t safe-b safe-l safe-r">
      <div className="flex flex-col items-center gap-0 w-full max-w-sm">
        <img src="/img/BitChat.png" alt="BitChat" className="h-28 w-auto sm:h-40 md:h-44 block" />
        <div className="w-full rounded-2xl border border-bitchat-border bg-bitchat-panel p-4 sm:p-6">
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
    </div>
  )
}
