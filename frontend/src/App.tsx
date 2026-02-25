import { useChat } from './hooks/useChat'
import { ChatList, ChatWindow } from './components/chat'

function App() {
  const {
    chats,
    currentChatId,
    currentChat,
    connected,
    currentUserId,
    currentUserName,
    selectChat,
    sendMessage,
  } = useChat()

  return (
    <div className="h-screen flex bg-bitchat-bg text-slate-100">
      <ChatList
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={selectChat}
        currentUserName={currentUserName}
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

export default App
