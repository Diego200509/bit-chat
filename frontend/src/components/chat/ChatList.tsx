import type { Chat } from '../../types/chat'

interface ChatListProps {
  chats: Chat[]
  currentChatId: string | null
  onSelectChat: (chatId: string) => void
  currentUserName?: string
  onLogout?: () => void
  onOpenFriends?: () => void
  chatsLoading?: boolean
}

/**
 * Sidebar con la lista de conversaciones (estilo WhatsApp).
 */
export function ChatList({
  chats,
  currentChatId,
  onSelectChat,
  currentUserName = 'Yo',
  onLogout,
  onOpenFriends,
  chatsLoading = false,
}: ChatListProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-bitchat-border p-4 safe-t">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bitchat-cyan font-bold text-bitchat-blue-dark text-lg">
          b
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold text-bitchat-cyan">BitChat</h1>
          <p className="truncate text-xs text-slate-400">{currentUserName}</p>
        </div>
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
        ) : chats.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            No hay conversaciones. Abre Amigos y chatea con alguien.
          </div>
        ) : (
          <ul className="divide-y divide-bitchat-border">
            {chats.map((chat) => {
              const isActive = currentChatId === chat.id
              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectChat(chat.id)}
                    className={`flex w-full items-center gap-3 p-4 text-left transition-colors active:bg-bitchat-panel/90 min-h-[72px] touch-manipulation ${
                      isActive
                        ? 'bg-bitchat-panel border-l-2 border-bitchat-cyan'
                        : 'hover:bg-bitchat-panel/70'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-bitchat-blue-dark flex items-center justify-center text-bitchat-cyan font-semibold flex-shrink-0">
                      {chat.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-100 truncate">
                        {chat.name}
                      </p>
                      {chat.lastMessage && (
                        <p className="text-sm text-slate-500 truncate">
                          {chat.lastMessage}
                        </p>
                      )}
                    </div>
                    {chat.unread && chat.unread > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-bitchat-cyan text-bitchat-blue-dark text-xs font-bold flex items-center justify-center">
                        {chat.unread}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
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
