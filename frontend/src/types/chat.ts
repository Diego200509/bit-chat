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
  senderAvatar?: string | null
  timestamp: number
  isOwn?: boolean
  deletedForEveryone?: boolean
  deletedByUserId?: string
}

export interface Chat {
  id: string
  name: string
  avatar?: string
  image?: string | null
  otherUserId?: string
  otherUserLastSeen?: number | null
  isBlocked?: boolean
  isPinned?: boolean
  isArchived?: boolean
  participants?: Array<{ id: string; name: string }>
  lastMessage?: string
  lastMessageTime?: number
  unread?: number
  chatBackground?: string | null
  messages: Message[]
}
