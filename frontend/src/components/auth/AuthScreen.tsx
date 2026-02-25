import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

export function AuthScreen() {
  const { login, register, error, clearError } = useAuth()
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bitchat-bg p-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-14 h-14 rounded-full bg-bitchat-cyan flex items-center justify-center text-bitchat-blue-dark font-bold text-2xl">
          b
        </div>
        <h1 className="text-2xl font-semibold text-bitchat-cyan">BitChat</h1>
      </div>
      <div className="bg-bitchat-panel border border-bitchat-border rounded-2xl p-6 w-full max-w-sm">
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
