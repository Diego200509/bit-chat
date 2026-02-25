import { useAuth } from './context/AuthContext'
import { useChat } from './hooks/useChat'
import { AuthScreen } from './components/auth'
import { ChatList, ChatWindow } from './components/chat'

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

  return (
    <div className="h-screen flex bg-bitchat-bg text-slate-100">
      <ChatList
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={selectChat}
        currentUserName={currentUserName}
        onLogout={logout}
      />
      <ChatWindow
        chat={currentChat}
        onSendMessage={sendMessage}
        currentUserId={currentUserId}
      />
      {!connected && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded-lg bg-amber-600/90 text-white text-sm">
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
