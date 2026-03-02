import { useRef, useEffect, useState, useCallback } from 'react'
import type { Chat } from '../../types/chat'
import { Message } from './Message'
import { MessageInput } from './MessageInput'

interface ChatWindowProps {
  chat: Chat | null
  onSendMessage: (text: string) => void
  onSendImage?: (url: string) => void
  onSendSticker?: (url: string) => void
  onReaction?: (messageId: string, emoji: string) => void
  onEditMessage?: (messageId: string, text: string) => void
  onPinMessage?: (messageId: string) => void
  onUnpinMessage?: (messageId: string) => void
  currentUserId: string
  onBack?: () => void
  onBlockUser?: (userId: string) => void
  onUnblockUser?: (userId: string) => void
  blockedUserIds?: string[]
}

/**
 * Ventana de conversación: cabecera, lista de mensajes y input.
 */
export function ChatWindow({
  chat,
  onSendMessage,
  onSendImage,
  onSendSticker,
  onReaction,
  onEditMessage,
  onPinMessage,
  onUnpinMessage,
  currentUserId,
  onBack,
  onBlockUser,
  onUnblockUser,
  blockedUserIds = [],
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  const scrollToMessage = useCallback((messageId: string) => {
    const container = messagesContainerRef.current
    const messageEl = document.getElementById(`msg-${messageId}`)
    if (!container || !messageEl) return
    const containerRect = container.getBoundingClientRect()
    const msgRect = messageEl.getBoundingClientRect()
    const relativeTop = msgRect.top - containerRect.top + container.scrollTop
    const scrollTo = relativeTop - container.clientHeight / 2 + msgRect.height / 2
    container.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' })
    setHighlightedMessageId(messageId)
    setTimeout(() => setHighlightedMessageId(null), 2500)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages])

  if (!chat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bitchat-bg px-4 text-center text-slate-500">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bitchat-cyan/20 text-bitchat-cyan sm:h-16 sm:w-16">
          <ChatIcon />
        </div>
        <p className="text-sm sm:text-base">Selecciona una conversación o espera a que alguien te escriba</p>
      </div>
    )
  }

  const messagesWithOwn = chat.messages.map((m) => ({
    ...m,
    isOwn: m.senderId === currentUserId,
  }))
  const pinned = messagesWithOwn.filter((m) => m.pinned)
  // Orden cronológico para que el mensaje fijado aparezca en su posición real del historial
  const messagesChronological = [...messagesWithOwn].sort((a, b) => a.timestamp - b.timestamp)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bitchat-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-bitchat-border bg-bitchat-panel p-3 safe-t md:p-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-bitchat-sidebar hover:text-slate-100 active:opacity-80 md:hidden touch-manipulation"
            aria-label="Volver a conversaciones"
          >
            <BackIcon />
          </button>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bitchat-blue-dark text-bitchat-cyan font-semibold">
          {chat.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-slate-100">{chat.name}</h2>
          <p className="text-xs text-slate-500">BitChat</p>
        </div>
        {chat.otherUserId && (onBlockUser || onUnblockUser) && (
          <BlockUnblockButton
            otherUserId={chat.otherUserId}
            blockedUserIds={blockedUserIds}
            onBlock={onBlockUser}
            onUnblock={onUnblockUser}
          />
        )}
      </header>

      {pinned.length > 0 && (() => {
        const msg = pinned[0]
        const preview = (msg.type === 'image' ? 'Imagen' : msg.type === 'sticker' ? 'Sticker' : (msg.text || '').trim()) || 'Mensaje'
        const previewShort = preview.length > 40 ? preview.slice(0, 40) + '…' : preview
        return (
          <div className="flex shrink-0 items-center gap-2 border-b border-bitchat-border bg-bitchat-sidebar/80 px-3 py-1.5 md:px-4">
            <span className="flex-shrink-0 text-bitchat-cyan" aria-hidden>
              <PinIcon className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={() => scrollToMessage(msg.id)}
              className="min-w-0 flex-1 text-left text-sm text-slate-300 truncate hover:text-slate-100 hover:underline"
              title="Ir al mensaje"
            >
              {previewShort}
            </button>
            {onUnpinMessage && (
              <button
                type="button"
                onClick={() => onUnpinMessage(msg.id)}
                className="flex-shrink-0 rounded px-2 py-1 text-xs text-slate-400 hover:bg-bitchat-panel hover:text-slate-200"
                title="Desfijar mensaje"
              >
                Desfijar
              </button>
            )}
          </div>
        )
      })()}

      <div ref={messagesContainerRef} className="chat-messages-scroll min-h-0 flex-1 overflow-y-auto p-3 md:p-4 overscroll-behavior-contain">
        {messagesChronological.map((message) => (
          <div
            key={message.id}
            id={`msg-${message.id}`}
            className={`transition-[box-shadow] duration-300 ${highlightedMessageId === message.id ? 'rounded-xl ring-2 ring-bitchat-cyan ring-offset-2 ring-offset-bitchat-bg' : ''}`}
          >
            <Message
              message={message}
              currentUserId={currentUserId}
              onReaction={onReaction}
              onEditMessage={onEditMessage}
              onPinMessage={onPinMessage}
              onUnpinMessage={onUnpinMessage}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {chat.otherUserId && blockedUserIds.includes(chat.otherUserId) ? (
        <div className="border-t border-bitchat-border bg-bitchat-panel p-4 safe-b">
          <p className="text-center text-sm text-slate-400">
            Has bloqueado a este usuario. Desbloquea para enviar mensajes.
          </p>
        </div>
      ) : (
        <MessageInput
          onSend={onSendMessage}
          onSendImage={onSendImage}
          onSendSticker={onSendSticker}
        />
      )}
    </div>
  )
}

function BlockUnblockButton({
  otherUserId,
  blockedUserIds,
  onBlock,
  onUnblock,
}: {
  otherUserId: string
  blockedUserIds: string[]
  onBlock?: (userId: string) => void
  onUnblock?: (userId: string) => void
}) {
  const isBlocked = blockedUserIds.includes(otherUserId)
  return (
    <button
      type="button"
      onClick={() => (isBlocked ? onUnblock?.(otherUserId) : onBlock?.(otherUserId))}
      className={`rounded-lg p-2 transition-colors ${
        isBlocked
          ? 'text-slate-400 hover:bg-bitchat-sidebar hover:text-bitchat-cyan'
          : 'text-slate-400 hover:bg-bitchat-sidebar hover:text-red-400'
      }`}
      title={isBlocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
      aria-label={isBlocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
    >
      {isBlocked ? <UnblockIcon /> : <BlockIcon />}
    </button>
  )
}

function BlockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM3.75 12a8.25 8.25 0 0 1 14.39-5.28l-9.67 9.67A8.22 8.22 0 0 1 3.75 12Zm16.5 0a8.22 8.22 0 0 1-3.97 6.61l-9.67-9.67A8.25 8.25 0 0 1 20.25 12Z" clipRule="evenodd" />
    </svg>
  )
}

function UnblockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M15.75 1.5a6.75 6.75 0 0 0-6.651 7.906c.067.39.032.717.221 1.093l.873 2.717a.75.75 0 0 0 1.261.44l2.713-3.452a.75.75 0 0 0 .14-.494 6.75 6.75 0 0 0 1.343-10.21ZM12 15a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M16.5 3.75a3.75 3.75 0 0 0-2.25 6.72 3.75 3.75 0 0 0 1.5 2.28v7.5h3v-7.5a3.75 3.75 0 0 0 1.5-2.28 3.75 3.75 0 0 0-2.25-6.72ZM12 15a3 3 0 0 1-3-3V6a3 3 0 1 1 6 0v6a3 3 0 0 1-3 3Z" clipRule="evenodd" />
    </svg>
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
