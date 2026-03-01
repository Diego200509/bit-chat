import { useState, useCallback, useEffect } from 'react'
import * as api from '../lib/api'

export function useBlocked() {
  const [blockedIds, setBlockedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const ids = await api.getBlockedUserIds()
      setBlockedIds(ids)
    } catch {
      setBlockedIds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const blockUser = useCallback(
    async (userId: string) => {
      await api.blockUser(userId)
      setBlockedIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
    },
    []
  )

  const unblockUser = useCallback(
    async (userId: string) => {
      await api.unblockUser(userId)
      setBlockedIds((prev) => prev.filter((id) => id !== userId))
    },
    []
  )

  return { blockedIds, loading, blockUser, unblockUser, refresh }
}
