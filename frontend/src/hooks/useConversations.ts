import { useState, useCallback, useEffect, useRef } from 'react'
import { useToast } from '../context/ToastContext'
import { socket } from '../lib/socket'
import { SOCKET_EVENTS } from '../constants/socket'
import * as api from '../lib/api'
import type { Conversation, Message } from '../types/conversation'
import type { SocketMessage } from '../types/socket'

const DEFAULT_USER_ID = 'user-1'
const DEFAULT_USER_NAME = 'Yo'

const NOTIFICATION_ICON_SIZE = 192

function getNotificationIconDataUrl(): string {
  if (typeof document === 'undefined' || typeof window === 'undefined') return ''
  try {
    const canvas = document.createElement('canvas')
    canvas.width = NOTIFICATION_ICON_SIZE
    canvas.height = NOTIFICATION_ICON_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    const r = NOTIFICATION_ICON_SIZE / 2
    ctx.beginPath()
    ctx.arc(r, r, r - 4, 0, Math.PI * 2)
    ctx.fillStyle = '#7B2CBF'
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${NOTIFICATION_ICON_SIZE * 0.5}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('T', r, r)
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

let cachedNotificationIcon: string | null = null

/** Reproduce un sonido corto de notificación (Web Audio API). */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const play = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.15, start)
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration)
      osc.start(start)
      osc.stop(start + duration)
    }
    const t = ctx.currentTime
    play(880, t, 0.08)
    play(880, t + 0.12, 0.08)
    ctx.resume?.()
  } catch (_) {}
}

function listItemToConversation(item: api.ConversationListItem & { isBlocked?: boolean; unread?: number }): Conversation {
  return {
    id: item.id,
    name: item.name,
    otherUserId: item.otherUserId,
    isBlocked: item.isBlocked,
    isPinned: item.isPinned,
    isMuted: item.isMuted,
    avatar: item.avatar ?? undefined,
    image: item.image,
    otherUserLastSeen: item.otherUserLastSeen ?? null,
    otherUserStatus: item.otherUserStatus ?? null,
    participants: item.participants,
    adminIds: item.adminIds,
    isGroupAdmin: item.isGroupAdmin,
    isRemovedFromGroup: item.isRemovedFromGroup,
    removedParticipantIds: item.removedParticipantIds,
    lastMessage: item.lastMessage,
    lastMessageTime: item.lastMessageTime ?? undefined,
    lastMessageSenderId: item.lastMessageSenderId ?? null,
    lastMessageDeliveredBy: item.lastMessageDeliveredBy ?? undefined,
    lastMessageReadBy: item.lastMessageReadBy ?? undefined,
    unread: item.unread ?? 0,
    messages: [],
  }
}

export interface UseConversationsOptions {
  getIsConversationPanelVisible?: () => boolean
}

export function useConversations(userId = DEFAULT_USER_ID, userName = DEFAULT_USER_NAME, options: UseConversationsOptions = {}) {
  const { getIsConversationPanelVisible } = options
  const showToast = useToast()
  const getIsConversationPanelVisibleRef = useRef(getIsConversationPanelVisible)
  getIsConversationPanelVisibleRef.current = getIsConversationPanelVisible
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [connected, setConnected] = useState(socket.connected)
  const prevChatIdRef = useRef<string | null>(null)
  const currentChatIdRef = useRef<string | null>(currentChatId)
  currentChatIdRef.current = currentChatId
  const conversationsRef = useRef<Conversation[]>([])
  conversationsRef.current = conversations
  const [chatPresenceByChatId, setChatPresenceByChatId] = useState<Record<string, string[]>>({})
  const [typingByChatId, setTypingByChatId] = useState<Record<string, Array<{ userId: string; userName: string }>>>({})
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const currentConversation = currentChatId
    ? conversations.find((c) => c.id === currentChatId) ?? null
    : null

  useEffect(() => {
    let cancelled = false
    api
      .getConversations()
      .then((list) => {
        if (cancelled) return
        const next = list.map(listItemToConversation)
        setConversations(next)
        if (next.length > 0 && !currentChatId) setCurrentChatId(next[0].id)
      })
      .catch(() => {
        if (!cancelled) setConversations([{ id: 'chat-1', name: 'General', messages: [] }])
        if (!cancelled && !currentChatId) setCurrentChatId('chat-1')
      })
      .finally(() => {
        if (!cancelled) setConversationsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  useEffect(() => {
    const onLastSeen = (payload: { userId?: string; lastSeenAt?: number }) => {
      const { userId: uId, lastSeenAt } = payload
      if (!uId || lastSeenAt == null) return
      setConversations((prev) =>
        prev.map((c) => (c.otherUserId === uId ? { ...c, otherUserLastSeen: lastSeenAt } : c))
      )
    }
    socket.on(SOCKET_EVENTS.USER_LAST_SEEN_UPDATED, onLastSeen)
    return () => {
      socket.off(SOCKET_EVENTS.USER_LAST_SEEN_UPDATED, onLastSeen)
    }
  }, [])

  useEffect(() => {
    const onProfileUpdated = (payload: { userId?: string; displayName?: string; avatar?: string | null; status?: string | null }) => {
      const { userId: uId, displayName: newName, avatar: newAvatar, status: newStatus } = payload
      if (!uId) return
      setConversations((prev) =>
        prev.map((c) => {
          let next = c
          if (c.otherUserId === uId) {
            next = {
              ...next,
              ...(newName != null && { name: newName }),
              ...(newAvatar !== undefined && { avatar: newAvatar ?? undefined, image: newAvatar ?? null }),
              ...(newStatus !== undefined && { otherUserStatus: newStatus ?? null }),
            }
          }
          if (c.participants?.some((p) => p.id === uId)) {
            next = {
              ...next,
              participants: next.participants!.map((p) =>
                p.id === uId ? { ...p, name: newName ?? p.name } : p
              ),
            }
          }
          const needsMessageUpdate =
            (newName != null || newAvatar !== undefined) &&
            next.messages.some((m) => m.senderId === uId)
          if (needsMessageUpdate) {
            next = {
              ...next,
              messages: next.messages.map((m) =>
                m.senderId !== uId
                  ? m
                  : {
                      ...m,
                      ...(newName != null && { senderName: newName }),
                      ...(newAvatar !== undefined && { senderAvatar: newAvatar ?? null }),
                    }
              ),
            }
          }
          return next
        })
      )
    }
    socket.on(SOCKET_EVENTS.USER_PROFILE_UPDATED, onProfileUpdated)
    return () => {
      socket.off(SOCKET_EVENTS.USER_PROFILE_UPDATED, onProfileUpdated)
    }
  }, [])

  useEffect(() => {
    if (conversations.length === 0) return
    const chatIds = conversations.map((c) => c.id)
    socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION_ROOMS, chatIds)
  }, [conversations])

  useEffect(() => {
    const onPresence = (payload: { chatId?: string; userIds?: string[] }) => {
      const { chatId: cId, userIds: ids } = payload
      if (!cId) return
      setChatPresenceByChatId((prev) => ({ ...prev, [cId]: ids ?? [] }))
    }
    socket.on(SOCKET_EVENTS.CONVERSATION_PRESENCE, onPresence)
    return () => {
      socket.off(SOCKET_EVENTS.CONVERSATION_PRESENCE, onPresence)
    }
  }, [])

  useEffect(() => {
    const onTyping = (payload: { conversationId?: string; chatId?: string; userId?: string; userName?: string }) => {
      const cid = payload.conversationId || payload.chatId
      if (!cid || !payload.userId || payload.userId === userId) return
      const userName = payload.userName || 'Alguien'
      setTypingByChatId((prev) => {
        const list = prev[cid] ?? []
        const nextList = list.filter((u) => u.userId !== payload.userId).concat([{ userId: payload.userId!, userName }])
        return { ...prev, [cid]: nextList }
      })
      const key = `${cid}-${payload.userId}`
      if (typingTimeoutsRef.current[key]) clearTimeout(typingTimeoutsRef.current[key])
      typingTimeoutsRef.current[key] = setTimeout(() => {
        delete typingTimeoutsRef.current[key]
        setTypingByChatId((prev) => {
          const list = (prev[cid] ?? []).filter((u) => u.userId !== payload.userId)
          if (list.length === 0) {
            const next = { ...prev }
            delete next[cid]
            return next
          }
          return { ...prev, [cid]: list }
        })
      }, 3500)
    }
    const onStoppedTyping = (payload: { conversationId?: string; chatId?: string; userId?: string }) => {
      const cid = payload.conversationId || payload.chatId
      if (!cid || !payload.userId) return
      const key = `${cid}-${payload.userId}`
      if (typingTimeoutsRef.current[key]) {
        clearTimeout(typingTimeoutsRef.current[key])
        delete typingTimeoutsRef.current[key]
      }
      setTypingByChatId((prev) => {
        const list = (prev[cid] ?? []).filter((u) => u.userId !== payload.userId)
        if (list.length === 0) {
          const next = { ...prev }
          delete next[cid]
          return next
        }
        return { ...prev, [cid]: list }
      })
    }
    socket.on(SOCKET_EVENTS.USER_TYPING, onTyping)
    socket.on(SOCKET_EVENTS.USER_STOPPED_TYPING, onStoppedTyping)
    return () => {
      socket.off(SOCKET_EVENTS.USER_TYPING, onTyping)
      socket.off(SOCKET_EVENTS.USER_STOPPED_TYPING, onStoppedTyping)
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout)
      typingTimeoutsRef.current = {}
    }
  }, [userId])

  useEffect(() => {
    if (socket.connected && conversations.length > 0) {
      socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION_ROOMS, conversations.map((c) => c.id))
    }
  }, [socket.connected, conversations.length])

  useEffect(() => {
    const prev = prevChatIdRef.current
    if (prev && prev !== currentChatId) {
      if (socket.connected) socket.emit(SOCKET_EVENTS.LEAVE_CONVERSATION, prev)
    }
    if (currentChatId) {
      prevChatIdRef.current = currentChatId
      if (socket.connected) {
        socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, currentChatId)
      }
    } else {
      prevChatIdRef.current = null
    }
  }, [currentChatId])

  useEffect(() => {
    if (!socket.connected) return
    const chatId = currentChatIdRef.current
    if (chatId) {
      socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, chatId)
    }
  }, [connected])

  function normalizeMessage(m: {
        id: string
        text?: string
        type?: string
        imageUrl?: string | null
        stickerUrl?: string | null
        documentUrl?: string | null
        voiceUrl?: string | null
        linkPreview?: { url?: string | null; title?: string | null; description?: string | null; imageUrl?: string | null } | null
        editedAt?: number | null
        deliveredBy?: string[]
        readBy?: string[]
        pinned?: boolean
        reactions?: Array<{ userId: string; emoji: string }>
        senderId?: string | null
        senderName?: string
        senderAvatar?: string | null
        timestamp: number
        deletedForEveryone?: boolean
        deletedByUserId?: string
      }): Message {
    return {
      id: m.id,
      text: m.text ?? '',
      type: (m.type as Message['type']) || 'text',
      imageUrl: m.imageUrl ?? null,
      stickerUrl: m.stickerUrl ?? null,
      documentUrl: m.documentUrl ?? null,
      voiceUrl: m.voiceUrl ?? null,
      linkPreview: m.linkPreview
        ? {
            url: m.linkPreview.url ?? null,
            title: m.linkPreview.title ?? null,
            description: m.linkPreview.description ?? null,
            imageUrl: m.linkPreview.imageUrl ?? null,
          }
        : null,
      editedAt: m.editedAt ?? null,
      deliveredBy: m.deliveredBy ?? [],
      readBy: m.readBy ?? [],
      pinned: m.pinned ?? false,
      reactions: m.reactions ?? [],
      senderId: m.senderId ?? '',
      senderName: m.senderName ?? 'Anónimo',
      senderAvatar: m.senderAvatar ?? null,
      timestamp: m.timestamp,
      deletedForEveryone: m.deletedForEveryone,
      deletedByUserId: m.deletedByUserId,
    }
  }

  useEffect(() => {
    const onHistory = ({
      chatId,
      messages,
    }: {
      chatId: string
      messages: Array<{
        id: string
        text?: string
        type?: string
        imageUrl?: string | null
        stickerUrl?: string | null
        documentUrl?: string | null
        voiceUrl?: string | null
        linkPreview?: { url?: string | null; title?: string | null; description?: string | null; imageUrl?: string | null } | null
        editedAt?: number | null
        deliveredBy?: string[]
        readBy?: string[]
        pinned?: boolean
        reactions?: Array<{ userId: string; emoji: string }>
        senderId: string | null
        senderName: string
        timestamp: number
      }>
    }) => {
      const normalized: Message[] = messages.map((m) => normalizeMessage(m))
      const last = normalized[normalized.length - 1]
      const lastPreview = last
        ? last.deletedForEveryone
          ? 'Mensaje eliminado'
          : (last.text?.trim() || (last.type === 'image' ? 'Imagen' : last.type === 'sticker' ? 'Sticker' : last.type === 'document' ? 'Documento' : last.type === 'voice' ? 'Nota de voz' : ''))
        : ''
      setConversations((prev) => {
        const id = String(chatId)
        const existing = prev.find((c) => String(c.id) === id)
        if (!existing) return prev
        return prev.map((c) =>
          String(c.id) === id
            ? {
                ...c,
                messages: normalized,
                lastMessage: lastPreview || c.lastMessage,
                lastMessageTime: last?.timestamp ?? c.lastMessageTime,
                lastMessageSenderId: last?.senderId ?? c.lastMessageSenderId,
                lastMessageDeliveredBy: last?.deliveredBy ?? c.lastMessageDeliveredBy,
                lastMessageReadBy: last?.readBy ?? c.lastMessageReadBy,
                unread: 0,
              }
            : c
        )
      })
    }
    socket.on(SOCKET_EVENTS.CONVERSATION_HISTORY, onHistory)
    return () => {
      socket.off(SOCKET_EVENTS.CONVERSATION_HISTORY, onHistory)
    }
  }, [])

  useEffect(() => {
    const onMessage = (msg: SocketMessage & { type?: string; imageUrl?: string | null; stickerUrl?: string | null; documentUrl?: string | null; voiceUrl?: string | null; linkPreview?: { url?: string | null; title?: string | null; description?: string | null; imageUrl?: string | null } | null; editedAt?: number | null; deliveredBy?: string[]; readBy?: string[]; pinned?: boolean; reactions?: Array<{ userId: string; emoji: string }> }) => {
      const message: Message = normalizeMessage({
        id: msg.id,
        text: msg.text,
        type: msg.type,
        imageUrl: msg.imageUrl,
        stickerUrl: msg.stickerUrl,
        documentUrl: msg.documentUrl,
        voiceUrl: msg.voiceUrl,
        linkPreview: msg.linkPreview,
        editedAt: msg.editedAt,
        deliveredBy: msg.deliveredBy,
        readBy: msg.readBy,
        pinned: msg.pinned,
        reactions: msg.reactions,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderAvatar: (msg as { senderAvatar?: string | null }).senderAvatar,
        timestamp: msg.timestamp,
      })
      if (msg.senderId !== userId && msg.id && msg.chatId) {
        socket.emit(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId: msg.id, chatId: msg.chatId })
      }
      const lastMessagePreview =
        (msg.text && msg.text.trim()) ||
        (msg.type === 'image' ? 'Imagen' : msg.type === 'sticker' ? 'Sticker' : msg.type === 'document' ? 'Documento' : msg.type === 'voice' ? 'Nota de voz' : '')
      const isInThisChat = currentChatIdRef.current === msg.chatId
      const isPanelVisible = !getIsConversationPanelVisibleRef.current || getIsConversationPanelVisibleRef.current()
      if (isInThisChat && isPanelVisible) {
        socket.emit(SOCKET_EVENTS.MARK_CONVERSATION_READ, msg.chatId)
      }

      if (
        typeof Notification !== 'undefined' &&
        msg.senderId !== userId &&
        (document.visibilityState === 'hidden' || !isInThisChat || !isPanelVisible)
      ) {
        const conv = conversationsRef.current.find((c) => String(c.id) === String(msg.chatId))
        if (!conv?.isMuted) {
          playNotificationSound()
          const showNotify = (permission: NotificationPermission) => {
            if (permission !== 'granted') return
            const title = conv?.name ?? msg.senderName ?? 'TalkApp'
            const body = lastMessagePreview || 'Nuevo mensaje'
            try {
              if (!cachedNotificationIcon) cachedNotificationIcon = getNotificationIconDataUrl()
              const n = new Notification(title, {
                body,
                icon: cachedNotificationIcon || undefined,
              })
              n.onclick = () => {
                window.focus()
                n.close()
              }
            } catch (_) {}
          }
          if (Notification.permission === 'granted') {
            showNotify('granted')
          } else if (Notification.permission === 'default') {
            Notification.requestPermission().then(showNotify)
          }
        }
      }

      setConversations((prev) => {
        const existing = prev.find((c) => c.id === msg.chatId)
        const unreadDelta = isInThisChat ? 0 : 1
        if (existing) {
          if (existing.messages.some((m) => m.id === msg.id)) {
            return prev.map((c) =>
              c.id === msg.chatId
                ? {
                    ...c,
                    lastMessage: lastMessagePreview || c.lastMessage,
                    lastMessageTime: msg.timestamp,
                    lastMessageSenderId: msg.senderId ?? c.lastMessageSenderId,
                    lastMessageDeliveredBy: msg.deliveredBy ?? c.lastMessageDeliveredBy,
                    lastMessageReadBy: msg.readBy ?? c.lastMessageReadBy,
                  }
                : c
            )
          }
          return prev.map((c) =>
            c.id === msg.chatId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  lastMessage: lastMessagePreview || c.lastMessage,
                  lastMessageTime: msg.timestamp,
                  lastMessageSenderId: msg.senderId ?? c.lastMessageSenderId,
                  lastMessageDeliveredBy: msg.deliveredBy ?? c.lastMessageDeliveredBy,
                  lastMessageReadBy: msg.readBy ?? c.lastMessageReadBy,
                  unread: isInThisChat ? 0 : (c.unread ?? 0) + 1,
                }
              : c
          )
        }
        const newConversation: Conversation = {
          id: msg.chatId,
          name: msg.senderId === userId ? userName : msg.senderName,
          lastMessage: lastMessagePreview,
          lastMessageTime: msg.timestamp,
          lastMessageSenderId: msg.senderId ?? null,
          lastMessageDeliveredBy: msg.deliveredBy ?? undefined,
          lastMessageReadBy: msg.readBy ?? undefined,
          unread: unreadDelta,
          messages: [message],
        }
        return [newConversation, ...prev]
      })
    }
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, onMessage)
    return () => {
      socket.off(SOCKET_EVENTS.NEW_MESSAGE, onMessage)
    }
  }, [userId, userName])

  useEffect(() => {
    const onDeleted = (payload: { messageId?: string; chatId?: string }) => {
      const { messageId: mid, chatId: cid } = payload
      if (!mid || !cid) return
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== cid
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id !== mid ? m : { ...m, deletedForEveryone: true }
                ),
              }
        )
      )
    }
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, onDeleted)
    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, onDeleted)
    }
  }, [])

  useEffect(() => {
    const onUpdated = (updated: {
      id: string
      chatId: string
      text?: string
      linkPreview?: { url?: string | null; title?: string | null; description?: string | null; imageUrl?: string | null } | null
      editedAt?: number | null
      deliveredBy?: string[]
      readBy?: string[]
      pinned?: boolean
      reactions?: Array<{ userId: string; emoji: string }>
    }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== updated.chatId) return c
          const next = c.messages.map((m) =>
            m.id === updated.id
              ? {
                  ...m,
                  ...(updated.text !== undefined && { text: updated.text }),
                  ...(updated.linkPreview !== undefined && {
                    linkPreview: updated.linkPreview
                      ? {
                          url: updated.linkPreview.url ?? null,
                          title: updated.linkPreview.title ?? null,
                          description: updated.linkPreview.description ?? null,
                          imageUrl: updated.linkPreview.imageUrl ?? null,
                        }
                      : null,
                  }),
                  ...(updated.editedAt !== undefined && { editedAt: updated.editedAt }),
                  ...(updated.deliveredBy !== undefined && { deliveredBy: updated.deliveredBy }),
                  ...(updated.readBy !== undefined && { readBy: updated.readBy }),
                  ...(updated.pinned !== undefined && { pinned: updated.pinned }),
                  ...(updated.reactions !== undefined && { reactions: updated.reactions }),
                }
              : m
          )
          next.sort((a, b) => a.timestamp - b.timestamp)
          const lastMsg = next[next.length - 1]
          const isLastMessage = lastMsg?.id === updated.id
          return {
            ...c,
            messages: next,
            ...(isLastMessage && updated.deliveredBy !== undefined && { lastMessageDeliveredBy: updated.deliveredBy }),
            ...(isLastMessage && updated.readBy !== undefined && { lastMessageReadBy: updated.readBy }),
          }
        })
      )
    }
    socket.on(SOCKET_EVENTS.MESSAGE_UPDATED, onUpdated)
    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_UPDATED, onUpdated)
    }
  }, [])

  const selectConversation = useCallback((chatId: string | null) => {
    if (chatId) {
      setConversations((prev) => prev.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)))
    }
    setCurrentChatId(chatId)
  }, [])

  const removeConversation = useCallback((chatId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== chatId))
    setCurrentChatId((curr) => (curr === chatId ? null : curr))
  }, [])

  const openDirectConversation = useCallback(async (otherUserId: string) => {
    try {
      const item = await api.createDirectConversation(otherUserId)
      setConversations((prev) => {
        const asConversation = listItemToConversation(item)
        const found = prev.some((c) => c.id === asConversation.id)
        if (found) return prev.map((c) => (c.id === asConversation.id ? { ...c, name: asConversation.name } : c))
        return [asConversation, ...prev]
      })
      setCurrentChatId(item.id)
    } catch {}
  }, [])

  const refreshConversations = useCallback(async () => {
    try {
      const list = await api.getConversations()
      const chatId = currentChatIdRef.current
      setConversations((prev) => {
        const next = list.map(listItemToConversation)
        const prevCurrent = prev.find((c) => c.id === chatId)
        if (chatId && prevCurrent?.messages?.length) {
          return next.map((c) => (c.id === chatId ? { ...c, messages: prevCurrent.messages } : c))
        }
        return next
      })
    } catch {}
  }, [])

  useEffect(() => {
    const onConversationUpdated = () => {
      refreshConversations()
    }
    socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, onConversationUpdated)
    return () => {
      socket.off(SOCKET_EVENTS.CONVERSATION_UPDATED, onConversationUpdated)
    }
  }, [refreshConversations])

  const muteConversation = useCallback(async (chatId: string) => {
    try {
      await api.muteConversation(chatId)
      setConversations((prev) => prev.map((c) => (c.id === chatId ? { ...c, isMuted: true } : c)))
    } catch {}
  }, [])

  const unmuteConversation = useCallback(async (chatId: string) => {
    try {
      await api.unmuteConversation(chatId)
      setConversations((prev) => prev.map((c) => (c.id === chatId ? { ...c, isMuted: false } : c)))
    } catch {}
  }, [])

  const createGroupAndSelect = useCallback(async (name: string, participantIds: string[], image?: string | null) => {
    try {
      const item = await api.createGroupConversation(name, participantIds, image)
      await refreshConversations()
      setCurrentChatId(item.id)
    } catch {
      throw new Error('Error al crear grupo')
    }
  }, [refreshConversations])

  const sendMessage = useCallback(
    (text: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        chatId: currentChatId,
        text,
        type: 'text',
        senderId: userId,
        senderName: userName,
      })
    },
    [currentChatId, userId, userName]
  )

  const sendImage = useCallback(
    (imageUrl: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        chatId: currentChatId,
        text: '',
        type: 'image',
        imageUrl,
        senderId: userId,
        senderName: userName,
      })
    },
    [currentChatId, userId, userName]
  )

  const sendDocument = useCallback(
    (documentUrl: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        chatId: currentChatId,
        text: '',
        type: 'document',
        documentUrl,
        senderId: userId,
        senderName: userName,
      })
    },
    [currentChatId, userId, userName]
  )

  const sendVoice = useCallback(
    (voiceUrl: string) => {
      if (!currentChatId) return
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        chatId: currentChatId,
        text: '',
        type: 'voice',
        voiceUrl,
        senderId: userId,
        senderName: userName,
      })
    },
    [currentChatId, userId, userName]
  )

  const deleteMessage = useCallback(
    async (messageId: string, scope: 'for_me' | 'for_everyone') => {
      const result = await api.deleteMessage(messageId, scope)
      if (scope === 'for_me') {
        setConversations((prev) =>
          prev.map((c) =>
            c.id !== result.chatId ? c : { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
          )
        )
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id !== result.chatId
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id !== messageId ? m : { ...m, deletedForEveryone: true, deletedByUserId: userId }
                  ),
                }
          )
        )
        socket.emit(SOCKET_EVENTS.NOTIFY_MESSAGE_DELETED, { messageId, chatId: result.chatId })
        showToast('Mensaje eliminado')
      }
    },
    [showToast, userId]
  )

  const clearConversation = useCallback(async (chatId: string) => {
    await api.clearConversation(chatId)
    setConversations((prev) =>
      prev.map((c) => (c.id !== chatId ? c : { ...c, messages: [], lastMessage: undefined, lastMessageTime: undefined }))
    )
  }, [])

  return {
    conversations,
    currentChatId,
    currentConversation,
    chatPresenceByChatId,
    typingByChatId,
    conversationsLoading,
    connected,
    currentUserId: userId,
    currentUserName: userName,
    selectConversation,
    sendMessage,
    sendImage,
    sendDocument,
    sendVoice,
    openDirectConversation,
    removeConversation,
    refreshConversations,
    muteConversation,
    unmuteConversation,
    createGroupAndSelect,
    deleteMessage,
    clearConversation,
  }
}
