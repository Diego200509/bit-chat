import { useState, useEffect } from 'react'
import { socket } from '../lib/socket'
import { SOCKET_EVENTS } from '../constants/socket'

function parseOnlineUserIds(payload: unknown): Set<string> {
  if (!Array.isArray(payload)) return new Set()
  const ids = new Set<string>()
  for (const item of payload) {
    if (item && typeof item === 'object') {
      const id = (item as { userId?: string; id?: string }).userId ?? (item as { userId?: string; id?: string }).id
      if (typeof id === 'string' && id.trim()) ids.add(id.trim())
    }
  }
  return ids
}

export function useOnlineUsers(): Set<string> {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const onUsersOnline = (payload: unknown) => {
      setOnlineUserIds(parseOnlineUserIds(payload))
    }
    socket.on(SOCKET_EVENTS.USERS_ONLINE, onUsersOnline)
    if (socket.connected) {
      socket.emit(SOCKET_EVENTS.REFRESH_ONLINE_LIST)
    }
    const onConnect = () => {
      socket.emit(SOCKET_EVENTS.REFRESH_ONLINE_LIST)
    }
    socket.on('connect', onConnect)
    return () => {
      socket.off(SOCKET_EVENTS.USERS_ONLINE, onUsersOnline)
      socket.off('connect', onConnect)
    }
  }, [])

  return onlineUserIds
}
