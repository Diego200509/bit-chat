import { useState, useEffect, useRef } from 'react'
import * as api from '../../lib/api'
import type { FriendItem, SearchUser } from '../../lib/api'
import { useFriends } from '../../hooks/useFriends'

const SEARCH_DEBOUNCE_MS = 350

interface FriendsPanelProps {
  onOpenChat: (otherUserId: string) => void
  onClose: () => void
}

export function FriendsPanel({ onOpenChat, onClose }: FriendsPanelProps) {
  const { friends, sent, received, loading, error, sendRequest, acceptRequest, rejectRequest } =
    useFriends()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const list = await api.searchUsers(q)
        setSearchResults(list)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSendRequest = async (addresseeId: string) => {
    setSendingId(addresseeId)
    try {
      await sendRequest(addresseeId)
      setSearchResults((prev) => prev.filter((u) => u.id !== addresseeId))
    } catch {
      // error en useFriends o mostrar toast
    } finally {
      setSendingId(null)
    }
  }

  const isAlreadyFriendOrSent = (userId: string) =>
    friends.some((f) => f.userId === userId) || sent.some((s) => s.userId === userId)

  return (
    <div className="flex h-full flex-col bg-bitchat-sidebar">
      <header className="flex shrink-0 items-center justify-between border-b border-bitchat-border p-3 safe-t">
        <h2 className="font-semibold text-bitchat-cyan">Amigos</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-bitchat-panel hover:text-slate-200"
          aria-label="Cerrar"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-bitchat-border p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-bitchat-border bg-bitchat-panel pl-3 pr-3 focus-within:border-bitchat-cyan focus-within:ring-1 focus-within:ring-bitchat-cyan/50">
          <span className="shrink-0 text-slate-500" aria-hidden>
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {searching && (
            <span className="shrink-0 text-bitchat-cyan" aria-hidden>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bitchat-cyan border-t-transparent" />
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="border-b border-bitchat-border bg-red-900/20 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {searchResults.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-medium uppercase text-slate-500">Resultados</h3>
            <ul className="space-y-1">
              {searchResults.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-bitchat-panel p-2"
                >
                  <span className="min-w-0 truncate text-sm text-slate-200">
                    {u.name} <span className="text-slate-500">({u.email})</span>
                  </span>
                  {isAlreadyFriendOrSent(u.id) ? (
                    <span className="text-xs text-slate-500">Amigo / Enviada</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendRequest(u.id)}
                      disabled={sendingId === u.id}
                      className="shrink-0 rounded-lg bg-bitchat-cyan px-2 py-1 text-xs font-medium text-bitchat-blue-dark hover:bg-bitchat-cyan-bright disabled:opacity-50"
                    >
                      {sendingId === u.id ? '…' : 'Agregar'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {received.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-medium uppercase text-slate-500">Solicitudes recibidas</h3>
            <ul className="space-y-1">
              {received.map((r) => (
                <RequestRow
                  key={r.id}
                  item={r}
                  onAccept={() => acceptRequest(r.id)}
                  onReject={() => rejectRequest(r.id)}
                />
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase text-slate-500">Amigos</h3>
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no tienes amigos. Busca y agrega a alguien.</p>
          ) : (
            <ul className="space-y-1">
              {friends.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-bitchat-panel p-2"
                >
                  <span className="min-w-0 truncate text-sm text-slate-200">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => onOpenChat(f.userId)}
                    className="shrink-0 rounded-lg bg-bitchat-cyan px-2 py-1 text-xs font-medium text-bitchat-blue-dark hover:bg-bitchat-cyan-bright"
                  >
                    Chatear
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function RequestRow({
  item,
  onAccept,
  onReject,
}: {
  item: FriendItem
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-bitchat-panel p-2">
      <span className="min-w-0 truncate text-sm text-slate-200">{item.name}</span>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onAccept}
          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500"
        >
          Aceptar
        </button>
        <button
          type="button"
          onClick={onReject}
          className="rounded bg-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-500"
        >
          Rechazar
        </button>
      </div>
    </li>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 0 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  )
}
