import { useState, useCallback, useEffect } from 'react'
import * as api from '../lib/api'

export function useFriends() {
  const [friends, setFriends] = useState<api.FriendItem[]>([])
  const [sent, setSent] = useState<api.FriendItem[]>([])
  const [received, setReceived] = useState<api.FriendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await api.getFriends()
      setFriends(data.friends)
      setSent(data.sent)
      setReceived(data.received)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const sendRequest = useCallback(async (addresseeId: string) => {
    setError(null)
    await api.sendFriendRequest(addresseeId)
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
