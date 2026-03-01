import { useState, useCallback, useEffect, useRef } from 'react'
import { socket } from '../lib/socket'
import { SOCKET_EVENTS } from '../constants/socket'
import * as api from '../lib/api'
import type { Chat, Message } from '../types/chat'
import type { SocketMessage } from '../types/socket'

const DEFAULT_USER_ID = 'user-1'
const DEFAULT_USER_NAME = 'Yo'

function listItemToChat(item: api.ChatListItem & { isBlocked?: boolean }): Chat {
  return {
    id: item.id,
    name: item.name,
    otherUserId: item.otherUserId,
    isBlocked: item.isBlocked,
    isPinned: item.isPinned,
    isArchived: item.isArchived,
    image: item.image,
    lastMessage: item.lastMessage,
    lastMessageTime: item.lastMessageTime ?? undefined,
    messages: [],
  }
}

/**
 * Hook que encapsula el estado del chat y la lógica de Socket.io.
 * Carga la lista de chats desde la API y permite abrir chat directo.
 */
export function useChat(userId = DEFAULT_USER_ID, userName = DEFAULT_USER_NAME) {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [chatsLoading, setChatsLoading] = useState(true)
  const [connected, setConnected] = useState(socket.connected)
  const prevChatIdRef = useRef<string | null>(null)

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

  // Entrar/salir de la sala del chat seleccionado
  useEffect(() => {
    if (prevChatIdRef.current) {
      socket.emit(SOCKET_EVENTS.LEAVE_CHAT, prevChatIdRef.current)
    }
    if (currentChatId) {
      socket.emit(SOCKET_EVENTS.JOIN_CHAT, currentChatId)
      prevChatIdRef.current = currentChatId
    } else {
      prevChatIdRef.current = null
    }
  }, [currentChatId])

  // Historial al abrir un chat (desde MongoDB)
  useEffect(() => {
    const onHistory = ({
      chatId,
      messages,
    }: {
      chatId: string
      messages: Array<{ id: string; text: string; senderId: string | null; senderName: string; timestamp: number }>
    }) => {
      const normalized: Message[] = messages.map((m) => ({
        id: m.id,
        text: m.text,
        senderId: m.senderId ?? '',
        senderName: m.senderName ?? 'Anónimo',
        timestamp: m.timestamp,
      }))
      setChats((prev) => {
        const existing = prev.find((c) => c.id === chatId)
        if (!existing) return prev
        const last = normalized[normalized.length - 1]
        return prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: normalized,
                lastMessage: last?.text,
                lastMessageTime: last?.timestamp,
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

  // Recibir mensajes en tiempo real
  useEffect(() => {
    const onMessage = (msg: SocketMessage) => {
      const message: Message = {
        id: msg.id,
        text: msg.text,
        senderId: msg.senderId,
        senderName: msg.senderName,
        timestamp: msg.timestamp,
      }
      setChats((prev) => {
        const existing = prev.find((c) => c.id === msg.chatId)
        if (existing) {
          if (existing.messages.some((m) => m.id === msg.id)) return prev
          return prev.map((c) =>
            c.id === msg.chatId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  lastMessage: msg.text,
                  lastMessageTime: msg.timestamp,
                }
              : c
          )
        }
        const newChat: Chat = {
          id: msg.chatId,
          name: msg.senderId === userId ? userName : msg.senderName,
          lastMessage: msg.text,
          lastMessageTime: msg.timestamp,
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

  const selectChat = useCallback((chatId: string | null) => {
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
        senderId: userId,
        senderName: userName,
      })
    },
    [currentChatId, userId, userName]
  )

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
    openDirectChat,
    removeChat,
    refreshChats,
    pinChat,
    unpinChat,
    archiveChat,
    unarchiveChat,
    createGroupAndSelect,
  }
}
