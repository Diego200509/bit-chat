import { useRef, useEffect } from 'react'
import type { Chat } from '../types/chat'
import { Message } from './Message'
import { MessageInput } from './MessageInput'

interface ChatWindowProps {
  chat: Chat | null
  onSendMessage: (text: string) => void
  /** Id del usuario actual para marcar isOwn en los mensajes */
  currentUserId: string
}

/**
 * Ventana de conversación: cabecera, lista de mensajes y input.
 */
export function ChatWindow({
  chat,
  onSendMessage,
  currentUserId,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages])

  if (!chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bitchat-bg text-slate-500">
        <div className="w-16 h-16 rounded-full bg-bitchat-cyan/20 flex items-center justify-center text-bitchat-cyan mb-4">
          <ChatIcon />
        </div>
        <p className="text-sm">Selecciona una conversación o espera a que alguien te escriba</p>
      </div>
    )
  }

  const messagesWithOwn = chat.messages.map((m) => ({
    ...m,
    isOwn: m.senderId === currentUserId,
  }))

  return (
    <div className="flex-1 flex flex-col bg-bitchat-bg min-w-0">
      {/* Cabecera del chat */}
      <header className="flex items-center gap-3 p-4 border-b border-bitchat-border bg-bitchat-panel flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-bitchat-blue-dark flex items-center justify-center text-bitchat-cyan font-semibold">
          {chat.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-100 truncate">{chat.name}</h2>
          <p className="text-xs text-slate-500">BitChat</p>
        </div>
      </header>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto p-4">
        {messagesWithOwn.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de envío */}
      <MessageInput onSend={onSendMessage} />
    </div>
  )
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-8 h-8"
    >
      <path
        fillRule="evenodd"
        d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 4.083 2.764a.75.75 0 0 1 .98 1.129l-.354.354a.75.75 0 0 1-1.154-.114 47.37 47.37 0 0 0-7.996-.98.75.75 0 0 1-.53-.22 11.25 11.25 0 0 0-15.785 0 .75.75 0 0 1-.53.22 47.368 47.368 0 0 0-7.996.98.75.75 0 0 1-1.154.114l-.354-.354a.75.75 0 0 1 .98-1.129c.735-.74 2.105-2.472 4.083-2.764Z"
        clipRule="evenodd"
      />
    </svg>
  )
}
