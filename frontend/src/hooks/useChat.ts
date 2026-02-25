import { useState, useCallback, useEffect, useRef } from 'react'
import { socket } from '../lib/socket'
import { SOCKET_EVENTS } from '../constants/socket'
import type { Chat, Message } from '../types/chat'
import type { SocketMessage } from '../types/socket'

const DEFAULT_USER_ID = 'user-1'
const DEFAULT_USER_NAME = 'Yo'

const INITIAL_CHATS: Chat[] = [
  { id: 'chat-1', name: 'General', messages: [] },
]

/**
 * Hook que encapsula el estado del chat y la lógica de Socket.io.
 * Escalable: aquí se puede añadir persistencia, optimistic updates, etc.
 */
export function useChat(userId = DEFAULT_USER_ID, userName = DEFAULT_USER_NAME) {
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS)
  const [currentChatId, setCurrentChatId] = useState<string | null>('chat-1')
  const [connected, setConnected] = useState(socket.connected)
  const prevChatIdRef = useRef<string | null>(null)

  const currentChat = currentChatId
    ? chats.find((c) => c.id === currentChatId) ?? null
    : null

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

  const selectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId)
  }, [])

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
    connected,
    currentUserId: userId,
    currentUserName: userName,
    selectChat,
    sendMessage,
  }
}
