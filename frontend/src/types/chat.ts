/**
 * Tipos para BitChat.
 * Usaremos estos en el estado del frontend y luego los alinearemos con el backend.
 */

export interface User {
  id: string
  name: string
  avatar?: string
}

export interface Message {
  id: string
  text: string
  senderId: string
  senderName: string
  timestamp: number
  /** true = enviado por el usuario actual */
  isOwn?: boolean
}

export interface Chat {
  id: string
  /** En un chat 1-a-1, el otro usuario; en grupo, nombre del grupo */
  name: string
  avatar?: string
  image?: string | null
  /** Solo en chat directo: id del otro usuario (para bloquear, etc.) */
  otherUserId?: string
  /** Solo en chat directo: si el usuario actual tiene bloqueado al otro */
  isBlocked?: boolean
  isPinned?: boolean
  isArchived?: boolean
  lastMessage?: string
  lastMessageTime?: number
  unread?: number
  /** Mensajes de la conversación (se cargan al abrir el chat) */
  messages: Message[]
}
