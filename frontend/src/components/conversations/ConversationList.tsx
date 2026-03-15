import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Conversation } from '../../types/conversation'
import { ConfirmModal } from './ConfirmModal'
import { CreateConversationModal } from './CreateConversationModal'
import { env } from '../../config/env'


function formatLastMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (dateOnly.getTime() === today.getTime()) {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return 'Ayer'
  }
  return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SingleCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function DoubleCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
    </svg>
  )
}

interface ConversationListProps {
  conversations: Conversation[]
  currentChatId: string | null
  onSelectConversation: (conversationId: string) => void
  currentUserId?: string
  currentUserName?: string
  currentUserAvatar?: string | null
  onLogout?: () => void
  onOpenContacts?: () => void
  onEditProfile?: () => void
  conversationsLoading?: boolean
  onMuteConversation?: (conversationId: string) => void
  onUnmuteConversation?: (conversationId: string) => void
  onCreateGroup?: (name: string, participantIds: string[], image?: string | null) => Promise<void>
  onClearConversation?: (conversationId: string) => void
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
  typingByChatId?: Record<string, Array<{ userId: string; userName: string }>>
}

export function ConversationList({
  conversations,
  currentChatId,
  onSelectConversation,
  currentUserId,
  currentUserName = 'Yo',
  onLogout,
  onOpenContacts,
  currentUserAvatar,
  onEditProfile,
  conversationsLoading = false,
  onMuteConversation,
  onUnmuteConversation,
  onCreateGroup,
  onClearConversation,
  theme = 'dark',
  onToggleTheme,
  typingByChatId = {},
}: ConversationListProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const [clearConfirmConversationId, setClearConfirmConversationId] = useState<string | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [headerMenuStyle, setHeaderMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuDropdownRef = useRef<HTMLDivElement>(null)
  const headerMenuRef = useRef<HTMLButtonElement>(null)
  const headerMenuDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!headerMenuOpen || !headerMenuRef.current) {
      setHeaderMenuStyle(null)
      return
    }
    const rect = headerMenuRef.current.getBoundingClientRect()
    const padding = 8
    const menuWidth = 180
    const viewportW = window.innerWidth
    const left = Math.max(padding, Math.min(viewportW - menuWidth - padding, rect.right - menuWidth))
    setHeaderMenuStyle({ top: rect.bottom + padding, left })
  }, [headerMenuOpen])

  useLayoutEffect(() => {
    if (!headerMenuOpen || !headerMenuStyle || !headerMenuRef.current || !headerMenuDropdownRef.current) return
    const rect = headerMenuRef.current.getBoundingClientRect()
    const padding = 8
    const viewportH = window.innerHeight
    const menuHeight = headerMenuDropdownRef.current.offsetHeight
    const isCurrentlyBelow = headerMenuStyle.top >= rect.bottom
    if (isCurrentlyBelow && headerMenuStyle.top + menuHeight > viewportH - padding) {
      const topUp = rect.top - menuHeight - padding
      setHeaderMenuStyle((prev) => (prev ? { ...prev, top: Math.max(padding, topUp) } : prev))
    }
  }, [headerMenuOpen, headerMenuStyle])

  useEffect(() => {
    if (!headerMenuOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (headerMenuRef.current?.contains(target) || headerMenuDropdownRef.current?.contains(target)) return
      setHeaderMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [headerMenuOpen])

  useEffect(() => {
    if (!menuOpenId || !menuRef.current) {
      setMenuStyle(null)
      return
    }
    const rect = menuRef.current.getBoundingClientRect()
    const padding = 8
    const menuWidth = 176
    const viewportW = window.innerWidth
    const left = Math.max(padding, Math.min(viewportW - menuWidth - padding, rect.right - menuWidth))
    setMenuStyle({ top: rect.bottom + padding, left })
  }, [menuOpenId])

  useLayoutEffect(() => {
    if (!menuOpenId || !menuStyle || !menuRef.current || !menuDropdownRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const padding = 8
    const viewportH = window.innerHeight
    const menuHeight = menuDropdownRef.current.offsetHeight
    const isCurrentlyBelow = menuStyle.top >= rect.bottom
    if (isCurrentlyBelow && menuStyle.top + menuHeight > viewportH - padding) {
      const topUp = rect.top - menuHeight - padding
      setMenuStyle((prev) => (prev ? { ...prev, top: Math.max(padding, topUp) } : prev))
    }
  }, [menuOpenId, menuStyle])

  useEffect(() => {
    if (!menuOpenId) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || menuDropdownRef.current?.contains(target)) return
      setMenuOpenId(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpenId])

  const renderConversationRow = (conversation: Conversation) => {
    const isActive = currentChatId === conversation.id
    const menuOpen = menuOpenId === conversation.id
    return (
      <li key={conversation.id} className="relative">
        <div className="flex w-full items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectConversation(conversation.id)}
            className={`flex flex-1 min-w-0 items-center gap-3 px-3 py-3.5 text-left touch-manipulation rounded-[14px] transition-all duration-150 ${isActive ? 'bg-talkapp-panel border-talkapp-primary/20' : 'hover:bg-talkapp-panel/50'
              }`}
          >
            {/* Avatar con estado */}
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-talkapp-primary flex items-center justify-center text-white font-semibold overflow-hidden text-base">
                {(() => {
                  const avatarUrl = conversation.avatar || conversation.image
                  const url = avatarUrl && avatarUrl.trim()
                    ? (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')
                      ? avatarUrl
                      : `${env.apiUrl.replace(/\/$/, '')}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`)
                    : null
                  return url
                    ? <img src={url} alt="" className="w-full h-full object-cover" />
                    : conversation.name.charAt(0).toUpperCase()
                })()}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <p className="font-semibold text-[0.9rem] text-talkapp-fg truncate min-w-0 flex-1">
                  {conversation.name}
                </p>
                <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                  {conversation.lastMessageTime != null && (
                    <span className="text-[10px] text-talkapp-fg-muted font-medium">
                      {formatLastMessageTime(conversation.lastMessageTime)}
                    </span>
                  )}
                  {conversation.isMuted && (
                    <MuteIcon className="w-3 h-3 text-talkapp-fg-muted" aria-hidden />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-0.5">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  {(typingByChatId[conversation.id]?.length ?? 0) > 0 && !conversation.isRemovedFromGroup ? (
                    <p className="text-[0.78rem] text-talkapp-primary italic truncate">Escribiendo...</p>
                  ) : (
                    <>
                      {currentUserId && conversation.lastMessageSenderId === currentUserId && (
                        <span className="flex-shrink-0 text-talkapp-fg-muted">
                          {conversation.lastMessageReadBy?.some((id) => id !== currentUserId) ? (
                            <DoubleCheckIcon className="w-3.5 h-3.5 text-[#00C78C]" />
                          ) : conversation.lastMessageDeliveredBy?.some((id) => id !== currentUserId) ? (
                            <DoubleCheckIcon className="w-3.5 h-3.5 text-talkapp-fg-muted" />
                          ) : (
                            <SingleCheckIcon className="w-3.5 h-3.5 text-talkapp-fg-muted" />
                          )}
                        </span>
                      )}
                      {conversation.lastMessage != null && (
                        <p className="text-[0.78rem] text-talkapp-fg-muted truncate">{conversation.lastMessage}</p>
                      )}
                    </>
                  )}
                </div>
                {conversation.unread != null && conversation.unread > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-talkapp-primary text-white text-[10px] font-bold flex items-center justify-center">
                    {conversation.unread}
                  </span>
                )}
              </div>
            </div>
          </button>

          {(onMuteConversation || onUnmuteConversation || onClearConversation) && (
            <div className="relative flex-shrink-0" ref={menuOpen ? menuRef : undefined}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenId(menuOpen ? null : conversation.id)
                }}
                className="rounded-lg p-1.5 text-talkapp-fg-muted/50 hover:text-talkapp-fg-muted hover:bg-talkapp-panel/80 transition-all"
                aria-label="Opciones"
              >
                <DotsIcon />
              </button>
              {menuOpen && menuStyle && createPortal(
                <div
                  ref={menuDropdownRef}
                  className="fixed z-[100] w-48 rounded-lg border border-talkapp-border bg-talkapp-sidebar py-1 shadow-xl"
                  style={{ top: menuStyle.top, left: menuStyle.left }}
                >
                  {conversation.isMuted ? (
                    onUnmuteConversation && (
                      <button
                        type="button"
                        onClick={() => {
                          onUnmuteConversation(conversation.id)
                          setMenuOpenId(null)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel transition-colors"
                      >
                        <VolumeOnIcon className="h-4 w-4 shrink-0" />
                        Activar sonido
                      </button>
                    )
                  ) : (
                    onMuteConversation && (
                      <button
                        type="button"
                        onClick={() => {
                          onMuteConversation(conversation.id)
                          setMenuOpenId(null)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel transition-colors"
                      >
                        <MuteIcon className="h-4 w-4 shrink-0" />
                        Silenciar
                      </button>
                    )
                  )}
                  {onClearConversation && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null)
                        setClearConfirmConversationId(conversation.id)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-red-500/15 hover:text-red-400 transition-colors"
                    >
                      <TrashRowIcon className="h-4 w-4 shrink-0" />
                      Borrar conversación
                    </button>
                  )}
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex shrink-0 items-center gap-2 safe-t safe-l safe-r px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-talkapp-primary font-bold text-white text-base overflow-hidden">
              {currentUserAvatar ? (
                <img src={currentUserAvatar.startsWith('http') ? currentUserAvatar : `${env.apiUrl.replace(/\/$/, '')}${currentUserAvatar.startsWith('/') ? '' : '/'}${currentUserAvatar}`} alt="" className="w-full h-full object-cover" />
              ) : (
                currentUserName.charAt(0).toUpperCase()
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-talkapp-sidebar" />
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <span className="font-bold text-[0.95rem] tracking-tight">
              <span className="text-talkapp-primary">TalkApp</span>
            </span>
            {onEditProfile ? (
              <button type="button" onClick={onEditProfile} className="truncate block text-[0.72rem] text-talkapp-fg-muted hover:text-talkapp-primary text-left w-full transition-colors">
                {currentUserName}
              </button>
            ) : (
              <p className="truncate text-[0.72rem] text-talkapp-fg-muted">{currentUserName}</p>
            )}
          </div>
        </div>
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-xl p-2 text-talkapp-fg-muted hover:bg-white/5 hover:text-talkapp-primary transition-colors"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        )}
        <div className="relative flex-shrink-0">
          <button
            ref={headerMenuRef}
            type="button"
            onClick={() => setHeaderMenuOpen((v) => !v)}
            className="rounded-xl p-2 text-talkapp-fg-muted hover:bg-white/5 hover:text-talkapp-fg transition-colors"
            title="Opciones"
            aria-label="Opciones"
          >
            <DotsIcon />
          </button>
          {headerMenuOpen && headerMenuStyle && createPortal(
            <div
              ref={headerMenuDropdownRef}
              className="fixed z-[100] w-52 rounded-lg border border-talkapp-border bg-talkapp-sidebar py-1 shadow-xl"
              style={{ top: headerMenuStyle.top, left: headerMenuStyle.left }}
            >
              {onCreateGroup && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroup(true)
                    setHeaderMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel"
                >
                  <GroupIcon />
                  Nuevo grupo
                </button>
              )}
              {onOpenContacts && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenContacts()
                    setHeaderMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel"
                >
                  <PeopleIcon />
                  Contactos
                </button>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onLogout()
                    setHeaderMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-red-500/12 hover:text-red-400 transition-colors text-red-400/80"
                >
                  <LogoutIcon />
                  Cerrar sesión
                </button>
              )}
            </div>,
            document.body
          )}
        </div>
      </header>

      <div className="chat-messages-scroll overscroll-behavior-contain flex-1 min-h-0 overflow-y-auto">
        {conversationsLoading ? (
          <div className="flex items-center justify-center p-6 text-talkapp-fg-muted text-sm">
            Cargando conversaciones…
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-talkapp-fg-muted/60 text-sm">
            No hay conversaciones. Abre Contactos y inicia una conversación.
          </div>
        ) : (
          <ul className="divide-y divide-transparent">
            {conversations.map(renderConversationRow)}
          </ul>
        )}
      </div>

      {showCreateGroup && onCreateGroup && (
        <CreateConversationModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={onCreateGroup}
        />
      )}

      {clearConfirmConversationId && onClearConversation && (
        <ConfirmModal
          title="Borrar conversación"
          message="Los mensajes se ocultarán solo para ti. Los demás seguirán viendo el historial."
          confirmLabel="Borrar"
          danger
          onConfirm={() => {
            onClearConversation(clearConfirmConversationId)
            setClearConfirmConversationId(null)
          }}
          onCancel={() => setClearConfirmConversationId(null)}
        />
      )}
    </div>
  )
}

/* --- Iconos stroke modernos --- */

function DotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  )
}

function TrashRowIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function MuteIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

function VolumeOnIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function GroupIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
