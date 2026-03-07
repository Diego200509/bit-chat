import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { useChat } from './hooks/useChat'
import { useTheme } from './hooks/useTheme'
import { useBlocked } from './hooks/useBlocked'
import { useOnlineUsers } from './hooks/useOnlineUsers'
import { ToastProvider } from './context/ToastContext'
import { AuthScreen } from './components/auth'
import { ChatList, ChatWindow, EditProfileModal } from './components/chat'
import { FriendsPanel } from './components/friends'
import { socket } from './lib/socket'
import { SOCKET_EVENTS } from './constants/socket'
import { env } from './config/env'

const JITSI_BASE = 'https://meet.jit.si'

type MobileView = 'list' | 'chat'

type IncomingCall = {
  chatId: string
  roomName: string
  callerId: string
  callerName: string
  callerAvatar?: string | null
}

function fullAvatarUrl(avatar: string | null | undefined): string {
  if (!avatar) return ''
  if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar
  const base = env.apiUrl.replace(/\/$/, '')
  return avatar.startsWith('/') ? `${base}${avatar}` : `${base}/${avatar}`
}

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
    deleteMessage,
    clearChat,
  } = useChat(user!.id, displayName, {
    getIsChatPanelVisible: () => mobileView === 'chat' || (typeof window !== 'undefined' && window.innerWidth >= 768),
  })
  const [showFriendsPanel, setShowFriendsPanel] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)

  const openJitsi = useCallback((roomName: string) => {
    const safeName = roomName.replace(/[^a-zA-Z0-9-]/g, '') || `room-${Date.now()}`
    const url = `${JITSI_BASE}/${safeName}`
    const w = window.open(url, 'jitsi', 'noopener,noreferrer,width=900,height=640')
    if (!w) window.location.href = url
  }, [])

  useEffect(() => {
    const onIncoming = (payload: IncomingCall) => setIncomingCall(payload)
    const onCancelled = () => setIncomingCall(null)
    socket.on(SOCKET_EVENTS.VIDEO_CALL_INCOMING, onIncoming)
    socket.on(SOCKET_EVENTS.VIDEO_CALL_CANCELLED, onCancelled)
    return () => {
      socket.off(SOCKET_EVENTS.VIDEO_CALL_INCOMING, onIncoming)
      socket.off(SOCKET_EVENTS.VIDEO_CALL_CANCELLED, onCancelled)
    }
  }, [])

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
      } catch {}
    },
    [blockUser]
  )

  const handleUnblockUser = useCallback(
    async (userId: string) => {
      try {
        await unblockUser(userId)
      } catch {}
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
            onClearChat={clearChat}
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
          onDeleteMessage={deleteMessage}
          onClearChat={clearChat}
          currentUserName={displayName}
          currentUserAvatar={user?.avatar}
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

      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-bitchat-sidebar border border-bitchat-border shadow-2xl overflow-hidden">
            <div className="p-6 pb-4 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-bitchat-panel border-4 border-bitchat-cyan/50 flex items-center justify-center ring-4 ring-bitchat-cyan/20">
                  {incomingCall.callerAvatar ? (
                    <img
                      src={fullAvatarUrl(incomingCall.callerAvatar)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl text-slate-500">👤</span>
                  )}
                </div>
                <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-bitchat-cyan text-bitchat-blue-dark">
                  <VideoCallRingingIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="text-slate-400 text-sm font-medium">Videollamada entrante</p>
              <p className="text-slate-100 text-xl font-semibold mt-1">{incomingCall.callerName}</p>
              <p className="text-bitchat-cyan text-sm mt-0.5">te está llamando</p>
            </div>
            <div className="flex gap-3 p-4 pt-0">
              <button
                type="button"
                onClick={() => {
                  socket.emit(SOCKET_EVENTS.VIDEO_CALL_REJECT, { callerId: incomingCall.callerId })
                  setIncomingCall(null)
                }}
                className="flex-1 rounded-xl py-3.5 bg-red-600 text-white font-semibold hover:bg-red-500 active:opacity-90 transition-colors"
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={() => {
                  socket.emit(SOCKET_EVENTS.VIDEO_CALL_ANSWER, {
                    chatId: incomingCall.chatId,
                    roomName: incomingCall.roomName,
                    callerId: incomingCall.callerId,
                  })
                  openJitsi(incomingCall.roomName)
                  setIncomingCall(null)
                }}
                className="flex-1 rounded-xl py-3.5 bg-bitchat-cyan text-bitchat-blue-dark font-semibold hover:opacity-90 active:opacity-80 transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VideoCallRingingIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.5l-.5-.5A2 2 0 0 0 13 2h-2a2 2 0 0 0-1.5.5L9 4H7a2 2 0 0 0-2 2v1.5l4 2.5V17H6V9.5L4 8V7Z" />
    </svg>
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

  return (
    <ToastProvider>
      <ChatLayout />
    </ToastProvider>
  )
}

export default App
