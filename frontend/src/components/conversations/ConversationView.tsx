import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Conversation } from '../../types/conversation'
import { env } from '../../config/env'
import { socket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/socket'
import { startVideoCallRingtone } from '../../lib/videoCallRingtone'
import { ConfirmModal } from './ConfirmModal'
import { Message } from './Message'
import { MessageInput } from './MessageInput'

function makeVideoCallRoomName(): string {
  const part = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 10)
  return `talkapp-${part}-${Date.now()}`
}

function formatLastSeen(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const timeStr = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  if (dateOnly.getTime() === today.getTime()) {
    return timeStr
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return `ayer ${timeStr}`
  }
  const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays >= 1 && diffDays < 7) {
    return `${date.toLocaleDateString('es', { weekday: 'long' })} ${timeStr}`
  }
  if (diffDays >= 7 && diffDays < 365) {
    return `${date.toLocaleDateString('es', { day: 'numeric', month: 'short' })} ${timeStr}`
  }
  if (diffDays >= 365) {
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return `${date.toLocaleDateString('es', { day: 'numeric', month: 'short' })} ${timeStr}`
}

function getConversationHeaderSubtitle(
  conversation: Conversation,
  currentUserId: string,
  otherUserOnline: boolean | undefined,
  usersInCurrentConversation: string[]
): string {
  let line: string
  if (conversation.otherUserId != null) {
    if (otherUserOnline === true) line = 'En línea'
    else if (conversation.otherUserLastSeen != null) line = `Última actividad ${formatLastSeen(conversation.otherUserLastSeen)}`
    else line = 'Desconectado'
    const status = conversation.otherUserStatus?.trim()
    return status ? `${line} · ${status}` : line
  }
  if (conversation.participants && conversation.participants.length > 0) {
    if (conversation.isRemovedFromGroup) return 'No puedes escribir en este grupo'
    const total = conversation.participants.length
    const inConvSet = new Set(usersInCurrentConversation)
    const onlineInGroup = conversation.participants.filter(
      (p) => p.id !== currentUserId && inConvSet.has(p.id)
    )
    const membersLabel = total === 1 ? '1 miembro' : `${total} miembros`
    return `${membersLabel} · ${onlineInGroup.length} en línea`
  }
  return 'TalkApp'
}

interface ConversationViewProps {
  conversation: Conversation | null
  onSendMessage: (text: string) => void
  onSendImage?: (url: string) => void
  onSendDocument?: (url: string) => void
  onSendVoice?: (url: string) => void
  currentUserId: string
  onBack?: () => void
  onBlockUser?: (userId: string) => void
  onUnblockUser?: (userId: string) => void
  blockedUserIds?: string[]
  otherUserOnline?: boolean
  usersInCurrentConversation?: string[]
  onDeleteMessage?: (messageId: string, scope: 'for_me' | 'for_everyone') => void
  onClearConversation?: (conversationId: string) => void
  onGroupUpdated?: () => void
  onOpenManageGroup?: () => void
  currentUserName?: string
  currentUserAvatar?: string | null
}

export function ConversationView({
  conversation,
  onSendMessage,
  onSendImage,
  onSendDocument,
  onSendVoice,
  currentUserId,
  onBack,
  onBlockUser,
  onUnblockUser,
  blockedUserIds = [],
  otherUserOnline,
  usersInCurrentConversation = [],
  onDeleteMessage,
  onClearConversation,
  onOpenManageGroup,
  currentUserName = 'Yo',
  currentUserAvatar,
}: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [outgoingCall, setOutgoingCall] = useState<{ chatId: string; roomName: string } | null>(null)
  const [chatHeaderMenuOpen, setChatHeaderMenuOpen] = useState(false)
  const [chatHeaderMenuStyle, setChatHeaderMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([])
  const chatHeaderMenuRef = useRef<HTMLButtonElement>(null)
  const chatHeaderMenuDropdownRef = useRef<HTMLDivElement>(null)
  const outgoingCallRef = useRef(outgoingCall)
  const ringStopRef = useRef<(() => void) | null>(null)
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  outgoingCallRef.current = outgoingCall

  useEffect(() => {
    setTypingUsers([])
    Object.values(typingTimeoutsRef.current).forEach(clearTimeout)
    typingTimeoutsRef.current = {}
    if (!conversation?.id) return
    const onTyping = (payload: { conversationId?: string; chatId?: string; userId?: string; userName?: string }) => {
      const cid = payload.conversationId || payload.chatId
      if (cid !== conversation.id || !payload.userId || payload.userId === currentUserId) return
      const userName = payload.userName || 'Alguien'
      setTypingUsers((prev) => {
        const next = prev.filter((u) => u.userId !== payload.userId)
        next.push({ userId: payload.userId!, userName })
        return next
      })
      if (typingTimeoutsRef.current[payload.userId]) clearTimeout(typingTimeoutsRef.current[payload.userId])
      typingTimeoutsRef.current[payload.userId] = setTimeout(() => {
        delete typingTimeoutsRef.current[payload.userId!]
        setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
      }, 3500)
    }
    const onStoppedTyping = (payload: { conversationId?: string; chatId?: string; userId?: string }) => {
      const cid = payload.conversationId || payload.chatId
      if (cid !== conversation.id || !payload.userId) return
      if (typingTimeoutsRef.current[payload.userId]) {
        clearTimeout(typingTimeoutsRef.current[payload.userId])
        delete typingTimeoutsRef.current[payload.userId]
      }
      setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
    }
    socket.on(SOCKET_EVENTS.USER_TYPING, onTyping)
    socket.on(SOCKET_EVENTS.USER_STOPPED_TYPING, onStoppedTyping)
    return () => {
      socket.off(SOCKET_EVENTS.USER_TYPING, onTyping)
      socket.off(SOCKET_EVENTS.USER_STOPPED_TYPING, onStoppedTyping)
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout)
      typingTimeoutsRef.current = {}
    }
  }, [conversation?.id, currentUserId])

  useEffect(() => {
    if (outgoingCall) {
      ringStopRef.current = startVideoCallRingtone()
    } else {
      ringStopRef.current?.()
      ringStopRef.current = null
    }
    return () => {
      ringStopRef.current?.()
      ringStopRef.current = null
    }
  }, [outgoingCall])

  const openJitsi = useCallback((roomName: string) => {
    const safeName = roomName.replace(/[^a-zA-Z0-9-]/g, '') || `room-${Date.now()}`
    const url = `https://meet.jit.si/${safeName}`
    window.open(url, 'jitsi', 'noopener,noreferrer,width=900,height=640')
  }, [])

  useEffect(() => {
    const onAccepted = (payload: { chatId: string; roomName: string }) => {
      const current = outgoingCallRef.current
      if (current && payload.roomName === current.roomName) {
        openJitsi(payload.roomName)
        setOutgoingCall(null)
      }
    }
    const onRejected = () => setOutgoingCall(null)
    socket.on(SOCKET_EVENTS.VIDEO_CALL_ACCEPTED, onAccepted)
    socket.on(SOCKET_EVENTS.VIDEO_CALL_REJECTED, onRejected)
    return () => {
      socket.off(SOCKET_EVENTS.VIDEO_CALL_ACCEPTED, onAccepted)
      socket.off(SOCKET_EVENTS.VIDEO_CALL_REJECTED, onRejected)
    }
  }, [openJitsi])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  useEffect(() => {
    if (!chatHeaderMenuOpen || !chatHeaderMenuRef.current) {
      setChatHeaderMenuStyle(null)
      return
    }
    const rect = chatHeaderMenuRef.current.getBoundingClientRect()
    const dropdownWidth = 192 // min-w-[12rem]
    const left = Math.max(8, Math.min(rect.right - dropdownWidth, rect.left))
    setChatHeaderMenuStyle({
      top: rect.bottom + 4,
      left,
    })
  }, [chatHeaderMenuOpen])

  useEffect(() => {
    if (!chatHeaderMenuOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        chatHeaderMenuRef.current?.contains(target) ||
        chatHeaderMenuDropdownRef.current?.contains(target)
      ) return
      setChatHeaderMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [chatHeaderMenuOpen])

  const messagesChronological = useMemo(() => {
    if (!conversation) return []
    const withOwn = conversation.messages.map((m) => ({
      ...m,
      isOwn: m.senderId === currentUserId,
    }))
    return [...withOwn].sort((a, b) => a.timestamp - b.timestamp)
  }, [conversation, currentUserId])

  const isGroup = !conversation?.otherUserId && (conversation?.participants?.length ?? 0) > 0
  const showHeaderMenu =
    (conversation?.otherUserId && (onBlockUser || onUnblockUser)) ||
    onClearConversation ||
    (isGroup && !!conversation?.isGroupAdmin)

  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-talkapp-bg px-4 text-center text-talkapp-fg-muted">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-talkapp-primary/20 text-talkapp-primary sm:h-16 sm:w-16">
          <ChatIcon />
        </div>
        <p className="text-sm sm:text-base">No hay conversaciones. Abre Contactos y inicia una conversación.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-talkapp-bg">
      <header className="flex shrink-0 items-center gap-2 sm:gap-3 bg-talkapp-panel/80 backdrop-blur-xl p-3 safe-t safe-l safe-r md:p-4" style={{borderBottom:'1px solid rgba(123,44,191,0.12)'}}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-talkapp-fg-muted hover:bg-white/8 hover:text-talkapp-fg active:opacity-80 md:hidden touch-manipulation transition-colors"
            aria-label="Volver a conversaciones"
          >
            <BackIcon />
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-3 pl-1 sm:pl-3 md:pl-4">
              <div className="relative flex-shrink-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-talkapp-primary text-white font-semibold">
                  {(() => {
                    const avatarUrl = conversation.avatar || conversation.image
                    const url = avatarUrl && avatarUrl.trim()
                      ? (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')
                          ? avatarUrl
                          : `${env.apiUrl.replace(/\/$/, '')}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`)
                      : null
                    return url
                      ? <img src={url} alt="" className="h-full w-full object-cover" />
                      : conversation.name.charAt(0).toUpperCase()
                  })()}
                </div>
                {conversation.otherUserId && otherUserOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-talkapp-panel" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-[0.95rem] text-talkapp-fg tracking-tight">{conversation.name}</h2>
                <p className="text-[0.72rem] text-talkapp-fg-muted truncate">
                  {!conversation.isRemovedFromGroup && typingUsers.length > 0
                    ? typingUsers.length === 1
                      ? `${typingUsers[0].userName} está escribiendo...`
                      : typingUsers.length === 2
                        ? `${typingUsers[0].userName} y ${typingUsers[1].userName} están escribiendo...`
                        : `${typingUsers[0].userName} y ${typingUsers.length - 1} más están escribiendo...`
                    : getConversationHeaderSubtitle(conversation, currentUserId, otherUserOnline, usersInCurrentConversation)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {showHeaderMenu && (
                <div className="relative">
                  <button
                    ref={chatHeaderMenuRef}
                    type="button"
                    onClick={() => setChatHeaderMenuOpen((v) => !v)}
                    className="rounded-xl p-2 text-talkapp-fg/60 hover:bg-white/8 hover:text-talkapp-primary transition-colors"
                    title="Más opciones"
                    aria-label="Más opciones"
                    aria-expanded={chatHeaderMenuOpen}
                  >
                    <DotsVerticalIcon className="h-5 w-5" />
                  </button>
                  {chatHeaderMenuOpen && chatHeaderMenuStyle && createPortal(
                    <div
                      ref={chatHeaderMenuDropdownRef}
                      className="fixed z-[100] min-w-[12rem] rounded-lg border border-talkapp-border bg-talkapp-sidebar py-2 shadow-xl"
                      style={{ top: chatHeaderMenuStyle.top, left: chatHeaderMenuStyle.left }}
                    >
                      {isGroup && conversation.isGroupAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenManageGroup?.()
                            setChatHeaderMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel"
                        >
                          <UsersIcon className="h-4 w-4" />
                          Gestionar grupo
                        </button>
                      )}
                      {conversation.otherUserId && (onBlockUser || onUnblockUser) && (
                        <button
                          type="button"
                          onClick={() => {
                            const isBlocked = blockedUserIds.includes(conversation.otherUserId!)
                            isBlocked ? onUnblockUser?.(conversation.otherUserId!) : onBlockUser?.(conversation.otherUserId!)
                            setChatHeaderMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel"
                        >
                          {blockedUserIds.includes(conversation.otherUserId) ? (
                            <><UnblockIcon />Desbloquear</>
                          ) : (
                            <><BlockIcon />Bloquear</>
                          )}
                        </button>
                      )}
                      {conversation.otherUserId && (
                        <button
                          type="button"
                          onClick={() => {
                            const roomName = makeVideoCallRoomName()
                            socket.emit(SOCKET_EVENTS.VIDEO_CALL_OFFER, {
                              chatId: conversation.id,
                              roomName,
                              callerId: currentUserId,
                              callerName: currentUserName,
                              callerAvatar: currentUserAvatar ?? null,
                            })
                            setOutgoingCall({ chatId: conversation.id, roomName })
                            setChatHeaderMenuOpen(false)
                          }}
                          disabled={!!outgoingCall}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel disabled:opacity-50"
                        >
                          <VideoCallIcon className="h-4 w-4" />
                          Videollamada
                        </button>
                      )}
                      {onClearConversation && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowClearConfirm(true)
                            setChatHeaderMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-red-500/15 hover:text-red-400 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Borrar conversación
                        </button>
                      )}
                    </div>,
                    document.body
                  )}
                </div>
              )}
            </div>
      </header>

      <div
        ref={messagesContainerRef}
        className="chat-messages-scroll min-h-0 flex-1 overflow-y-auto overscroll-behavior-contain safe-l safe-r"
      >
        <div className="px-4 py-5 min-h-full md:px-8 md:py-6">
        {messagesChronological.map((message) => (
          <div
            key={message.id}
            id={`msg-${message.id}`}
            className="mb-1 transition-[box-shadow] duration-300"
          >
            <Message
              message={message}
              currentUserId={currentUserId}
              showSenderName={!!conversation && !conversation.otherUserId && (conversation.participants?.length ?? 0) > 0}
              onDeleteMessage={onDeleteMessage}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {conversation.otherUserId && blockedUserIds.includes(conversation.otherUserId) ? (
        <div className="border-t border-talkapp-border bg-talkapp-panel p-4 safe-b">
          <p className="text-center text-sm text-talkapp-fg-muted">
            Has bloqueado a este usuario. Desbloquea para enviar mensajes.
          </p>
        </div>
      ) : isGroup && conversation.isRemovedFromGroup ? (
        <div className="border-t border-talkapp-border bg-talkapp-panel p-4 safe-b">
          <p className="text-center text-sm text-talkapp-fg-muted">
            Te han eliminado de este grupo. Puedes ver el historial pero no escribir hasta que un administrador te reincorpore.
          </p>
        </div>
      ) : (
        <MessageInput
          onSend={onSendMessage}
          onSendImage={onSendImage}
          onSendDocument={onSendDocument}
          onSendVoice={onSendVoice}
          onTyping={conversation ? () => socket.emit(SOCKET_EVENTS.USER_TYPING, { conversationId: conversation.id }) : undefined}
          onStopTyping={conversation ? () => socket.emit(SOCKET_EVENTS.USER_STOPPED_TYPING, { conversationId: conversation.id }) : undefined}
        />
      )}

      {showClearConfirm && conversation && onClearConversation && (
        <ConfirmModal
          title="Borrar conversación"
          message="Los mensajes se ocultarán solo para ti. Los demás seguirán viendo el historial."
          confirmLabel="Borrar"
          danger
          onConfirm={() => {
            onClearConversation(conversation.id)
            setShowClearConfirm(false)
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {outgoingCall && conversation && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-talkapp-bg/95 backdrop-blur-md">
          <div className="w-full max-w-[340px] flex flex-col rounded-[28px] overflow-hidden shadow-2xl border border-talkapp-border/60 bg-talkapp-sidebar">
            <div className="relative pt-10 pb-6 px-6 text-center bg-gradient-to-b from-talkapp-primary/10 to-transparent">
              <div className="relative inline-block">
                <div className="w-32 h-32 rounded-full overflow-hidden flex items-center justify-center bg-talkapp-panel/80 ring-4 ring-talkapp-primary/25 ring-offset-4 ring-offset-talkapp-sidebar">
                  {conversation.avatar || conversation.image ? (
                    <img
                      src={(() => {
                        const av = conversation.avatar || conversation.image!
                        return av.startsWith('http') || av.startsWith('data:') ? av : `${env.apiUrl.replace(/\/$/, '')}${av.startsWith('/') ? '' : '/'}${av}`
                      })()}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <VideoCallAvatarPlaceholderIcon className="w-16 h-16 text-talkapp-primary/50" />
                  )}
                </div>
                <span className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-talkapp-primary text-talkapp-on-primary shadow-lg border-2 border-talkapp-sidebar">
                  <VideoCallIcon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-talkapp-primary/90">Llamando a</p>
              <p className="text-talkapp-fg text-2xl font-bold mt-1.5 tracking-tight">{conversation.name}</p>
              <p className="text-talkapp-fg-muted text-sm mt-1">Esperando respuesta…</p>
            </div>
            <div className="p-5 pt-2 bg-talkapp-sidebar">
              <button
                type="button"
                onClick={() => {
                  if (conversation.otherUserId) {
                    socket.emit(SOCKET_EVENTS.VIDEO_CALL_CANCEL, { targetUserId: conversation.otherUserId })
                  }
                  setOutgoingCall(null)
                }}
                className="w-full rounded-xl py-3.5 bg-red-500 text-white font-semibold hover:bg-red-400 active:opacity-90 transition-colors"
              >
                Cancelar llamada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VideoCallAvatarPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9" r="3" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function BlockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  )
}

function UnblockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function DotsVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  )
}

function VideoCallIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-8 h-8"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
