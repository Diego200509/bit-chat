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

  // Conexión y registro del usuario
  useEffect(() => {
    const onConnect = () => {
      setConnected(true)
      socket.emit(SOCKET_EVENTS.SET_USER, { userId, userName })
    }
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [userId, userName])

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
