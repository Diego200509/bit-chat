import { useState, useEffect, useRef } from 'react'
import * as api from '../../lib/api'
import type { ContactItem, SearchUser } from '../../lib/api'
import { useContacts } from '../../hooks/useContacts'

const SEARCH_DEBOUNCE_MS = 350

interface ContactsPanelProps {
  onOpenConversation: (otherUserId: string) => void
  onClose: () => void
}

export function ContactsPanel({ onOpenConversation, onClose }: ContactsPanelProps) {
  const { friends, sent, received, loading, error, sendRequest, acceptRequest, rejectRequest } =
    useContacts()
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
    } catch {} finally {
      setSendingId(null)
    }
  }

  const isAlreadyFriendOrSent = (userId: string) =>
    friends.some((f) => f.userId === userId) || sent.some((s) => s.userId === userId)

  return (
    <div className="flex h-full flex-col bg-talkapp-sidebar">
      <header className="flex shrink-0 items-center justify-between border-b border-talkapp-border p-3 safe-t safe-l safe-r">
        <h2 className="font-semibold text-talkapp-primary">Contactos</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-fg"
          aria-label="Cerrar"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-talkapp-border p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-talkapp-border bg-talkapp-panel pl-3 pr-3 focus-within:border-talkapp-primary focus-within:ring-1 focus-within:ring-talkapp-primary/50">
          <span className="shrink-0 text-talkapp-fg-muted" aria-hidden>
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-talkapp-fg placeholder-talkapp-fg-muted focus:outline-none"
          />
          {searching && (
            <span className="shrink-0 text-talkapp-primary" aria-hidden>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-talkapp-primary border-t-transparent" />
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="border-b border-talkapp-border bg-red-900/20 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="chat-messages-scroll overscroll-behavior-contain flex-1 min-h-0 overflow-y-auto p-3">
        {searchResults.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-medium uppercase text-talkapp-fg-muted">Resultados</h3>
            <ul className="space-y-1">
              {searchResults.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-talkapp-panel p-2"
                >
                  <span className="min-w-0 truncate text-sm text-talkapp-fg">
                    {u.name} <span className="text-talkapp-fg-muted">({u.email})</span>
                  </span>
                  {isAlreadyFriendOrSent(u.id) ? (
                    <span className="text-xs text-talkapp-fg-muted">Amigo / Enviada</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendRequest(u.id)}
                      disabled={sendingId === u.id}
                      className="shrink-0 rounded-lg bg-talkapp-primary px-2 py-1 text-xs font-medium text-talkapp-on-primary hover:bg-talkapp-accent disabled:opacity-50"
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
            <h3 className="mb-2 text-xs font-medium uppercase text-talkapp-fg-muted">Solicitudes recibidas</h3>
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
          <h3 className="mb-2 text-xs font-medium uppercase text-talkapp-fg-muted">Contactos</h3>
          {loading ? (
            <p className="text-sm text-talkapp-fg-muted">Cargando…</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-talkapp-fg-muted">Aún no tienes amigos. Busca y agrega a alguien.</p>
          ) : (
            <ul className="space-y-1">
              {friends.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-talkapp-panel p-2"
                >
                  <span className="min-w-0 truncate text-sm text-talkapp-fg">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => onOpenConversation(f.userId)}
                    className="shrink-0 rounded-lg bg-talkapp-primary px-2 py-1 text-xs font-medium text-talkapp-on-primary hover:bg-talkapp-accent"
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
  item: ContactItem
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-talkapp-panel p-2">
      <span className="min-w-0 truncate text-sm text-talkapp-fg">{item.name}</span>
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
          className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
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
