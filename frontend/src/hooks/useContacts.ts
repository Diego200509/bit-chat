import { useState, useCallback, useEffect } from 'react'
import { socket } from '../lib/socket'
import { SOCKET_EVENTS } from '../constants/socket'
import * as api from '../lib/api'

export function useContacts() {
  const [friends, setFriends] = useState<api.ContactItem[]>([])
  const [sent, setSent] = useState<api.ContactItem[]>([])
  const [received, setReceived] = useState<api.ContactItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onProfileUpdated = (payload: { userId?: string; displayName?: string; avatar?: string | null }) => {
      const { userId: uId, displayName: newName, avatar: newAvatar } = payload
      if (!uId) return
      const updateItem = (list: api.ContactItem[]) =>
        list.map((f) =>
          f.userId === uId
            ? { ...f, ...(newName != null && { name: newName }), ...(newAvatar !== undefined && { avatar: newAvatar ?? undefined }) }
            : f
        )
      setFriends((prev) => updateItem(prev))
      setSent((prev) => updateItem(prev))
      setReceived((prev) => updateItem(prev))
    }
    socket.on(SOCKET_EVENTS.USER_PROFILE_UPDATED, onProfileUpdated)
    return () => {
      socket.off(SOCKET_EVENTS.USER_PROFILE_UPDATED, onProfileUpdated)
    }
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await api.getContacts()
      setFriends(data.friends)
      setSent(data.sent)
      setReceived(data.received)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar contactos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const sendRequest = useCallback(async (addresseeId: string) => {
    setError(null)
    await api.sendContactRequest(addresseeId)
    await refresh()
  }, [refresh])

  const acceptRequest = useCallback(async (requestId: string) => {
    setError(null)
    await api.acceptOrRejectRequest(requestId, 'accept')
    await refresh()
  }, [refresh])

  const rejectRequest = useCallback(async (requestId: string) => {
    setError(null)
    await api.acceptOrRejectRequest(requestId, 'reject')
    await refresh()
  }, [refresh])

  return {
    friends,
    sent,
    received,
    loading,
    error,
    refresh,
    sendRequest,
    acceptRequest,
    rejectRequest,
  }
}
