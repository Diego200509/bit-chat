import { useState, useCallback } from 'react'
import { useAuth } from './context/AuthContext'
import { useChat } from './hooks/useChat'
import { useBlocked } from './hooks/useBlocked'
import { AuthScreen } from './components/auth'
import { ChatList, ChatWindow, EditProfileModal } from './components/chat'
import { FriendsPanel } from './components/friends'

type MobileView = 'list' | 'chat'

function ChatLayout() {
  const { user, logout, updateProfile } = useAuth()
  const { blockedIds, blockUser, unblockUser } = useBlocked()
  const displayName = user?.nickname?.trim() || user?.name || 'Yo'
  const {
    chats,
    currentChatId,
    currentChat,
    chatsLoading,
    connected,
    currentUserId,
    selectChat,
    sendMessage,
    openDirectChat,
    pinChat,
    unpinChat,
    archiveChat,
    unarchiveChat,
    createGroupAndSelect,
    sendImage,
    sendSticker,
    addReaction,
  } = useChat(user!.id, displayName)

  const [mobileView, setMobileView] = useState<MobileView>('list')
  const [showFriendsPanel, setShowFriendsPanel] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId)
    setMobileView('chat')
  }

  const handleBackToList = () => {
    setMobileView('list')
  }

  const handleOpenFriends = () => setShowFriendsPanel(true)
  const handleCloseFriends = () => setShowFriendsPanel(false)

  const handleOpenChatWithFriend = useCallback(
    (otherUserId: string) => {
      openDirectChat(otherUserId)
      setShowFriendsPanel(false)
      setMobileView('chat')
    },
    [openDirectChat]
  )

  const handleBlockUser = useCallback(
    async (userId: string) => {
      try {
        await blockUser(userId)
      } catch {
        // toast o mensaje
      }
    },
    [blockUser]
  )

  const handleUnblockUser = useCallback(
    async (userId: string) => {
      try {
        await unblockUser(userId)
      } catch {
        // toast o mensaje
      }
    },
    [unblockUser]
  )

  return (
    <div className="h-screen flex overflow-hidden bg-bitchat-bg text-slate-100">
      <aside
        className={`flex flex-col w-full md:w-[380px] md:flex-shrink-0 border-r border-bitchat-border bg-bitchat-sidebar ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {showFriendsPanel ? (
          <FriendsPanel onOpenChat={handleOpenChatWithFriend} onClose={handleCloseFriends} />
        ) : (
          <ChatList
            chats={chats}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            currentUserName={displayName}
            onLogout={logout}
            onOpenFriends={handleOpenFriends}
            onEditProfile={() => setShowEditProfile(true)}
            chatsLoading={chatsLoading}
            onPinChat={pinChat}
            onUnpinChat={unpinChat}
            onArchiveChat={archiveChat}
            onUnarchiveChat={unarchiveChat}
            onCreateGroup={createGroupAndSelect}
          />
        )}
      </aside>
      <main
        className={`flex flex-1 flex-col min-w-0 min-h-0 ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatWindow
          chat={currentChat}
          onSendMessage={sendMessage}
          onSendImage={sendImage}
          onSendSticker={sendSticker}
          onReaction={addReaction}
          currentUserId={currentUserId}
          onBack={handleBackToList}
          onBlockUser={handleBlockUser}
          onUnblockUser={handleUnblockUser}
          blockedUserIds={blockedIds}
        />
      </main>
      {showEditProfile && user && (
        <EditProfileModal
          currentName={user.name}
          currentNickname={user.nickname?.trim() ?? ''}
          onClose={() => setShowEditProfile(false)}
          onSave={async (nickname: string) => updateProfile({ nickname: nickname || null })}
        />
      )}
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
