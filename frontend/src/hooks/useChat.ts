import { useState, useCallback, useEffect, useRef } from 'react'
import { socket } from '../lib/socket'
import { SOCKET_EVENTS } from '../constants/socket'
import * as api from '../lib/api'
import type { Chat, Message } from '../types/chat'
import type { SocketMessage } from '../types/socket'

const DEFAULT_USER_ID = 'user-1'
const DEFAULT_USER_NAME = 'Yo'

function listItemToChat(item: api.ChatListItem & { isBlocked?: boolean; unread?: number }): Chat {
  return {
    id: item.id,
    name: item.name,
    otherUserId: item.otherUserId,
    isBlocked: item.isBlocked,
    isPinned: item.isPinned,
    isArchived: item.isArchived,
    avatar: item.avatar ?? null,
    image: item.image,
    otherUserLastSeen: item.otherUserLastSeen ?? null,
    participants: item.participants,
    chatBackground: item.chatBackground ?? null,
    lastMessage: item.lastMessage,
    lastMessageTime: item.lastMessageTime ?? undefined,
    unread: item.unread ?? 0,
    messages: [],
  }
}

export interface UseChatOptions {
  /** Solo cuando devuelve true se marcará el chat como leído al recibir mensajes (p. ej. cuando el panel de chat está visible, no en lista móvil). */
  getIsChatPanelVisible?: () => boolean
}

/**
 * Hook que encapsula el estado del chat y la lógica de Socket.io.
 * Carga la lista de chats desde la API y permite abrir chat directo.
 */
export function useChat(userId = DEFAULT_USER_ID, userName = DEFAULT_USER_NAME, options: UseChatOptions = {}) {
  const { getIsChatPanelVisible } = options
  const getIsChatPanelVisibleRef = useRef(getIsChatPanelVisible)
  getIsChatPanelVisibleRef.current = getIsChatPanelVisible
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [chatsLoading, setChatsLoading] = useState(true)
  const [connected, setConnected] = useState(socket.connected)
  const prevChatIdRef = useRef<string | null>(null)
  const currentChatIdRef = useRef<string | null>(currentChatId)
  currentChatIdRef.current = currentChatId

  const currentChat = currentChatId
    ? chats.find((c) => c.id === currentChatId) ?? null
    : null

  // Cargar lista de chats desde la API al montar (usuario autenticado)
  useEffect(() => {
    let cancelled = false
    api
      .getChats()
      .then((list) => {
        if (cancelled) return
        const next = list.map(listItemToChat)
        setChats(next)
        if (next.length > 0 && !currentChatId) setCurrentChatId(next[0].id)
      })
      .catch(() => {
        if (!cancelled) setChats([{ id: 'chat-1', name: 'General', messages: [] }])
        if (!cancelled && !currentChatId) setCurrentChatId('chat-1')
      })
      .finally(() => {
        if (!cancelled) setChatsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Conexión: el usuario ya viene del JWT en el backend (auth en handshake)
  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  // Actualizar "última vez" cuando alguien se desconecta
  useEffect(() => {
    const onLastSeen = (payload: { userId?: string; lastSeenAt?: number }) => {
      const { userId: uId, lastSeenAt } = payload
      if (!uId || lastSeenAt == null) return
      setChats((prev) =>
        prev.map((c) => (c.otherUserId === uId ? { ...c, otherUserLastSeen: lastSeenAt } : c))
      )
    }
    socket.on(SOCKET_EVENTS.USER_LAST_SEEN_UPDATED, onLastSeen)
    return () => {
      socket.off(SOCKET_EVENTS.USER_LAST_SEEN_UPDATED, onLastSeen)
    }
  }, [])

  // Unirse a las salas de todos los chats para recibir NEW_MESSAGE en tiempo real (lista + unread)
  useEffect(() => {
    if (chats.length === 0) return
    const chatIds = chats.map((c) => c.id)
    socket.emit(SOCKET_EVENTS.JOIN_CHAT_ROOMS, chatIds)
  }, [chats])

  // Al abrir un chat: pedir historial y marcar como leído
  useEffect(() => {
    if (currentChatId) {
      socket.emit(SOCKET_EVENTS.JOIN_CHAT, currentChatId)
      prevChatIdRef.current = currentChatId
    } else {
      prevChatIdRef.current = null
    }
  }, [currentChatId])

  function normalizeMessage(m: {
        id: string
        text?: string
        type?: string
        imageUrl?: string | null
        stickerUrl?: string | null
        editedAt?: number | null
        readBy?: string[]
        pinned?: boolean
        reactions?: Array<{ userId: string; emoji: string }>
        senderId?: string | null
        senderName?: string
        senderAvatar?: string | null
        timestamp: number
      }): Message {
    return {
      id: m.id,
      text: m.text ?? '',
      type: (m.type as Message['type']) || 'text',
      imageUrl: m.imageUrl ?? null,
      stickerUrl: m.stickerUrl ?? null,
      editedAt: m.editedAt ?? null,
      readBy: m.readBy ?? [],
      pinned: m.pinned ?? false,
      reactions: m.reactions ?? [],
      senderId: m.senderId ?? '',
      senderName: m.senderName ?? 'Anónimo',
      senderAvatar: m.senderAvatar ?? null,
      timestamp: m.timestamp,
    }
  }

  // Historial al abrir un chat (desde MongoDB)
  useEffect(() => {
    const onHistory = ({
      chatId,
      messages,
    }: {
      chatId: string
      messages: Array<{
        id: string
        text?: string
        type?: string
        imageUrl?: string | null
        stickerUrl?: string | null
        editedAt?: number | null
        readBy?: string[]
        pinned?: boolean
        reactions?: Array<{ userId: string; emoji: string }>
        senderId: string | null
        senderName: string
        timestamp: number
      }>
    }) => {
      const normalized: Message[] = messages.map((m) => normalizeMessage(m))
      const last = normalized[normalized.length - 1]
      const lastPreview = last
        ? (last.text?.trim() || (last.type === 'image' ? 'Imagen' : last.type === 'sticker' ? 'Sticker' : ''))
        : ''
      setChats((prev) => {
        const existing = prev.find((c) => c.id === chatId)
        if (!existing) return prev
        return prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: normalized,
                lastMessage: lastPreview || c.lastMessage,
                lastMessageTime: last?.timestamp ?? c.lastMessageTime,
                unread: 0,
              }
            : c
        )
      })
    }
    socket.on(SOCKET_EVENTS.CHAT_HISTORY, onHistory)
    return () => {
      socket.off(SOCKET_EVENTS.CHAT_HISTORY, onHistory)
    }
  }, [])

  // Recibir mensajes en tiempo real: actualizar lista (lastMessage, unread) y marcar visto si estás en el chat
  useEffect(() => {
    const onMessage = (msg: SocketMessage & { type?: string; imageUrl?: string | null; stickerUrl?: string | null; editedAt?: number | null; readBy?: string[]; pinned?: boolean; reactions?: Array<{ userId: string; emoji: string }> }) => {
      const message: Message = normalizeMessage({
        id: msg.id,
        text: msg.text,
        type: msg.type,
        imageUrl: msg.imageUrl,
        stickerUrl: msg.stickerUrl,
        editedAt: msg.editedAt,
        readBy: msg.readBy,
        pinned: msg.pinned,
        reactions: msg.reactions,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderAvatar: (msg as { senderAvatar?: string | null }).senderAvatar,
        timestamp: msg.timestamp,
      })
      const lastMessagePreview =
        (msg.text && msg.text.trim()) ||
        (msg.type === 'image' ? 'Imagen' : msg.type === 'sticker' ? 'Sticker' : '')
      const isInThisChat = currentChatIdRef.current === msg.chatId
      const isPanelVisible = !getIsChatPanelVisibleRef.current || getIsChatPanelVisibleRef.current()
      if (isInThisChat && isPanelVisible) {
        socket.emit(SOCKET_EVENTS.MARK_CHAT_READ, msg.chatId)
      }
      setChats((prev) => {
        const existing = prev.find((c) => c.id === msg.chatId)
        const unreadDelta = isInThisChat ? 0 : 1
        if (existing) {
          if (existing.messages.some((m) => m.id === msg.id)) {
            return prev.map((c) =>
              c.id === msg.chatId
                ? { ...c, lastMessage: lastMessagePreview || c.lastMessage, lastMessageTime: msg.timestamp }
                : c
            )
          }
          return prev.map((c) =>
            c.id === msg.chatId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  lastMessage: lastMessagePreview || c.lastMessage,
                  lastMessageTime: msg.timestamp,
                  unread: isInThisChat ? 0 : (c.unread ?? 0) + 1,
                }
              : c
          )
        }
        const newChat: Chat = {
          id: msg.chatId,
          name: msg.senderId === userId ? userName : msg.senderName,
          lastMessage: lastMessagePreview,
          lastMessageTime: msg.timestamp,
          unread: unreadDelta,
          messages: [message],
        }
        return [newChat, ...prev]
      })
    }
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, onMessage)
    return () => {
      socket.off(SOCKET_EVENTS.NEW_MESSAGE, onMessage)
    }
  }, [userId, userName])

  // Actualizar mensaje (reacciones, edición, fijado, leído)
  useEffect(() => {
    const onUpdated = (updated: {
      id: string
      chatId: string
      text?: string
      editedAt?: number | null
      readBy?: string[]
      pinned?: boolean
      reactions?: Array<{ userId: string; emoji: string }>
    }) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== updated.chatId) return c
          const next = c.messages.map((m) =>
            m.id === updated.id
              ? {
                  ...m,
                  ...(updated.text !== undefined && { text: updated.text }),
                  ...(updated.editedAt !== undefined && { editedAt: updated.editedAt }),
                  ...(updated.readBy !== undefined && { readBy: updated.readBy }),
                  ...(updated.pinned !== undefined && { pinned: updated.pinned }),
                  ...(updated.reactions !== undefined && { reactions: updated.reactions }),
                }
              : m
          )
          next.sort((a, b) => (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1) || (a.timestamp - b.timestamp))
          return { ...c, messages: next }
        })
      )
    }
    socket.on(SOCKET_EVENTS.MESSAGE_UPDATED, onUpdated)
    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_UPDATED, onUpdated)
    }
  }, [])

  const selectChat = useCallback((chatId: string | null) => {
    if (chatId) {
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)))
    }
    setCurrentChatId(chatId)
  }, [])

  const removeChat = useCallback((chatId: string) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId))
    setCurrentChatId((curr) => (curr === chatId ? null : curr))
  }, [])

  const openDirectChat = useCallback(async (otherUserId: string) => {
    try {
      const item = await api.createDirectChat(otherUserId)
      setChats((prev) => {
        const asChat = listItemToChat(item)
        const found = prev.some((c) => c.id === asChat.id)
        if (found) return prev.map((c) => (c.id === asChat.id ? { ...c, name: asChat.name } : c))
        return [asChat, ...prev]
      })
      setCurrentChatId(item.id)
    } catch {
      // error ya mostrado por quien llame
    }
  }, [])

  const refreshChats = useCallback(async () => {
    try {
      const list = await api.getChats()
      setChats(list.map(listItemToChat))
    } catch {
      // keep current list
    }
  }, [])

  const sortChats = useCallback((list: Chat[]) => {
    return [...list].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
    })
  }, [])

  const pinChat = useCallback(async (chatId: string) => {
    try {
      await api.pinChat(chatId)
      setChats((prev) => sortChats(prev.map((c) => (c.id === chatId ? { ...c, isPinned: true } : c))))
    } catch {
      // error handled by caller
    }
  }, [sortChats])

  const unpinChat = useCallback(async (chatId: string) => {
    try {
      await api.unpinChat(chatId)
      setChats((prev) => sortChats(prev.map((c) => (c.id === chatId ? { ...c, isPinned: false } : c))))
    } catch {
      // error handled by caller
    }
  }, [sortChats])

  const archiveChat = useCallback(async (chatId: string) => {
    try {
      await api.archiveChat(chatId)
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, isArchived: true } : c)))
    } catch {
      // error handled by caller
    }
  }, [])

  const unarchiveChat = useCallback(async (chatId: string) => {
    try {
      await api.unarchiveChat(chatId)
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, isArchived: false } : c)))
    } catch {
      // error handled by caller
    }
  }, [])

  const createGroupAndSelect = useCallback(async (name: string, participantIds: string[], image?: string | null) => {
    try {
      const item = await api.createGroupChat(name, participantIds, image)
      await refreshChats()
      setCurrentChatId(item.id)
    } catch {
      throw new Error('Error al crear grupo')
    }
  }, [refreshChats])

  const sendMessage = useCallback(
    (text: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        chatId: currentChatId,
        text,
        type: 'text',
        senderId: userId,
        senderName: userName,
      })
    },
    [currentChatId, userId, userName]
  )

  const sendImage = useCallback(
    (imageUrl: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        chatId: currentChatId,
        text: '',
        type: 'image',
        imageUrl,
        senderId: userId,
        senderName: userName,
      })
    },
    [currentChatId, userId, userName]
  )

  const sendSticker = useCallback(
    (stickerUrl: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        chatId: currentChatId,
        text: '',
        type: 'sticker',
        stickerUrl,
        senderId: userId,
        senderName: userName,
      })
    },
    [currentChatId, userId, userName]
  )

  const addReaction = useCallback((messageId: string, emoji: string) => {
    if (!currentChatId) return
    socket.emit(SOCKET_EVENTS.REACT_TO_MESSAGE, { messageId, chatId: currentChatId, emoji })
  }, [currentChatId])

  const editMessage = useCallback(
    (messageId: string, text: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.EDIT_MESSAGE, { messageId, chatId: currentChatId, text })
    },
    [currentChatId]
  )

  const pinMessage = useCallback(
    (messageId: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.PIN_MESSAGE, { messageId, chatId: currentChatId })
    },
    [currentChatId]
  )

  const unpinMessage = useCallback(
    (messageId: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.UNPIN_MESSAGE, { messageId, chatId: currentChatId })
    },
    [currentChatId]
  )

  const updateChatBackground = useCallback(async (chatId: string, chatBackground: string | null) => {
    try {
      await api.updateChatBackground(chatId, chatBackground)
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, chatBackground } : c)))
    } catch {
      // error handled by caller
    }
  }, [])

  return {
    chats,
    currentChatId,
    currentChat,
    chatsLoading,
    connected,
    currentUserId: userId,
    currentUserName: userName,
    selectChat,
    sendMessage,
    sendImage,
    sendSticker,
    addReaction,
    editMessage,
    pinMessage,
    unpinMessage,
    openDirectChat,
    removeChat,
    refreshChats,
    pinChat,
    unpinChat,
    archiveChat,
    unarchiveChat,
    createGroupAndSelect,
    updateChatBackground,
  }
}
