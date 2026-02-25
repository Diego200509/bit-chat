import type { Chat } from '../../types/chat'

interface ChatListProps {
  chats: Chat[]
  currentChatId: string | null
  onSelectChat: (chatId: string) => void
  currentUserName?: string
}

/**
 * Sidebar con la lista de conversaciones (estilo WhatsApp).
 */
export function ChatList({
  chats,
  currentChatId,
  onSelectChat,
  currentUserName = 'Yo',
}: ChatListProps) {
  return (
    <div className="w-full md:w-[380px] flex flex-col bg-bitchat-sidebar border-r border-bitchat-border flex-shrink-0">
      <header className="p-4 border-b border-bitchat-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-bitchat-cyan flex items-center justify-center text-bitchat-blue-dark font-bold text-lg">
          b
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-bitchat-cyan truncate">
            BitChat
          </h1>
          <p className="text-xs text-slate-400 truncate">{currentUserName}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            No hay conversaciones. El backend asignará chats cuando te conectes.
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
                    className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
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
