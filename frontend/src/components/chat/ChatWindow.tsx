import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Chat } from '../../types/chat'
import { env } from '../../config/env'
import { socket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/socket'
import { ConfirmModal } from './ConfirmModal'
import { Message } from './Message'
import { MessageInput } from './MessageInput'

const JITSI_BASE = 'https://meet.jit.si'

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

function makeJitsiRoomName(): string {
  const part = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 10)
  return `bitchat-${part}-${Date.now()}`
}

const CHAT_BACKGROUND_PRESETS: Record<string, string> = {
  default: '',
  warm: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #1c1917 100%)',
  cool: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
  subtle: 'linear-gradient(180deg, #0a0a0a 0%, #171717 100%)',
  night: 'linear-gradient(180deg, #0c0a1d 0%, #1a1625 50%, #0f0d1a 100%)',
  ocean: 'linear-gradient(180deg, #0a1628 0%, #0f2847 50%, #0c1929 100%)',
  forest: 'linear-gradient(180deg, #0a1410 0%, #142118 50%, #0d1912 100%)',
  sunset: 'linear-gradient(135deg, #1a0f0a 0%, #2d1810 50%, #1a0f0a 100%)',
  lavender: 'linear-gradient(180deg, #150f1a 0%, #1e1528 50%, #150f1a 100%)',
  slate: 'linear-gradient(180deg, #0f1215 0%, #1a1f26 50%, #0f1215 100%)',
  carbon: 'linear-gradient(145deg, #111 0%, #1c1c1c 50%, #0d0d0d 100%)',
}

const CHAT_BACKGROUND_LABELS: Record<string, string> = {
  default: 'Por defecto',
  warm: 'Cálido',
  cool: 'Fresco',
  subtle: 'Sutil',
  night: 'Noche',
  ocean: 'Océano',
  forest: 'Bosque',
  sunset: 'Atardecer',
  lavender: 'Lavanda',
  slate: 'Pizarra',
  carbon: 'Carbón',
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

function getChatHeaderSubtitle(
  chat: Chat,
  currentUserId: string,
  otherUserOnline: boolean | undefined,
  usersInCurrentChat: string[]
): string {
  if (chat.otherUserId != null) {
    if (otherUserOnline === true) return 'En línea'
    if (chat.otherUserLastSeen != null) return `Última vez ${formatLastSeen(chat.otherUserLastSeen)}`
    return 'Desconectado'
  }
  if (chat.participants && chat.participants.length > 0) {
    const inChatSet = new Set(usersInCurrentChat)
    const onlineInGroup = chat.participants.filter(
      (p) => p.id !== currentUserId && inChatSet.has(p.id)
    )
    if (onlineInGroup.length === 0) return 'Nadie en línea'
    if (onlineInGroup.length <= 3) {
      return `${onlineInGroup.map((p) => p.name).join(', ')} en línea`
    }
    return `${onlineInGroup.length} en línea`
  }
  return 'BitChat'
}

interface ChatWindowProps {
  chat: Chat | null
  onSendMessage: (text: string) => void
  onSendImage?: (url: string) => void
  onSendSticker?: (url: string) => void
  onReaction?: (messageId: string, emoji: string) => void
  onEditMessage?: (messageId: string, text: string) => void
  onPinMessage?: (messageId: string) => void
  onUnpinMessage?: (messageId: string) => void
  onUpdateChatBackground?: (chatId: string, chatBackground: string | null) => void
  currentUserId: string
  onBack?: () => void
  onBlockUser?: (userId: string) => void
  onUnblockUser?: (userId: string) => void
  blockedUserIds?: string[]
  otherUserOnline?: boolean
  usersInCurrentChat?: string[]
  onDeleteMessage?: (messageId: string, scope: 'for_me' | 'for_everyone') => void
  onClearChat?: (chatId: string) => void
  currentUserName?: string
  currentUserAvatar?: string | null
}

export function ChatWindow({
  chat,
  onSendMessage,
  onSendImage,
  onSendSticker,
  onReaction,
  onEditMessage,
  onPinMessage,
  onUnpinMessage,
  onUpdateChatBackground,
  currentUserId,
  onBack,
  onBlockUser,
  onUnblockUser,
  blockedUserIds = [],
  otherUserOnline,
  usersInCurrentChat = [],
  onDeleteMessage,
  onClearChat,
  currentUserName = 'Yo',
  currentUserAvatar,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [outgoingCall, setOutgoingCall] = useState<{ chatId: string; roomName: string } | null>(null)
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const [chatHeaderMenuOpen, setChatHeaderMenuOpen] = useState(false)
  const [chatHeaderMenuStyle, setChatHeaderMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const bgPickerRef = useRef<HTMLDivElement>(null)
  const chatHeaderMenuRef = useRef<HTMLButtonElement>(null)
  const chatHeaderMenuDropdownRef = useRef<HTMLDivElement>(null)
  const chatSearchInputRef = useRef<HTMLInputElement>(null)
  const outgoingCallRef = useRef(outgoingCall)
  const ringStopRef = useRef<(() => void) | null>(null)
  outgoingCallRef.current = outgoingCall

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
    const url = `${JITSI_BASE}/${safeName}`
    const w = window.open(url, 'jitsi', 'noopener,noreferrer,width=900,height=640')
    if (!w) window.location.href = url
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
    if (chatSearchOpen) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages, chatSearchOpen])

  useEffect(() => {
    if (!showBackgroundPicker) return
    const close = (e: MouseEvent) => {
      if (bgPickerRef.current && !bgPickerRef.current.contains(e.target as Node)) setShowBackgroundPicker(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showBackgroundPicker])

  useEffect(() => {
    if (chatSearchOpen) {
      chatSearchInputRef.current?.focus()
    } else {
      setChatSearchQuery('')
    }
  }, [chatSearchOpen])

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
      setShowBackgroundPicker(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [chatHeaderMenuOpen])

  const messagesChronological = useMemo(() => {
    if (!chat) return []
    const withOwn = chat.messages.map((m) => ({
      ...m,
      isOwn: m.senderId === currentUserId,
    }))
    return [...withOwn].sort((a, b) => a.timestamp - b.timestamp)
  }, [chat, currentUserId])

  const pinned = useMemo(
    () => messagesChronological.filter((m) => m.pinned),
    [messagesChronological]
  )

  const matchingMessageIds = useMemo(() => {
    const q = chatSearchQuery.trim().toLowerCase()
    if (!q) return []
    return messagesChronological
      .filter((m) => {
        const text = (m.text ?? '').toLowerCase()
        return text.includes(q)
      })
      .map((m) => m.id)
  }, [messagesChronological, chatSearchQuery])

  const scrollToSearchMatch = useCallback((messageId: string) => {
    const container = messagesContainerRef.current
    const messageEl = document.getElementById(`msg-${messageId}`)
    if (!container || !messageEl) return
    const containerRect = container.getBoundingClientRect()
    const msgRect = messageEl.getBoundingClientRect()
    const relativeTop = msgRect.top - containerRect.top + container.scrollTop
    const scrollTo = relativeTop - container.clientHeight / 2 + msgRect.height / 2
    container.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!chatSearchQuery.trim()) {
      setSearchMatchIndex(0)
      return
    }
    setSearchMatchIndex(0)
  }, [chatSearchQuery])

  useEffect(() => {
    if (matchingMessageIds.length === 0) return
    const idx = Math.min(searchMatchIndex, matchingMessageIds.length - 1)
    const id = matchingMessageIds[idx]
    if (id) scrollToSearchMatch(id)
  }, [searchMatchIndex, matchingMessageIds, scrollToSearchMatch])

  useEffect(() => {
    if (!chatSearchOpen) setSearchMatchIndex(0)
  }, [chatSearchOpen])

  if (!chat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bitchat-bg px-4 text-center text-bitchat-fg-muted">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bitchat-cyan/20 text-bitchat-cyan sm:h-16 sm:w-16">
          <ChatIcon />
        </div>
        <p className="text-sm sm:text-base">Selecciona una conversación o espera a que alguien te escriba</p>
      </div>
    )
  }

  const chatBgStyle = chat.chatBackground && CHAT_BACKGROUND_PRESETS[chat.chatBackground]
    ? CHAT_BACKGROUND_PRESETS[chat.chatBackground]
    : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bitchat-bg">
      <header className="flex shrink-0 items-center gap-2 sm:gap-3 border-b border-bitchat-border bg-bitchat-panel p-3 safe-t safe-l safe-r md:p-4">
        {onBack && !chatSearchOpen && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bitchat-fg-muted hover:bg-bitchat-sidebar hover:text-bitchat-fg active:opacity-80 md:hidden touch-manipulation"
            aria-label="Volver a conversaciones"
          >
            <BackIcon />
          </button>
        )}
        {chatSearchOpen ? (
          <>
            <button
              type="button"
              onClick={() => setChatSearchOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bitchat-fg-muted hover:bg-bitchat-sidebar hover:text-bitchat-fg"
              aria-label="Cerrar búsqueda"
            >
              <BackIcon />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
              <SearchIconHeader className="h-5 w-5 shrink-0 text-bitchat-fg-muted" />
              <input
                ref={chatSearchInputRef}
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Buscar en la conversación"
                className="min-w-0 flex-1 rounded-lg border-0 bg-bitchat-sidebar px-3 py-2 text-sm text-bitchat-fg placeholder:text-bitchat-fg-muted focus:outline-none focus:ring-1 focus:ring-bitchat-cyan"
              />
              {chatSearchQuery.trim() && (
                <>
                  <div className="flex shrink-0 items-center gap-0.5 text-bitchat-fg-muted">
                    <span className="text-xs tabular-nums">
                      {matchingMessageIds.length === 0
                        ? 'Sin resultados'
                        : `${Math.min(searchMatchIndex + 1, matchingMessageIds.length)} de ${matchingMessageIds.length}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchMatchIndex((i) => Math.max(0, i - 1))}
                      disabled={matchingMessageIds.length === 0 || searchMatchIndex <= 0}
                      className="rounded p-1.5 text-bitchat-fg-muted hover:bg-bitchat-sidebar hover:text-bitchat-fg disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Coincidencia anterior"
                    >
                      <ChevronUpIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchMatchIndex((i) => Math.min(matchingMessageIds.length - 1, i + 1))}
                      disabled={matchingMessageIds.length === 0 || searchMatchIndex >= matchingMessageIds.length - 1}
                      className="rounded p-1.5 text-bitchat-fg-muted hover:bg-bitchat-sidebar hover:text-bitchat-fg disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Siguiente coincidencia"
                    >
                      <ChevronDownIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChatSearchQuery('')}
                    className="shrink-0 rounded-full p-1 text-bitchat-fg-muted hover:bg-bitchat-sidebar hover:text-bitchat-fg"
                    aria-label="Limpiar búsqueda"
                  >
                    <CloseSearchIcon className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2 pl-2 sm:pl-4 md:pl-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bitchat-blue-dark text-bitchat-cyan font-semibold">
                {(() => {
                  const avatarUrl = chat.avatar || chat.image
                  const url = avatarUrl && avatarUrl.trim()
                    ? (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')
                        ? avatarUrl
                        : `${env.apiUrl.replace(/\/$/, '')}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`)
                    : null
                  return url
                    ? <img src={url} alt="" className="h-full w-full object-cover" />
                    : chat.name.charAt(0).toUpperCase()
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-bitchat-fg">{chat.name}</h2>
                <p className="text-xs text-bitchat-fg/80 truncate">
                  {getChatHeaderSubtitle(chat, currentUserId, otherUserOnline, usersInCurrentChat)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setChatSearchOpen(true)}
                className="rounded-lg p-2 text-bitchat-fg/70 hover:bg-bitchat-sidebar hover:text-bitchat-cyan"
                title="Buscar en el chat"
                aria-label="Buscar en el chat"
              >
                <SearchIconHeader className="h-5 w-5" />
              </button>
              {(onUpdateChatBackground || (chat.otherUserId && (onBlockUser || onUnblockUser)) || chat.otherUserId || onClearChat) && (
                <div className="relative">
                  <button
                    ref={chatHeaderMenuRef}
                    type="button"
                    onClick={() => setChatHeaderMenuOpen((v) => !v)}
                    className="rounded-lg p-2 text-bitchat-fg/70 hover:bg-bitchat-sidebar hover:text-bitchat-cyan"
                    title="Más opciones"
                    aria-label="Más opciones"
                    aria-expanded={chatHeaderMenuOpen}
                  >
                    <DotsVerticalIcon className="h-5 w-5" />
                  </button>
                  {chatHeaderMenuOpen && chatHeaderMenuStyle && createPortal(
                    <div
                      ref={chatHeaderMenuDropdownRef}
                      className="fixed z-[100] min-w-[12rem] rounded-lg border border-bitchat-border bg-bitchat-sidebar py-2 shadow-xl"
                      style={{ top: chatHeaderMenuStyle.top, left: chatHeaderMenuStyle.left }}
                    >
                      {onUpdateChatBackground && (
                        <div className="relative" ref={showBackgroundPicker ? bgPickerRef : undefined}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowBackgroundPicker((v) => !v)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-bitchat-panel"
                          >
                            <WallpaperIcon />
                            Fondo del chat
                          </button>
                          {showBackgroundPicker && (
                            <div className="absolute right-full top-0 z-20 mr-1 w-44 rounded-lg border border-bitchat-border bg-bitchat-sidebar py-2 shadow-lg">
                              <p className="px-3 py-1 text-xs text-bitchat-fg-muted">Fondo</p>
                              {Object.entries(CHAT_BACKGROUND_PRESETS).map(([key, value]) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    onUpdateChatBackground(chat.id, key === 'default' ? null : key)
                                    setShowBackgroundPicker(false)
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-bitchat-panel"
                                >
                                  <span
                                    className="h-5 w-8 rounded border border-bitchat-border shrink-0"
                                    style={value ? { background: value } : { background: 'var(--color-bitchat-bg)' }}
                                  />
                                  {CHAT_BACKGROUND_LABELS[key] ?? key}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {chat.otherUserId && (onBlockUser || onUnblockUser) && (
                        <button
                          type="button"
                          onClick={() => {
                            const isBlocked = blockedUserIds.includes(chat.otherUserId!)
                            isBlocked ? onUnblockUser?.(chat.otherUserId!) : onBlockUser?.(chat.otherUserId!)
                            setChatHeaderMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-bitchat-panel"
                        >
                          {blockedUserIds.includes(chat.otherUserId) ? (
                            <><UnblockIcon /> Desbloquear</>
                          ) : (
                            <><BlockIcon /> Bloquear</>
                          )}
                        </button>
                      )}
                      {chat.otherUserId && (
                        <button
                          type="button"
                          onClick={() => {
                            const roomName = makeJitsiRoomName()
                            socket.emit(SOCKET_EVENTS.VIDEO_CALL_OFFER, {
                              chatId: chat.id,
                              roomName,
                              callerId: currentUserId,
                              callerName: currentUserName,
                              callerAvatar: currentUserAvatar ?? null,
                            })
                            setOutgoingCall({ chatId: chat.id, roomName })
                            setChatHeaderMenuOpen(false)
                          }}
                          disabled={!!outgoingCall}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-bitchat-panel disabled:opacity-50"
                        >
                          <VideoCallIcon className="h-5 w-5" />
                          Videollamada
                        </button>
                      )}
                      {onClearChat && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowClearConfirm(true)
                            setChatHeaderMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-red-500/15 hover:text-red-400 transition-colors"
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
          </>
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
              className="min-w-0 flex-1 text-left text-sm text-bitchat-fg truncate hover:underline hover:underline"
              title="Ir al mensaje"
            >
              {previewShort}
            </button>
            {onUnpinMessage && (
              <button
                type="button"
                onClick={() => onUnpinMessage(msg.id)}
                className="flex-shrink-0 rounded px-2 py-1 text-xs text-bitchat-fg-muted hover:bg-bitchat-panel hover:text-bitchat-fg"
                title="Desfijar mensaje"
              >
                Desfijar
              </button>
            )}
          </div>
        )
      })()}

      <div
        ref={messagesContainerRef}
        className="chat-messages-scroll min-h-0 flex-1 overflow-y-auto overscroll-behavior-contain safe-l safe-r"
        style={chatBgStyle ? { background: chatBgStyle } : undefined}
      >
        <div className="px-5 py-4 min-h-full md:px-10 md:py-5">
        {messagesChronological.map((message) => (
          <div
            key={message.id}
            id={`msg-${message.id}`}
            className={`transition-[box-shadow] duration-300 ${highlightedMessageId === message.id ? 'rounded-xl ring-2 ring-bitchat-cyan ring-offset-2 ring-offset-bitchat-bg' : ''}`}
          >
            <Message
              message={message}
              currentUserId={currentUserId}
              showSenderName={!!chat && !chat.otherUserId && (chat.participants?.length ?? 0) > 0}
              searchHighlight={chatSearchQuery.trim() || undefined}
              onReaction={onReaction}
              onEditMessage={onEditMessage}
              onPinMessage={onPinMessage}
              onUnpinMessage={onUnpinMessage}
              onDeleteMessage={onDeleteMessage}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {chat.otherUserId && blockedUserIds.includes(chat.otherUserId) ? (
        <div className="border-t border-bitchat-border bg-bitchat-panel p-4 safe-b">
          <p className="text-center text-sm text-bitchat-fg-muted">
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

      {showClearConfirm && chat && onClearChat && (
        <ConfirmModal
          title="Borrar conversación"
          message="Los mensajes se ocultarán solo para ti. Los demás seguirán viendo el historial."
          confirmLabel="Borrar"
          danger
          onConfirm={() => {
            onClearChat(chat.id)
            setShowClearConfirm(false)
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {outgoingCall && chat && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-bitchat-sidebar border border-bitchat-border shadow-2xl overflow-hidden">
            <div className="p-6 pb-4 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-bitchat-panel border-4 border-bitchat-cyan/30 flex items-center justify-center animate-pulse">
                  {chat.avatar || chat.image ? (
                    <img
                      src={(() => {
                        const av = chat.avatar || chat.image!
                        return av.startsWith('http') || av.startsWith('data:') ? av : `${env.apiUrl.replace(/\/$/, '')}${av.startsWith('/') ? '' : '/'}${av}`
                      })()}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl text-slate-500">👤</span>
                  )}
                </div>
                <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-bitchat-cyan/80 text-bitchat-blue-dark animate-pulse">
                  <VideoCallIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="text-bitchat-fg-muted text-sm font-medium">Llamando a</p>
              <p className="text-bitchat-fg text-xl font-semibold mt-1">{chat.name}</p>
            </div>
            <div className="p-4 pt-0">
              <button
                type="button"
                onClick={() => {
                  if (chat.otherUserId) {
                    socket.emit(SOCKET_EVENTS.VIDEO_CALL_CANCEL, { targetUserId: chat.otherUserId })
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

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M11.47 7.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function SearchIconHeader({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function CloseSearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
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

function PinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M16.5 3.75a3.75 3.75 0 0 0-2.25 6.72 3.75 3.75 0 0 0 1.5 2.28v7.5h3v-7.5a3.75 3.75 0 0 0 1.5-2.28 3.75 3.75 0 0 0-2.25-6.72ZM12 15a3 3 0 0 1-3-3V6a3 3 0 1 1 6 0v6a3 3 0 0 1-3 3Z" clipRule="evenodd" />
    </svg>
  )
}

function WallpaperIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18h6v-6.06l-2.97 2.97a.75.75 0 0 1-1.06 0L3 16.06Zm10.5-1.06 2.25 2.25v.001h.001l2.25-2.25v-6.5h-4.5v6.5Zm-6.75-6.75 2.25 2.25v6.5H3v-6.5l2.25-2.25a.75.75 0 0 1 1.06 0Zm1.06 0 2.97-2.97a.75.75 0 0 1 1.06 0L14.94 8 12 5.06 9.06 8l2.97 2.97a.75.75 0 0 1 0 1.06L9.06 14l.94.94h6.5v-6.5l-2.25-2.25a.75.75 0 0 1 0-1.06L16.94 5.06 14 2.06l-2.25 2.25a.75.75 0 0 1 0 1.06L14.94 6.5 12 9.44 9.06 6.5l1.06-1.06a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
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
