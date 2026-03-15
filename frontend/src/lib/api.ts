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
  nickname?: string | null
  avatar?: string | null
  status?: string | null
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface SearchUser {
  id: string
  name: string
  email: string
  avatar?: string | null
}

export interface ContactItem {
  id: string
  status: string
  userId: string
  name: string
  email?: string
  avatar?: string | null
}

export interface ContactsData {
  friends: ContactItem[]
  sent: ContactItem[]
  received: ContactItem[]
}

export interface ConversationListItem {
  id: string
  name: string
  type: 'direct' | 'group'
  otherUserId?: string
  avatar?: string | null
  otherUserLastSeen?: number | null
  otherUserStatus?: string | null
  image?: string | null
  participants?: Array<{ id: string; name: string }>
  lastMessage?: string
  lastMessageTime?: number | null
  lastMessageSenderId?: string | null
  lastMessageDeliveredBy?: string[]
  lastMessageReadBy?: string[]
  isPinned?: boolean
  isMuted?: boolean
  unread?: number
  adminIds?: string[]
  isGroupAdmin?: boolean
  isRemovedFromGroup?: boolean
  removedParticipantIds?: string[]
}

export async function searchUsers(q: string): Promise<SearchUser[]> {
  const res = await fetch(`${env.apiUrl}/users/search?q=${encodeURIComponent(q)}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Error al buscar')
  return res.json()
}

export async function getContacts(): Promise<ContactsData> {
  const res = await fetch(`${env.apiUrl}/contacts`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Error al cargar contactos')
  return res.json()
}

export async function sendContactRequest(addresseeId: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${env.apiUrl}/contacts/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ addresseeId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al enviar solicitud')
  return data
}

export async function acceptOrRejectRequest(requestId: string, action: 'accept' | 'reject'): Promise<void> {
  const res = await fetch(`${env.apiUrl}/contacts/request/${requestId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ action }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Error al procesar')
  }
}

export interface ConversationListItemWithBlocked extends ConversationListItem {
  isBlocked?: boolean
}

export async function getConversations(): Promise<ConversationListItemWithBlocked[]> {
  const res = await fetch(`${env.apiUrl}/conversations`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Error al cargar conversaciones')
  return res.json()
}

export async function getBlockedUserIds(): Promise<string[]> {
  const res = await fetch(`${env.apiUrl}/users/blocked`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function createDirectConversation(otherUserId: string): Promise<ConversationListItem> {
  const res = await fetch(`${env.apiUrl}/conversations/direct`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ otherUserId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al abrir conversación')
  return data
}

export async function createGroupConversation(name: string, participantIds: string[], image?: string | null): Promise<ConversationListItem> {
  const res = await fetch(`${env.apiUrl}/conversations/group`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, participantIds, image: image || undefined }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al crear grupo')
  return data
}

export async function updateGroupConversation(
  conversationId: string,
  updates: { name?: string; image?: string | null }
): Promise<{ name: string; image: string | null }> {
  const res = await fetch(`${env.apiUrl}/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al actualizar grupo')
  return data
}

export async function muteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`${env.apiUrl}/conversations/${conversationId}/mute`, { method: 'POST', headers: authHeaders() })
  if (!res.ok) throw new Error('Error al silenciar')
}

export async function unmuteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`${env.apiUrl}/conversations/${conversationId}/unmute`, { method: 'POST', headers: authHeaders() })
  if (!res.ok) throw new Error('Error al activar sonido')
}

export interface MeProfile {
  id: string
  name: string
  nickname?: string | null
  email: string
  avatar?: string | null
  status?: string | null
}

export async function updateMe(updates: { nickname?: string | null; avatar?: string | null; status?: string | null }): Promise<MeProfile> {
  const res = await fetch(`${env.apiUrl}/users/me`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al actualizar')
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

export async function deleteMessage(
  messageId: string,
  scope: 'for_me' | 'for_everyone'
): Promise<{ messageId: string; chatId: string; scope: string }> {
  const res = await fetch(`${env.apiUrl}/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ scope }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al eliminar')
  return data
}

export async function clearConversation(conversationId: string): Promise<{ chatId: string; modifiedCount: number }> {
  const res = await fetch(`${env.apiUrl}/conversations/${conversationId}/clear`, { method: 'POST', headers: authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al borrar conversación')
  return data
}

export async function addGroupParticipant(conversationId: string, userId: string): Promise<{ ok: boolean; conversationId: string }> {
  const res = await fetch(`${env.apiUrl}/conversations/${conversationId}/participants`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al añadir participante')
  return data
}

export async function removeGroupParticipant(conversationId: string, userId: string): Promise<{ ok: boolean; conversationId: string }> {
  const res = await fetch(`${env.apiUrl}/conversations/${conversationId}/participants/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al eliminar participante')
  return data
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const headers: HeadersInit = {}
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  const res = await fetch(`${env.apiUrl}/upload`, {
    method: 'POST',
    headers,
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al subir imagen')
  return data.url
}

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const headers: HeadersInit = {}
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  const res = await fetch(`${env.apiUrl}/upload`, {
    method: 'POST',
    headers,
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al subir archivo')
  return data.url
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

/** Solicita un correo de recuperación de contraseña. No requiere autenticación. */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch(`${env.apiUrl}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al solicitar recuperación')
  return data
}

/** Restablece la contraseña con el token recibido por email. No requiere autenticación. */
export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${env.apiUrl}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token.trim(), newPassword }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al restablecer contraseña')
  return data
}

/** Invalida el token actual en el servidor (blacklist). Llamar antes de limpiar el estado local. */
export async function logout(): Promise<void> {
  const res = await fetch(`${env.apiUrl}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Error al cerrar sesión')
  }
}
