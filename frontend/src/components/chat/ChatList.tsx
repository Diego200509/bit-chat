import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Chat } from '../../types/chat'
import { ConfirmModal } from './ConfirmModal'
import { CreateGroupModal } from './CreateGroupModal'
import { env } from '../../config/env'

function LastMessagePreview({ text }: { text: string }) {
  return (
    <p
      title={text}
      className="text-sm text-bitchat-fg-muted truncate max-w-[180px] sm:max-w-[220px]"
    >
      {text}
    </p>
  )
}

interface ChatListProps {
  chats: Chat[]
  currentChatId: string | null
  onSelectChat: (chatId: string) => void
  currentUserName?: string
  currentUserAvatar?: string | null
  onLogout?: () => void
  onOpenFriends?: () => void
  onEditProfile?: () => void
  chatsLoading?: boolean
  onPinChat?: (chatId: string) => void
  onUnpinChat?: (chatId: string) => void
  onArchiveChat?: (chatId: string) => void
  onUnarchiveChat?: (chatId: string) => void
  onCreateGroup?: (name: string, participantIds: string[], image?: string | null) => Promise<void>
  onClearChat?: (chatId: string) => void
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
}

export function ChatList({
  chats,
  currentChatId,
  onSelectChat,
  currentUserName = 'Yo',
  onLogout,
  onOpenFriends,
  currentUserAvatar,
  onEditProfile,
  chatsLoading = false,
  onPinChat,
  onUnpinChat,
  onArchiveChat,
  onUnarchiveChat,
  onCreateGroup,
  onClearChat,
  theme = 'dark',
  onToggleTheme,
}: ChatListProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const [clearConfirmChatId, setClearConfirmChatId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuDropdownRef = useRef<HTMLDivElement>(null)

  const mainChats = chats.filter((c) => !c.isArchived)
  const archivedChats = chats.filter((c) => c.isArchived)

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

  const renderChatRow = (chat: Chat) => {
    const isActive = currentChatId === chat.id
    const menuOpen = menuOpenId === chat.id
    return (
      <li key={chat.id} className="relative">
        <div className="flex w-full items-center gap-2 p-2 pr-1">
          <button
            type="button"
            onClick={() => onSelectChat(chat.id)}
            className={`flex flex-1 min-w-0 items-center gap-3 p-3 text-left transition-colors active:bg-bitchat-panel/90 min-h-[72px] touch-manipulation rounded-lg ${
              isActive ? 'bg-bitchat-panel border-l-2 border-bitchat-cyan' : 'hover:bg-bitchat-panel/70'
            }`}
          >
            {chat.isPinned && (
              <span className="flex-shrink-0 text-bitchat-cyan" title="Fijado">
                <PinIcon className="w-4 h-4" />
              </span>
            )}
            <div className="w-12 h-12 rounded-full bg-bitchat-blue-dark flex items-center justify-center text-bitchat-cyan font-semibold flex-shrink-0 overflow-hidden">
              {(() => {
                const avatarUrl = chat.avatar || chat.image
                const url = avatarUrl && avatarUrl.trim()
                  ? (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')
                      ? avatarUrl
                      : `${env.apiUrl.replace(/\/$/, '')}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`)
                  : null
                return url
                  ? <img src={url} alt="" className="w-full h-full object-cover" />
                  : chat.name.charAt(0).toUpperCase()
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-bitchat-fg truncate">{chat.name}</p>
              {chat.lastMessage && (
                <LastMessagePreview text={chat.lastMessage} />
              )}
            </div>
            {chat.unread != null && chat.unread > 0 && (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-bitchat-cyan text-bitchat-blue-dark text-xs font-bold flex items-center justify-center">
                {chat.unread}
              </span>
            )}
          </button>
          {(onPinChat || onArchiveChat || onClearChat) && (
            <div className="relative flex-shrink-0" ref={menuOpen ? menuRef : undefined}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenId(menuOpen ? null : chat.id)
                }}
                className="rounded-lg p-2 text-bitchat-fg-muted hover:bg-bitchat-panel hover:text-bitchat-fg"
                aria-label="Opciones"
              >
                <DotsIcon />
              </button>
              {menuOpen && menuStyle && createPortal(
                <div
                  ref={menuDropdownRef}
                  className="fixed z-[100] w-44 rounded-lg border border-bitchat-border bg-bitchat-sidebar py-1 shadow-xl"
                  style={{ top: menuStyle.top, left: menuStyle.left }}
                >
                  {chat.isPinned ? (
                    onUnpinChat && (
                      <button
                        type="button"
                        onClick={() => {
                          onUnpinChat(chat.id)
                          setMenuOpenId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-bitchat-panel"
                      >
                        Desfijar
                      </button>
                    )
                  ) : (
                    onPinChat && (
                      <button
                        type="button"
                        onClick={() => {
                          onPinChat(chat.id)
                          setMenuOpenId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-bitchat-panel"
                      >
                        Fijar
                      </button>
                    )
                  )}
                  {chat.isArchived ? (
                    onUnarchiveChat && (
                      <button
                        type="button"
                        onClick={() => {
                          onUnarchiveChat(chat.id)
                          setMenuOpenId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-bitchat-panel"
                      >
                        Desarchivar
                      </button>
                    )
                  ) : (
                    onArchiveChat && (
                      <button
                        type="button"
                        onClick={() => {
                          onArchiveChat(chat.id)
                          setMenuOpenId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-bitchat-fg hover:bg-bitchat-panel"
                      >
                        Archivar
                      </button>
                    )
                  )}
                  {onClearChat && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null)
                        setClearConfirmChatId(chat.id)
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-bitchat-panel"
                    >
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
      <header className="flex shrink-0 items-center gap-2 border-b border-bitchat-border p-3 sm:p-4 safe-t safe-l safe-r">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bitchat-cyan font-bold text-bitchat-blue-dark text-lg overflow-hidden">
            {currentUserAvatar ? (
              <img src={currentUserAvatar.startsWith('http') ? currentUserAvatar : `${env.apiUrl.replace(/\/$/, '')}${currentUserAvatar.startsWith('/') ? '' : '/'}${currentUserAvatar}`} alt="" className="w-full h-full object-cover" />
            ) : (
              'b'
            )}
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <span className="font-semibold text-lg truncate">
              <span className="text-bitchat-blue-mid">Bit</span><span className="text-bitchat-cyan">Chat</span>
            </span>
            {onEditProfile ? (
              <button type="button" onClick={onEditProfile} className="truncate block text-xs text-bitchat-fg/80 hover:text-bitchat-cyan text-left w-full">
                {currentUserName}
              </button>
            ) : (
              <p className="truncate text-xs text-bitchat-fg/80">{currentUserName}</p>
            )}
          </div>
        </div>
        {onCreateGroup && (
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="rounded-lg p-2 text-bitchat-fg-muted hover:bg-bitchat-panel hover:text-bitchat-cyan transition-colors"
            title="Nuevo grupo"
            aria-label="Nuevo grupo"
          >
            <GroupIcon />
          </button>
        )}
        {onOpenFriends && (
          <button
            type="button"
            onClick={onOpenFriends}
            className="rounded-lg p-2 text-bitchat-fg-muted hover:bg-bitchat-panel hover:text-bitchat-cyan transition-colors"
            title="Amigos"
            aria-label="Amigos"
          >
            <PeopleIcon />
          </button>
        )}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-lg p-2 text-bitchat-fg-muted hover:bg-bitchat-panel hover:text-bitchat-cyan transition-colors"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2 text-bitchat-fg-muted hover:bg-bitchat-panel hover:text-bitchat-fg transition-colors"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogoutIcon />
          </button>
        )}
      </header>

      <div className="chat-messages-scroll overscroll-behavior-contain flex-1 min-h-0 overflow-y-auto">
        {chatsLoading ? (
          <div className="flex items-center justify-center p-6 text-bitchat-fg-muted text-sm">
            Cargando conversaciones…
          </div>
        ) : mainChats.length === 0 && archivedChats.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            No hay conversaciones. Abre Amigos y chatea con alguien.
          </div>
        ) : (
          <>
            <ul className="divide-y divide-bitchat-border">
              {mainChats.map(renderChatRow)}
            </ul>
            {archivedChats.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowArchived(!showArchived)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-bitchat-fg-muted hover:bg-bitchat-panel/50"
                >
                  <ChevronIcon className={`w-4 h-4 transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                  Archivados ({archivedChats.length})
                </button>
                {showArchived && (
                  <ul className="divide-y divide-bitchat-border">
                    {archivedChats.map(renderChatRow)}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>

      {showCreateGroup && onCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={onCreateGroup}
        />
      )}

      {clearConfirmChatId && onClearChat && (
        <ConfirmModal
          title="Borrar conversación"
          message="Los mensajes se ocultarán solo para ti. Los demás seguirán viendo el historial."
          confirmLabel="Borrar"
          danger
          onConfirm={() => {
            onClearChat(clearConfirmChatId)
            setClearConfirmChatId(null)
          }}
          onCancel={() => setClearConfirmChatId(null)}
        />
      )}
    </div>
  )
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M16.5 3.75a3.75 3.75 0 0 0-2.25 6.72 3.75 3.75 0 0 0 1.5 2.28v7.5h3v-7.5a3.75 3.75 0 0 0 1.5-2.28 3.75 3.75 0 0 0-2.25-6.72ZM12 15a3 3 0 0 1-3-3V6a3 3 0 1 1 6 0v6a3 3 0 0 1-3 3Z" clipRule="evenodd" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
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
