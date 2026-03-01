import { useState, useRef, useEffect } from 'react'
import type { Chat } from '../../types/chat'
import { CreateGroupModal } from './CreateGroupModal'

interface ChatListProps {
  chats: Chat[]
  currentChatId: string | null
  onSelectChat: (chatId: string) => void
  currentUserName?: string
  onLogout?: () => void
  onOpenFriends?: () => void
  onEditProfile?: () => void
  chatsLoading?: boolean
  onPinChat?: (chatId: string) => void
  onUnpinChat?: (chatId: string) => void
  onArchiveChat?: (chatId: string) => void
  onUnarchiveChat?: (chatId: string) => void
  onCreateGroup?: (name: string, participantIds: string[], image?: string | null) => Promise<void>
}

/**
 * Sidebar con la lista de conversaciones (estilo WhatsApp). Fijados arriba; archivados en sección aparte.
 */
export function ChatList({
  chats,
  currentChatId,
  onSelectChat,
  currentUserName = 'Yo',
  onLogout,
  onOpenFriends,
  onEditProfile,
  chatsLoading = false,
  onPinChat,
  onUnpinChat,
  onArchiveChat,
  onUnarchiveChat,
  onCreateGroup,
}: ChatListProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const mainChats = chats.filter((c) => !c.isArchived)
  const archivedChats = chats.filter((c) => c.isArchived)

  useEffect(() => {
    if (!menuOpenId) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null)
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
            <div className="w-12 h-12 rounded-full bg-bitchat-blue-dark flex items-center justify-center text-bitchat-cyan font-semibold flex-shrink-0">
              {chat.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-100 truncate">{chat.name}</p>
              {chat.lastMessage && (
                <p className="text-sm text-slate-500 truncate">{chat.lastMessage}</p>
              )}
            </div>
            {chat.unread && chat.unread > 0 && (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-bitchat-cyan text-bitchat-blue-dark text-xs font-bold flex items-center justify-center">
                {chat.unread}
              </span>
            )}
          </button>
          {(onPinChat || onArchiveChat) && (
            <div className="relative flex-shrink-0" ref={menuOpen ? menuRef : undefined}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenId(menuOpen ? null : chat.id)
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-bitchat-panel hover:text-slate-200"
                aria-label="Opciones"
              >
                <DotsIcon />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-bitchat-border bg-bitchat-sidebar py-1 shadow-lg">
                  {chat.isPinned ? (
                    onUnpinChat && (
                      <button
                        type="button"
                        onClick={() => {
                          onUnpinChat(chat.id)
                          setMenuOpenId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-bitchat-panel"
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
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-bitchat-panel"
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
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-bitchat-panel"
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
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-bitchat-panel"
                      >
                        Archivar
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-bitchat-border p-4 safe-t">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bitchat-cyan font-bold text-bitchat-blue-dark text-lg">
            b
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold text-bitchat-cyan">BitChat</h1>
            {onEditProfile ? (
              <button type="button" onClick={onEditProfile} className="truncate block text-xs text-slate-400 hover:text-bitchat-cyan text-left w-full">
                {currentUserName}
              </button>
            ) : (
              <p className="truncate text-xs text-slate-400">{currentUserName}</p>
            )}
          </div>
        </div>
        {onCreateGroup && (
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="rounded-lg p-2 text-slate-400 hover:bg-bitchat-panel hover:text-bitchat-cyan transition-colors"
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
            className="rounded-lg p-2 text-slate-400 hover:bg-bitchat-panel hover:text-bitchat-cyan transition-colors"
            title="Amigos"
            aria-label="Amigos"
          >
            <PeopleIcon />
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2 text-slate-400 hover:bg-bitchat-panel hover:text-slate-200 transition-colors"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogoutIcon />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {chatsLoading ? (
          <div className="flex items-center justify-center p-6 text-slate-500 text-sm">
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
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-400 hover:bg-bitchat-panel/50"
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

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6ZM5.25 12a.75.75 0 0 1 .75-.75h7.19L13.47 9.53a.75.75 0 0 1 1.06-1.06l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l2.22-2.22H6a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
  )
}
