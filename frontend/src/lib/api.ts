import { env } from '../config/env'

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

function authHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  return headers
}

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

// --- Users & Friends (Fase 2) ---
export interface SearchUser {
  id: string
  name: string
  email: string
  avatar?: string | null
}

export interface FriendItem {
  id: string
  status: string
  userId: string
  name: string
  email?: string
  avatar?: string | null
}

export interface FriendsData {
  friends: FriendItem[]
  sent: FriendItem[]
  received: FriendItem[]
}

export interface ChatListItem {
  id: string
  name: string
  type: 'direct' | 'group'
  otherUserId?: string
  lastMessage?: string
  lastMessageTime?: number | null
}

export async function searchUsers(q: string): Promise<SearchUser[]> {
  const res = await fetch(`${env.apiUrl}/users/search?q=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Error al buscar')
  return res.json()
}

export async function getFriends(): Promise<FriendsData> {
  const res = await fetch(`${env.apiUrl}/friends`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Error al cargar amigos')
  return res.json()
}

export async function sendFriendRequest(addresseeId: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${env.apiUrl}/friends/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ addresseeId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al enviar solicitud')
  return data
}

export async function acceptOrRejectRequest(requestId: string, action: 'accept' | 'reject'): Promise<void> {
  const res = await fetch(`${env.apiUrl}/friends/request/${requestId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ action }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Error al procesar')
  }
}

export interface ChatListItemWithBlocked extends ChatListItem {
  isBlocked?: boolean
}

export async function getChats(): Promise<ChatListItemWithBlocked[]> {
  const res = await fetch(`${env.apiUrl}/chats`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Error al cargar chats')
  return res.json()
}

export async function getBlockedUserIds(): Promise<string[]> {
  const res = await fetch(`${env.apiUrl}/users/blocked`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function createDirectChat(otherUserId: string): Promise<ChatListItem> {
  const res = await fetch(`${env.apiUrl}/chats/direct`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ otherUserId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al abrir chat')
  return data
}

export async function blockUser(userId: string): Promise<void> {
  const res = await fetch(`${env.apiUrl}/users/block`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) throw new Error('Error al bloquear')
}

export async function unblockUser(userId: string): Promise<void> {
  const res = await fetch(`${env.apiUrl}/users/block/${userId}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) throw new Error('Error al desbloquear')
}

// --- Auth ---
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
