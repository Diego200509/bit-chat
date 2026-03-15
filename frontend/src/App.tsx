import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { useConversations } from './hooks/useConversations'
import { useTheme } from './hooks/useTheme'
import { useBlocked } from './hooks/useBlocked'
import { useOnlineUsers } from './hooks/useOnlineUsers'
import { ToastProvider } from './context/ToastContext'
import { AuthScreen } from './components/auth'
import { ConversationList, ConversationView, EditProfileModal, ConfirmModal } from './components/conversations'
import { ContactsPanel } from './components/contacts'
import { socket } from './lib/socket'
import { SOCKET_EVENTS } from './constants/socket'
import { env } from './config/env'

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
    conversations,
    currentChatId,
    currentConversation,
    chatPresenceByChatId,
    typingByChatId,
    conversationsLoading,
    connected,
    currentUserId,
    selectConversation,
    sendMessage,
    openDirectConversation,
    muteConversation,
    unmuteConversation,
    createGroupAndSelect,
    sendImage,
    sendDocument,
    sendVoice,
    deleteMessage,
    clearConversation,
    refreshConversations,
  } = useConversations(user!.id, displayName, {
    getIsConversationPanelVisible: () => mobileView === 'chat' || (typeof window !== 'undefined' && window.innerWidth >= 768),
  })
  const [showContactsPanel, setShowContactsPanel] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)

  const openJitsi = useCallback((roomName: string) => {
    const safeName = roomName.replace(/[^a-zA-Z0-9-]/g, '') || `room-${Date.now()}`
    const url = `https://meet.jit.si/${safeName}`
    window.open(url, 'jitsi', 'noopener,noreferrer,width=900,height=640')
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

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId)
    setMobileView('chat')
  }

  const handleBackToList = () => {
    setMobileView('list')
  }

  const handleOpenContacts = () => setShowContactsPanel(true)
  const handleCloseContacts = () => setShowContactsPanel(false)

  const handleOpenConversationWithContact = useCallback(
    (otherUserId: string) => {
      openDirectConversation(otherUserId)
      setShowContactsPanel(false)
      setMobileView('chat')
    },
    [openDirectConversation]
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
    <div className="min-h-screen bg-talkapp-bg text-talkapp-fg p-1.5 sm:p-2 md:p-2.5">
      <div className="h-[calc(100vh-0.75rem)] sm:h-[calc(100vh-1rem)] md:h-[calc(100vh-1.25rem)] flex overflow-hidden rounded-lg border border-talkapp-border/60 shadow-lg">
      <aside
        className={`flex flex-col w-full md:w-[380px] md:flex-shrink-0 md:border-r md:border-talkapp-border bg-talkapp-sidebar ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {showContactsPanel ? (
          <ContactsPanel onOpenConversation={handleOpenConversationWithContact} onClose={handleCloseContacts} />
        ) : (
          <ConversationList
            conversations={conversations}
            currentChatId={currentChatId}
            onSelectConversation={handleSelectConversation}
            currentUserId={currentUserId}
            currentUserName={displayName}
            currentUserAvatar={user?.avatar}
            typingByChatId={typingByChatId}
            onLogout={() => setShowLogoutConfirm(true)}
            onOpenContacts={handleOpenContacts}
            onEditProfile={() => setShowEditProfile(true)}
            conversationsLoading={conversationsLoading}
            onMuteConversation={muteConversation}
            onUnmuteConversation={unmuteConversation}
            onCreateGroup={createGroupAndSelect}
            onClearConversation={clearConversation}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}
      </aside>
      <main
        className={`flex flex-1 flex-col min-w-0 min-h-0 bg-talkapp-bg ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ConversationView
          conversation={currentConversation}
          onSendMessage={sendMessage}
          onSendImage={sendImage}
          onSendDocument={sendDocument}
          onSendVoice={sendVoice}
          currentUserId={currentUserId}
          onBack={handleBackToList}
          onBlockUser={handleBlockUser}
          onUnblockUser={handleUnblockUser}
          blockedUserIds={blockedIds}
          otherUserOnline={currentConversation?.otherUserId ? onlineUserIds.has(currentConversation.otherUserId) : undefined}
          usersInCurrentConversation={currentChatId ? (chatPresenceByChatId[currentChatId] ?? []) : []}
          onDeleteMessage={deleteMessage}
          onClearConversation={clearConversation}
          onGroupUpdated={refreshConversations}
          currentUserName={displayName}
          currentUserAvatar={user?.avatar}
        />
      </main>
      </div>
      {showLogoutConfirm && (
        <ConfirmModal
          title="Cerrar sesión"
          message="¿Estás seguro de que quieres cerrar sesión?"
          confirmLabel="Cerrar sesión"
          danger
          onConfirm={() => {
            setShowLogoutConfirm(false)
            logout()
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
      {showEditProfile && user && (
        <EditProfileModal
          currentName={user.name}
          currentNickname={user.nickname?.trim() ?? ''}
          currentAvatar={user.avatar}
          currentStatus={user.status}
          onClose={() => setShowEditProfile(false)}
          onSave={async (updates) => updateProfile({ nickname: updates.nickname || null, avatar: updates.avatar !== undefined ? updates.avatar : undefined, status: updates.status ?? null })}
        />
      )}
      {!connected && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded-lg bg-amber-600/90 text-white text-sm z-20 safe-b safe-r max-w-[calc(100vw-2rem)]">
          Reconectando…
        </div>
      )}

      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 safe-t safe-b safe-l safe-r">
          <div className="w-full max-w-sm max-h-[90dvh] flex flex-col rounded-2xl bg-talkapp-sidebar border border-talkapp-border shadow-2xl overflow-hidden">
            <div className="p-6 pb-4 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-talkapp-panel border-4 border-talkapp-primary/50 flex items-center justify-center ring-4 ring-talkapp-primary/20">
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
                <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-talkapp-primary text-talkapp-on-primary">
                  <VideoCallRingingIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="text-talkapp-fg-muted text-sm font-medium">Videollamada entrante</p>
              <p className="text-talkapp-fg text-xl font-semibold mt-1">{incomingCall.callerName}</p>
              <p className="text-talkapp-primary text-sm mt-0.5">te está llamando</p>
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
                className="flex-1 rounded-xl py-3.5 bg-talkapp-primary text-talkapp-on-primary font-semibold hover:opacity-90 active:opacity-80 transition-colors"
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
      <div className="min-h-screen flex items-center justify-center bg-talkapp-bg">
        <div className="text-talkapp-primary">Cargando…</div>
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
