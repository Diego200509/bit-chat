import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { socket } from '../lib/socket'
import * as api from '../lib/api'


const STORAGE_KEY = 'bitchat_auth'

interface StoredAuth {
  token: string
  user: api.AuthUser
}

interface AuthContextValue {
  user: api.AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

function saveStored(auth: StoredAuth | null) {
  if (auth) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  useEffect(() => {
    const stored = loadStored()
    if (stored?.token && stored?.user) {
      setToken(stored.token)
      setUser(stored.user)
      api.setAuthToken(stored.token)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    api.setAuthToken(token)
  }, [token])

  // Conectar socket cuando hay token; desconectar al cerrar sesión
  useEffect(() => {
    if (!token) {
      socket.disconnect()
      const s = socket as import('socket.io-client').Socket
      s.auth = {}
      return
    }
    const s = socket as import('socket.io-client').Socket
    s.auth = { token }
    socket.connect()

    const onConnectError = (err: Error) => {
      if (err.message?.includes('token') || err.message?.includes('Token') || err.message?.includes('Unauthorized')) {
        saveStored(null)
        setToken(null)
        setUser(null)
      }
    }
    socket.on('connect_error', onConnectError)
    return () => {
      socket.off('connect_error', onConnectError)
      socket.disconnect()
    }
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    try {
      const data = await api.login(email, password)
      const auth: StoredAuth = { token: data.token, user: data.user }
      saveStored(auth)
      api.setAuthToken(data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
      throw err
    }
  }, [])

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      setError(null)
      try {
        const data = await api.register(email, password, name)
        const auth: StoredAuth = { token: data.token, user: data.user }
saveStored(auth)
      api.setAuthToken(data.token)
      setToken(data.token)
      setUser(data.user)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al registrar')
        throw err
      }
    },
    []
  )

  const logout = useCallback(() => {
    saveStored(null)
    api.setAuthToken(null)
    setToken(null)
    setUser(null)
  }, [])

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    error,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
