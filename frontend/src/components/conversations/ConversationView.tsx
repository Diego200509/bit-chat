import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Conversation } from '../../types/conversation'
import { env } from '../../config/env'
import { socket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/socket'
import * as api from '../../lib/api'
import { ConfirmModal } from './ConfirmModal'
import { Message } from './Message'
import { MessageInput } from './MessageInput'

function startRingingTone(): () => void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const gain = ctx.createGain()
    gain.gain.value = 0.15
    gain.connect(ctx.destination)

    let stopped = false
    const schedule = () => {
      if (stopped) return
      const t = ctx.currentTime
      const play = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator()
        osc.frequency.value = freq
        osc.connect(gain)
        osc.start(start)
        osc.stop(start + duration)
      }
      play(440, t, 0.2)
      play(440, t + 0.25, 0.2)
      play(480, t + 0.5, 0.2)
      play(480, t + 0.75, 0.2)
    }

    schedule()
    const interval = window.setInterval(() => {
      if (stopped) return
      schedule()
    }, 1500)

    return () => {
      stopped = true
      clearInterval(interval)
      ctx.close().catch(() => {})
    }
  } catch {
    return () => {}
  }
}

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
    return `hoy a las ${timeStr}`
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return `ayer a las ${timeStr}`
  }
  const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays >= 1 && diffDays < 7) {
    return `${date.toLocaleDateString('es', { weekday: 'long' })} a las ${timeStr}`
  }
  if (diffDays >= 7 && diffDays < 365) {
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }
  if (diffDays >= 365) {
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
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
    else if (conversation.otherUserLastSeen != null) line = `Última vez ${formatLastSeen(conversation.otherUserLastSeen)}`
    else line = 'Desconectado'
    const status = conversation.otherUserStatus?.trim()
    return status ? `${line} · ${status}` : line
  }
  if (conversation.participants && conversation.participants.length > 0) {
    if (conversation.isRemovedFromGroup) return 'No puedes escribir en este grupo'
    const inConvSet = new Set(usersInCurrentConversation)
    const onlineInGroup = conversation.participants.filter(
      (p) => p.id !== currentUserId && inConvSet.has(p.id)
    )
    if (onlineInGroup.length === 0) return 'Nadie en línea'
    if (onlineInGroup.length <= 3) {
      return `${onlineInGroup.map((p) => p.name).join(', ')} en línea`
    }
    return `${onlineInGroup.length} en línea`
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
  onGroupUpdated,
  currentUserName = 'Yo',
  currentUserAvatar,
}: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showManageGroupModal, setShowManageGroupModal] = useState(false)
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
      ringStopRef.current = startRingingTone()
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
        <p className="text-sm sm:text-base">Selecciona una conversación o espera a que alguien te escriba</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-talkapp-bg">
      <header className="flex shrink-0 items-center gap-2 sm:gap-3 border-b border-talkapp-border bg-talkapp-panel p-3 safe-t safe-l safe-r md:p-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-talkapp-fg-muted hover:bg-talkapp-sidebar hover:text-talkapp-fg active:opacity-80 md:hidden touch-manipulation"
            aria-label="Volver a conversaciones"
          >
            <BackIcon />
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2 sm:pl-4 md:pl-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-talkapp-on-primary text-talkapp-primary font-semibold">
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
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-talkapp-fg">{conversation.name}</h2>
                <p className="text-xs text-talkapp-fg/80 truncate">
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
                    className="rounded-lg p-2 text-talkapp-fg/70 hover:bg-talkapp-sidebar hover:text-talkapp-primary"
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
                            setShowManageGroupModal(true)
                            setChatHeaderMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel"
                        >
                          <UsersIcon className="h-5 w-5" />
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
                            <><UnblockIcon /> Desbloquear</>
                          ) : (
                            <><BlockIcon /> Bloquear</>
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
                          <VideoCallIcon className="h-5 w-5" />
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
                          <TrashIcon className="h-5 w-5" />
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
        <div className="px-5 py-4 min-h-full md:px-10 md:py-5">
        {messagesChronological.map((message) => (
          <div
            key={message.id}
            id={`msg-${message.id}`}
            className="transition-[box-shadow] duration-300"
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

      {showManageGroupModal && conversation && isGroup && conversation.isGroupAdmin && (
        <ManageGroupModal
          conversation={conversation}
          currentUserId={currentUserId}
          onClose={() => setShowManageGroupModal(false)}
          onGroupUpdated={() => {
            onGroupUpdated?.()
            setShowManageGroupModal(false)
          }}
        />
      )}

      {outgoingCall && conversation && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-talkapp-sidebar border border-talkapp-border shadow-2xl overflow-hidden">
            <div className="p-6 pb-4 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-talkapp-panel border-4 border-talkapp-primary/30 flex items-center justify-center animate-pulse">
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
                    <span className="text-4xl text-slate-500">👤</span>
                  )}
                </div>
                <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-talkapp-primary/80 text-talkapp-on-primary animate-pulse">
                  <VideoCallIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="text-talkapp-fg-muted text-sm font-medium">Llamando a</p>
              <p className="text-talkapp-fg text-xl font-semibold mt-1">{conversation.name}</p>
            </div>
            <div className="p-4 pt-0">
              <button
                type="button"
                onClick={() => {
                  if (conversation.otherUserId) {
                    socket.emit(SOCKET_EVENTS.VIDEO_CALL_CANCEL, { targetUserId: conversation.otherUserId })
                  }
                  setOutgoingCall(null)
                }}
                className="w-full rounded-xl py-3.5 bg-red-600 text-white font-semibold hover:bg-red-500 active:opacity-90 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ManageGroupModalProps {
  conversation: Conversation
  currentUserId: string
  onClose: () => void
  onGroupUpdated: () => void
}

function fullGroupImageUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = env.apiUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

function ManageGroupModal({ conversation, currentUserId, onClose, onGroupUpdated }: ManageGroupModalProps) {
  const [contacts, setContacts] = useState<api.ContactItem[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [showAddList, setShowAddList] = useState(false)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const groupImageInputRef = useRef<HTMLInputElement>(null)
  const adminSet = useMemo(() => new Set(conversation.adminIds ?? []), [conversation.adminIds])
  const removedSet = useMemo(() => new Set(conversation.removedParticipantIds ?? []), [conversation.removedParticipantIds])
  const participantIds = useMemo(() => new Set((conversation.participants ?? []).map((p) => p.id)), [conversation.participants])

  const handleGroupImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImageError(null)
      setUploadingImage(true)
      try {
        const url = await api.uploadImage(file)
        await api.updateGroupConversation(conversation.id, { image: url })
        onGroupUpdated()
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Error al subir la imagen')
      } finally {
        setUploadingImage(false)
        e.target.value = ''
      }
    },
    [conversation.id, onGroupUpdated]
  )

  const handleRemoveGroupImage = useCallback(async () => {
    setImageError(null)
    try {
      await api.updateGroupConversation(conversation.id, { image: null })
      onGroupUpdated()
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Error al quitar la foto')
    }
  }, [conversation.id, onGroupUpdated])

  useEffect(() => {
    if (!showAddList) return
    setLoadingContacts(true)
    api
      .getContacts()
      .then((data) => {
        const friends = data.friends ?? []
        setContacts(friends.filter((c) => !participantIds.has(c.userId)))
      })
      .catch(() => setContacts([]))
      .finally(() => setLoadingContacts(false))
  }, [showAddList, participantIds])

  const handleAdd = useCallback(
    async (userId: string) => {
      setAdding(true)
      try {
        await api.addGroupParticipant(conversation.id, userId)
        onGroupUpdated()
      } finally {
        setAdding(false)
        setShowAddList(false)
      }
    },
    [conversation.id, onGroupUpdated]
  )

  const handleRemove = useCallback(
    async (userId: string) => {
      setRemovingId(userId)
      try {
        await api.removeGroupParticipant(conversation.id, userId)
        onGroupUpdated()
      } finally {
        setRemovingId(null)
      }
    },
    [conversation.id, onGroupUpdated]
  )

  const handleReincorporate = useCallback(
    async (userId: string) => {
      setRemovingId(userId)
      try {
        await api.addGroupParticipant(conversation.id, userId)
        onGroupUpdated()
      } finally {
        setRemovingId(null)
      }
    },
    [conversation.id, onGroupUpdated]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-talkapp-border bg-talkapp-sidebar shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-talkapp-border p-4">
          <h3 className="font-semibold text-talkapp-fg">Gestionar grupo</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-fg"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="chat-messages-scroll max-h-[60vh] overflow-y-auto p-4">
          <div className="mb-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => groupImageInputRef.current?.click()}
              disabled={uploadingImage}
              className="w-16 h-16 rounded-full overflow-hidden bg-talkapp-panel border-2 border-talkapp-border flex items-center justify-center shrink-0 hover:border-talkapp-primary transition-colors focus:outline-none focus:ring-2 focus:ring-talkapp-primary"
            >
              {conversation.image ? (
                <img src={fullGroupImageUrl(conversation.image)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-500">👥</span>
              )}
            </button>
            <input
              ref={groupImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleGroupImageChange}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-sm font-medium text-talkapp-fg">Foto del grupo</p>
              <p className="text-xs text-talkapp-fg-muted">{uploadingImage ? 'Subiendo…' : 'Clic para cambiar'}</p>
              {conversation.image && (
                <button
                  type="button"
                  onClick={handleRemoveGroupImage}
                  className="text-xs text-red-400 hover:text-red-300 focus:outline-none focus:underline text-left"
                >
                  Quitar foto
                </button>
              )}
              {imageError && <p className="text-xs text-red-400">{imageError}</p>}
            </div>
          </div>
          <p className="mb-3 text-sm text-talkapp-fg-muted">{conversation.name}</p>
          <div className="space-y-2">
            {(conversation.participants ?? []).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-talkapp-border bg-talkapp-panel px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-talkapp-fg">{p.name}</span>
                  {adminSet.has(p.id) && (
                    <span className="ml-2 rounded bg-talkapp-primary/20 px-1.5 py-0.5 text-xs text-talkapp-primary">
                      Admin
                    </span>
                  )}
                  {removedSet.has(p.id) && (
                    <span className="ml-2 rounded bg-talkapp-fg-muted/20 px-1.5 py-0.5 text-xs text-talkapp-fg-muted">
                      Eliminado
                    </span>
                  )}
                </div>
                {p.id !== currentUserId && (
                  removedSet.has(p.id) ? (
                    <button
                      type="button"
                      onClick={() => handleReincorporate(p.id)}
                      disabled={!!removingId}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm text-talkapp-primary hover:bg-talkapp-primary/15 disabled:opacity-50"
                    >
                      {removingId === p.id ? '…' : 'Reincorporar'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRemove(p.id)}
                      disabled={!!removingId}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-400 hover:bg-red-500/15 disabled:opacity-50"
                    >
                      {removingId === p.id ? '…' : 'Eliminar'}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
          {!showAddList ? (
            <button
              type="button"
              onClick={() => setShowAddList(true)}
              className="mt-4 w-full rounded-lg border border-talkapp-border bg-talkapp-panel py-2.5 text-sm font-medium text-talkapp-fg hover:bg-talkapp-bg"
            >
              Añadir participante
            </button>
          ) : (
            <div className="mt-4 rounded-lg border border-talkapp-border bg-talkapp-panel p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-talkapp-fg">Elegir contacto</span>
                <button
                  type="button"
                  onClick={() => setShowAddList(false)}
                  className="text-sm text-talkapp-fg-muted hover:text-talkapp-fg"
                >
                  Cerrar
                </button>
              </div>
              {loadingContacts ? (
                <p className="py-2 text-sm text-talkapp-fg-muted">Cargando…</p>
              ) : contacts.length === 0 ? (
                <p className="py-2 text-sm text-talkapp-fg-muted">No hay contactos disponibles para añadir.</p>
              ) : (
                <ul className="chat-messages-scroll max-h-40 overflow-y-auto space-y-1">
                  {contacts.map((c) => (
                    <li key={c.userId}>
                      <button
                        type="button"
                        onClick={() => handleAdd(c.userId)}
                        disabled={adding}
                        className="w-full rounded px-2 py-1.5 text-left text-sm text-talkapp-fg hover:bg-talkapp-bg disabled:opacity-50"
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06 6.53 18.53a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.75 15.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM3.75 18.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM9.75 18.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" clipRule="evenodd" />
    </svg>
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

function DotsVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" clipRule="evenodd" />
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
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
