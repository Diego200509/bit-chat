/**
 * Tipos para BitChat.
 * Usaremos estos en el estado del frontend y luego los alinearemos con el backend.
 */

export interface User {
  id: string
  name: string
  avatar?: string
}

export interface MessageReaction {
  userId: string
  emoji: string
}

export interface Message {
  id: string
  text: string
  type?: 'text' | 'image' | 'sticker' | 'emoji'
  imageUrl?: string | null
  stickerUrl?: string | null
  editedAt?: number | null
  readBy?: string[]
  pinned?: boolean
  reactions?: MessageReaction[]
  senderId: string
  senderName: string
  /** URL o path de la foto de perfil del remitente (para mostrar junto al mensaje) */
  senderAvatar?: string | null
  timestamp: number
  /** true = enviado por el usuario actual */
  isOwn?: boolean
  /** Mensaje borrado para todos; se muestra placeholder con texto "Eliminaste este mensaje" / "Este mensaje fue eliminado" */
  deletedForEveryone?: boolean
  /** Id del usuario que eliminó (para mostrar "Eliminaste este mensaje" vs "Este mensaje fue eliminado") */
  deletedByUserId?: string
}

export interface Chat {
  id: string
  /** En un chat 1-a-1, el otro usuario; en grupo, nombre del grupo */
  name: string
  avatar?: string
  image?: string | null
  /** Solo en chat directo: id del otro usuario (para bloquear, etc.) */
  otherUserId?: string
  /** Solo en chat directo: timestamp de última vez visto (para "Última vez...") */
  otherUserLastSeen?: number | null
  /** Solo en chat directo: si el usuario actual tiene bloqueado al otro */
  isBlocked?: boolean
  isPinned?: boolean
  isArchived?: boolean
  /** Solo en grupo: participantes con id y nombre (para "X, Y en línea") */
  participants?: Array<{ id: string; name: string }>
  lastMessage?: string
  lastMessageTime?: number
  unread?: number
  /** Fondo del chat (URL o clave de preset) */
  chatBackground?: string | null
  /** Mensajes de la conversación (se cargan al abrir el chat) */
  messages: Message[]
}
