import { useState, useCallback } from 'react'
import { useAuth } from './context/AuthContext'
import { useChat } from './hooks/useChat'
import { useTheme } from './hooks/useTheme'
import { useBlocked } from './hooks/useBlocked'
import { useOnlineUsers } from './hooks/useOnlineUsers'
import { AuthScreen } from './components/auth'
import { ChatList, ChatWindow, EditProfileModal } from './components/chat'
import { FriendsPanel } from './components/friends'

type MobileView = 'list' | 'chat'

function ChatLayout() {
  const { user, logout, updateProfile } = useAuth()
  const { blockedIds, blockUser, unblockUser } = useBlocked()
  const displayName = user?.nickname?.trim() || user?.name || 'Yo'
  const { theme, toggleTheme } = useTheme()
  const [mobileView, setMobileView] = useState<MobileView>('list')
  const onlineUserIds = useOnlineUsers()
  const {
    chats,
    currentChatId,
    currentChat,
    chatPresenceByChatId,
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
    editMessage,
    pinMessage,
    unpinMessage,
    updateChatBackground,
  } = useChat(user!.id, displayName, {
    getIsChatPanelVisible: () => mobileView === 'chat' || (typeof window !== 'undefined' && window.innerWidth >= 768),
  })
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
            currentUserAvatar={user?.avatar}
            onLogout={logout}
            onOpenFriends={handleOpenFriends}
            onEditProfile={() => setShowEditProfile(true)}
            chatsLoading={chatsLoading}
            onPinChat={pinChat}
            onUnpinChat={unpinChat}
            onArchiveChat={archiveChat}
            onUnarchiveChat={unarchiveChat}
            onCreateGroup={createGroupAndSelect}
            theme={theme}
            onToggleTheme={toggleTheme}
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
          onEditMessage={editMessage}
          onPinMessage={pinMessage}
          onUnpinMessage={unpinMessage}
          onUpdateChatBackground={updateChatBackground}
          currentUserId={currentUserId}
          onBack={handleBackToList}
          onBlockUser={handleBlockUser}
          onUnblockUser={handleUnblockUser}
          blockedUserIds={blockedIds}
          otherUserOnline={currentChat?.otherUserId ? onlineUserIds.has(currentChat.otherUserId) : undefined}
          usersInCurrentChat={currentChatId ? (chatPresenceByChatId[currentChatId] ?? []) : []}
        />
      </main>
      {showEditProfile && user && (
        <EditProfileModal
          currentName={user.name}
          currentNickname={user.nickname?.trim() ?? ''}
          currentAvatar={user.avatar}
          currentVisibility={user.visibility ?? 'visible'}
          onClose={() => setShowEditProfile(false)}
          onSave={async (updates) => updateProfile({ nickname: updates.nickname || null, avatar: updates.avatar ?? undefined, visibility: updates.visibility })}
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
