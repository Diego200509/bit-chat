import { useState, useCallback, useEffect, useRef } from 'react'
import { ChatList } from './components/ChatList'
import { ChatWindow } from './components/ChatWindow'
import { socket } from './lib/socket'
import type { Chat, Message } from './types/chat'

const CURRENT_USER_ID = 'user-1'
const CURRENT_USER_NAME = 'Yo'

/** Mensaje que llega por Socket (incluye chatId) */
interface SocketMessage {
  id: string
  chatId: string
  text: string
  senderId: string
  senderName: string
  timestamp: number
}

function createInitialChats(): Chat[] {
  return [{ id: 'chat-1', name: 'General', messages: [] }]
}

function App() {
  const [chats, setChats] = useState<Chat[]>(createInitialChats)
  const [currentChatId, setCurrentChatId] = useState<string | null>('chat-1')
  const [connected, setConnected] = useState(socket.connected)
  const prevChatIdRef = useRef<string | null>(null)

  const currentChat = currentChatId
    ? chats.find((c) => c.id === currentChatId) ?? null
    : null

  // Conexión y registro del usuario
  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true)
      socket.emit('set_user', { userId: CURRENT_USER_ID, userName: CURRENT_USER_NAME })
    })
    socket.on('disconnect', () => setConnected(false))
    return () => {
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  // Entrar/salir de la sala del chat seleccionado
  useEffect(() => {
    if (prevChatIdRef.current) {
      socket.emit('leave_chat', prevChatIdRef.current)
    }
    if (currentChatId) {
      socket.emit('join_chat', currentChatId)
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
          name: msg.senderId === CURRENT_USER_ID ? 'Yo' : msg.senderName,
          lastMessage: msg.text,
          lastMessageTime: msg.timestamp,
          messages: [message],
        }
        return [newChat, ...prev]
      })
      // Si el mensaje es de otro y no estamos en ese chat, podríamos marcar unread
    }
    socket.on('new_message', onMessage)
    return () => {
      socket.off('new_message', onMessage)
    }
  }, [])

  const handleSelectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId)
  }, [])

  const handleSendMessage = useCallback(
    (text: string) => {
      if (!currentChatId) return
      socket.emit('send_message', {
        chatId: currentChatId,
        text,
        senderId: CURRENT_USER_ID,
        senderName: CURRENT_USER_NAME,
      })
      // El mensaje se añadirá al estado cuando llegue 'new_message' del servidor
    },
    [currentChatId]
  )

  return (
    <div className="h-screen flex bg-bitchat-bg text-slate-100">
      <ChatList
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        currentUserName={CURRENT_USER_NAME}
      />
      <ChatWindow
        chat={currentChat}
        onSendMessage={handleSendMessage}
        currentUserId={CURRENT_USER_ID}
      />
      {!connected && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded-lg bg-amber-600/90 text-white text-sm">
          Reconectando…
        </div>
      )}
    </div>
  )
}

export default App
