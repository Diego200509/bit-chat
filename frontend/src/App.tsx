import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { useChat } from './hooks/useChat'
import { AuthScreen } from './components/auth'
import { ChatList, ChatWindow } from './components/chat'

/** En móvil: 'list' = solo lista de chats, 'chat' = solo ventana de conversación */
type MobileView = 'list' | 'chat'

function ChatLayout() {
  const { user, logout } = useAuth()
  const {
    chats,
    currentChatId,
    currentChat,
    connected,
    currentUserId,
    currentUserName,
    selectChat,
    sendMessage,
  } = useChat(user!.id, user!.name)

  const [mobileView, setMobileView] = useState<MobileView>('list')

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId)
    setMobileView('chat')
  }

  const handleBackToList = () => {
    setMobileView('list')
  }

  return (
    <div className="h-screen flex overflow-hidden bg-bitchat-bg text-slate-100">
      <aside
        className={`flex flex-col w-full md:w-[380px] md:flex-shrink-0 border-r border-bitchat-border bg-bitchat-sidebar ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatList
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          currentUserName={currentUserName}
          onLogout={logout}
        />
      </aside>
      <main
        className={`flex flex-1 flex-col min-w-0 min-h-0 ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatWindow
          chat={currentChat}
          onSendMessage={sendMessage}
          currentUserId={currentUserId}
          onBack={handleBackToList}
        />
      </main>
      {!connected && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded-lg bg-amber-600/90 text-white text-sm z-20 safe-b">
          Reconectando…
        </div>
      )}
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bitchat-bg">
        <div className="text-bitchat-cyan">Cargando…</div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return <ChatLayout />
}

export default App
