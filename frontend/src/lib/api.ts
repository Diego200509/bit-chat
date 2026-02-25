import { env } from '../config/env'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar?: string | null
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  const res = await fetch(`${env.apiUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al registrar')
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${env.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas')
  return data
}
