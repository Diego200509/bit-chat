export interface User {
  id: string
  name: string
  avatar?: string
}

export interface MessageReaction {
  userId: string
  emoji: string
}

export interface LinkPreview {
  url: string | null
  title: string | null
  description: string | null
  imageUrl: string | null
}

export interface Message {
  id: string
  text: string
  type?: 'text' | 'image' | 'sticker' | 'emoji' | 'document' | 'voice'
  imageUrl?: string | null
  stickerUrl?: string | null
  documentUrl?: string | null
  voiceUrl?: string | null
  linkPreview?: LinkPreview | null
  editedAt?: number | null
  deliveredBy?: string[]
  readBy?: string[]
  pinned?: boolean
  reactions?: MessageReaction[]
  senderId: string
  senderName: string
  senderAvatar?: string | null
  timestamp: number
  isOwn?: boolean
  deletedForEveryone?: boolean
  deletedByUserId?: string
}

export interface Conversation {
  id: string
  name: string
  avatar?: string
  image?: string | null
  otherUserId?: string
  otherUserLastSeen?: number | null
  otherUserStatus?: string | null
  isBlocked?: boolean
  isPinned?: boolean
  isMuted?: boolean
  participants?: Array<{ id: string; name: string }>
  /** Solo en grupos: IDs de administradores. Quien crea el grupo es admin implícito. */
  adminIds?: string[]
  /** Solo en grupos: true si el usuario actual es administrador (puede añadir/eliminar participantes). */
  isGroupAdmin?: boolean
  /** Solo en grupos: true si te eliminaron del grupo; sigues viendo el chat pero no puedes escribir hasta que un admin te reincorpore. */
  isRemovedFromGroup?: boolean
  /** Solo en grupos: IDs de usuarios eliminados (ven el chat pero no pueden escribir). */
  removedParticipantIds?: string[]
  lastMessage?: string
  lastMessageTime?: number
  lastMessageSenderId?: string | null
  lastMessageDeliveredBy?: string[]
  lastMessageReadBy?: string[]
  unread?: number
  messages: Message[]
}
