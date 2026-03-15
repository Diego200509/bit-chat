import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Conversation } from '../../types/conversation'
import { ConfirmModal } from './ConfirmModal'
import { CreateConversationModal } from './CreateConversationModal'
import { env } from '../../config/env'

function LastMessagePreview({ text }: { text: string }) {
  return (
    <p
      title={text}
      className="text-sm text-talkapp-fg-muted truncate max-w-[180px] sm:max-w-[220px]"
    >
      {text}
    </p>
  )
}

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
        <div className="flex w-full items-center gap-2 p-2 pr-1">
          <button
            type="button"
            onClick={() => onSelectConversation(conversation.id)}
            className={`flex flex-1 min-w-0 items-center gap-3 p-3 text-left transition-colors active:bg-talkapp-panel/90 min-h-[72px] touch-manipulation rounded-lg ${
              isActive ? 'bg-talkapp-panel border-l-2 border-talkapp-primary' : 'hover:bg-talkapp-panel/70'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-talkapp-on-primary flex items-center justify-center text-talkapp-primary font-semibold flex-shrink-0 overflow-hidden">
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-medium text-talkapp-fg truncate min-w-0 flex-1">
                  {conversation.otherUserId != null && conversation.otherUserStatus?.trim()
                    ? `${conversation.name} · ${conversation.otherUserStatus}`
                    : conversation.name}
                </p>
                <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                  {conversation.lastMessageTime != null && (
                    <span className="text-[11px] text-talkapp-fg-muted">
                      {formatLastMessageTime(conversation.lastMessageTime)}
                    </span>
                  )}
                  {conversation.isMuted && (
                    <MuteIcon className="w-3.5 h-3.5 text-talkapp-fg-muted" aria-hidden />
                  )}
                </div>
              </div>
              {(conversation.lastMessage != null || ((typingByChatId[conversation.id]?.length ?? 0) > 0 && !conversation.isRemovedFromGroup)) && (
                <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                  {(typingByChatId[conversation.id]?.length ?? 0) > 0 && !conversation.isRemovedFromGroup ? (
                    <p className="text-sm text-talkapp-fg-muted truncate max-w-[180px] sm:max-w-[220px] italic">
                      Escribiendo...
                    </p>
                  ) : (
                    <>
                      {currentUserId && conversation.lastMessageSenderId === currentUserId && (
                        <span
                          className="flex-shrink-0 text-talkapp-fg-muted"
                          title={
                            conversation.lastMessageReadBy?.some((id) => id !== currentUserId)
                              ? 'Visto'
                              : conversation.lastMessageDeliveredBy?.some((id) => id !== currentUserId)
                                ? 'Entregado'
                                : 'Enviado'
                          }
                        >
                          {conversation.lastMessageReadBy?.some((id) => id !== currentUserId) ? (
                            <DoubleCheckIcon className="w-3.5 h-3.5 text-[#00C78C]" />
                          ) : conversation.lastMessageDeliveredBy?.some((id) => id !== currentUserId) ? (
                            <DoubleCheckIcon className="w-3.5 h-3.5 text-talkapp-fg-muted" />
                          ) : (
                            <SingleCheckIcon className="w-3.5 h-3.5 text-talkapp-fg-muted" />
                          )}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <LastMessagePreview text={conversation.lastMessage ?? ''} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {conversation.unread != null && conversation.unread > 0 && (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-talkapp-primary text-talkapp-on-primary text-xs font-bold flex items-center justify-center">
                {conversation.unread}
              </span>
            )}
          </button>
          {(onMuteConversation || onUnmuteConversation || onClearConversation) && (
            <div className="relative flex-shrink-0" ref={menuOpen ? menuRef : undefined}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenId(menuOpen ? null : conversation.id)
                }}
                className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-fg"
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
                        <VolumeOnIcon className="h-5 w-5 shrink-0" />
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
                        <MuteIcon className="h-5 w-5 shrink-0" />
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
                      <TrashRowIcon className="h-5 w-5 shrink-0" />
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
      <header className="flex shrink-0 items-center gap-2 border-b border-talkapp-border p-3 sm:p-4 safe-t safe-l safe-r">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-talkapp-primary font-bold text-talkapp-on-primary text-lg overflow-hidden">
            {currentUserAvatar ? (
              <img src={currentUserAvatar.startsWith('http') ? currentUserAvatar : `${env.apiUrl.replace(/\/$/, '')}${currentUserAvatar.startsWith('/') ? '' : '/'}${currentUserAvatar}`} alt="" className="w-full h-full object-cover" />
            ) : (
              'T'
            )}
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <span className="font-semibold text-lg truncate">
              <span className="text-talkapp-primary">TalkApp</span>
            </span>
            {onEditProfile ? (
              <button type="button" onClick={onEditProfile} className="truncate block text-xs text-talkapp-fg/80 hover:text-talkapp-primary text-left w-full">
                {currentUserName}
              </button>
            ) : (
              <p className="truncate text-xs text-talkapp-fg/80">{currentUserName}</p>
            )}
          </div>
        </div>
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-primary transition-colors"
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
            className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-fg transition-colors"
            title="Opciones"
            aria-label="Opciones"
          >
            <DotsIcon />
          </button>
          {headerMenuOpen && headerMenuStyle && createPortal(
            <div
              ref={headerMenuDropdownRef}
              className="fixed z-[100] w-48 rounded-lg border border-talkapp-border bg-talkapp-sidebar py-1 shadow-xl"
              style={{ top: headerMenuStyle.top, left: headerMenuStyle.left }}
            >
              {onCreateGroup && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroup(true)
                    setHeaderMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel"
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
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-talkapp-panel"
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
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-talkapp-fg hover:bg-red-500/15 hover:text-red-400 transition-colors"
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
          <div className="p-6 text-center text-slate-500 text-sm">
            No hay conversaciones. Abre Contactos y inicia una conversación.
          </div>
        ) : (
          <ul className="divide-y divide-talkapp-border">
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

function DotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
    </svg>
  )
}

function TrashRowIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
    </svg>
  )
}

function MuteIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z" />
      <path fillRule="evenodd" d="M3.53 3.53a.75.75 0 0 1 1.06 0l14 14a.75.75 0 0 1-1.06 1.06L3.53 4.59a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  )
}

function VolumeOnIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z" />
      <path fillRule="evenodd" d="M18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  )
}

function GroupIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M12 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm4-10c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2Zm0 6c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2Zm0 6c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2Zm4-10c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2Zm0 6c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2Zm0 6c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2Z" clipRule="evenodd" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21c-2.513 0-4.746-.797-6.75-2.257a6.75 6.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6ZM5.25 12a.75.75 0 0 1 .75-.75h7.19L13.47 9.53a.75.75 0 0 1 1.06-1.06l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l2.22-2.22H6a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
  )
}
