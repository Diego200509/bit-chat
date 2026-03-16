import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from './context/AuthContext'
import { useConversations } from './hooks/useConversations'
import { useTheme } from './hooks/useTheme'
import { useBlocked } from './hooks/useBlocked'
import { useOnlineUsers } from './hooks/useOnlineUsers'
import { ToastProvider } from './context/ToastContext'
import { AuthScreen } from './components/auth'
import { ConversationList, ConversationView, EditProfilePanel, ConfirmModal, CreateGroupPanel, ManageGroupPanel } from './components/conversations'
import { ContactsPanel } from './components/contacts'
import { socket } from './lib/socket'
import { startVideoCallRingtone } from './lib/videoCallRingtone'
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
  const [showCreateGroupPanel, setShowCreateGroupPanel] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showManageGroupPanel, setShowManageGroupPanel] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const incomingCallRingStopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (incomingCall) {
      incomingCallRingStopRef.current = startVideoCallRingtone()
    } else {
      incomingCallRingStopRef.current?.()
      incomingCallRingStopRef.current = null
    }
    return () => {
      incomingCallRingStopRef.current?.()
      incomingCallRingStopRef.current = null
    }
  }, [incomingCall])

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

  const handleOpenContacts = () => {
    setShowContactsPanel(true)
    setShowCreateGroupPanel(false)
  }
  const handleCloseContacts = () => setShowContactsPanel(false)
  const handleOpenCreateGroup = () => {
    setShowCreateGroupPanel(true)
    setShowContactsPanel(false)
  }
  const handleCloseCreateGroup = () => setShowCreateGroupPanel(false)
  const handleOpenEditProfile = () => {
    setShowEditProfile(true)
    setShowContactsPanel(false)
    setShowCreateGroupPanel(false)
  }
  const handleCloseEditProfile = () => setShowEditProfile(false)
  const handleOpenManageGroup = () => {
    setShowManageGroupPanel(true)
    setShowContactsPanel(false)
    setShowCreateGroupPanel(false)
    setShowEditProfile(false)
  }
  const handleCloseManageGroup = () => setShowManageGroupPanel(false)

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
        className={`flex flex-col w-full md:w-[380px] md:flex-shrink-0 md:border-r md:border-talkapp-border bg-talkapp-sidebar min-h-0 pb-4 ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {showEditProfile && user ? (
          <EditProfilePanel
            currentName={user.name}
            currentNickname={user.nickname?.trim() ?? ''}
            currentAvatar={user.avatar}
            currentStatus={user.status}
            onClose={handleCloseEditProfile}
            onSave={async (updates) => {
              await updateProfile({
                nickname: updates.nickname || null,
                avatar: updates.avatar !== undefined ? updates.avatar : undefined,
                status: updates.status ?? null,
              })
              setShowEditProfile(false)
            }}
          />
        ) : showManageGroupPanel && currentConversation && !currentConversation.otherUserId ? (
          <ManageGroupPanel
            conversation={currentConversation}
            currentUserId={currentUserId}
            onClose={handleCloseManageGroup}
            onGroupUpdated={() => {
              refreshConversations()
            }}
          />
        ) : showCreateGroupPanel ? (
          <CreateGroupPanel
            onClose={handleCloseCreateGroup}
            onCreate={async (name, participantIds, image) => {
              await createGroupAndSelect(name, participantIds, image)
              setShowCreateGroupPanel(false)
            }}
          />
        ) : showContactsPanel ? (
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
            onOpenCreateGroup={handleOpenCreateGroup}
            onEditProfile={handleOpenEditProfile}
            conversationsLoading={conversationsLoading}
            onMuteConversation={muteConversation}
            onUnmuteConversation={unmuteConversation}
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
          onOpenManageGroup={handleOpenManageGroup}
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
      {!connected && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 safe-t flex items-center gap-2 px-4 py-2.5 rounded-full bg-talkapp-sidebar border border-talkapp-border shadow-lg text-talkapp-fg text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          Conectando…
        </div>
      )}

      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 safe-t safe-b safe-l safe-r bg-talkapp-bg/95 backdrop-blur-md">
          <div className="w-full max-w-[340px] flex flex-col rounded-[28px] overflow-hidden shadow-2xl border border-talkapp-border/60 bg-talkapp-sidebar">
            <div className="relative pt-10 pb-6 px-6 text-center bg-gradient-to-b from-talkapp-primary/10 to-transparent">
              <div className="relative inline-block">
                <div className="w-32 h-32 rounded-full overflow-hidden flex items-center justify-center bg-talkapp-panel/80 ring-4 ring-talkapp-primary/30 ring-offset-4 ring-offset-talkapp-sidebar">
                  {incomingCall.callerAvatar ? (
                    <img
                      src={fullAvatarUrl(incomingCall.callerAvatar)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <VideoCallAvatarPlaceholderIcon className="w-16 h-16 text-talkapp-primary/50" />
                  )}
                </div>
                <span className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-talkapp-primary text-talkapp-on-primary shadow-lg border-2 border-talkapp-sidebar">
                  <VideoCallRingingIcon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-talkapp-primary/90">Videollamada entrante</p>
              <p className="text-talkapp-fg text-2xl font-bold mt-1.5 tracking-tight">{incomingCall.callerName}</p>
              <p className="text-talkapp-fg-muted text-sm mt-1">te está llamando</p>
            </div>
            <div className="flex gap-3 p-5 pt-2 bg-talkapp-sidebar">
              <button
                type="button"
                onClick={() => {
                  socket.emit(SOCKET_EVENTS.VIDEO_CALL_REJECT, { callerId: incomingCall.callerId })
                  setIncomingCall(null)
                }}
                className="flex-1 rounded-xl py-3.5 bg-red-500 text-white font-semibold hover:bg-red-400 active:opacity-90 transition-colors"
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

function VideoCallAvatarPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9" r="3" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
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
  const { user, loading, token } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-talkapp-bg">
        <div className="text-talkapp-primary">Cargando…</div>
      </div>
    )
  }

  if (!user || !token) {
    return <AuthScreen />
  }

  return (
    <ToastProvider>
      <ChatLayout />
    </ToastProvider>
  )
}

export default App
