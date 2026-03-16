import { useState, useEffect, useRef } from 'react'
import * as api from '../../lib/api'
import type { ContactItem, SearchUser } from '../../lib/api'
import { useContacts } from '../../hooks/useContacts'
import { env } from '../../config/env'

const SEARCH_DEBOUNCE_MS = 350

function avatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar?.trim()) return null
  if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar
  const base = env.apiUrl.replace(/\/$/, '')
  return avatar.startsWith('/') ? `${base}${avatar}` : `${base}/${avatar}`
}

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
      <header className="flex shrink-0 items-center justify-between border-b border-talkapp-border/50 px-5 py-3 safe-t safe-l safe-r">
        <h1 className="font-bold text-xl tracking-tight text-talkapp-primary ml-5">Contactos</h1>
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
            placeholder="Nombre o correo del contacto..."
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
                <li key={u.id} className="relative">
                  <div
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-within:ring-2 focus-within:ring-talkapp-primary/30 group ${isAlreadyFriendOrSent(u.id) ? '' : 'hover:bg-talkapp-panel/80'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-talkapp-fg">{u.name}</p>
                      <p className="truncate text-xs text-talkapp-fg-muted">{u.email}</p>
                    </div>
                    {isAlreadyFriendOrSent(u.id) ? (
                      <span className="shrink-0 text-xs text-talkapp-fg-muted">Amigo / Enviada</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendRequest(u.id)}
                        disabled={sendingId === u.id}
                        className="contacts-result-add-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-talkapp-primary focus:outline-none focus:ring-2 focus:ring-talkapp-primary/50 disabled:opacity-50"
                        aria-label="Agregar contacto"
                      >
                        {sendingId === u.id ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <AddContactIcon className="h-7 w-7" />
                        )}
                      </button>
                    )}
                  </div>
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
              {friends.map((f) => {
                const url = avatarUrl(f.avatar)
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => onOpenConversation(f.userId)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-talkapp-panel/80 focus:outline-none focus:ring-2 focus:ring-talkapp-primary/30 group"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-talkapp-primary text-sm font-semibold text-white">
                        {url ? (
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          f.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-talkapp-fg">{f.name}</span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-talkapp-fg-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                        <ChatArrowIcon className="h-4 w-4" />
                      </span>
                    </button>
                  </li>
                )
              })}
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
    <li className="relative">
      <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-talkapp-panel/80">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-talkapp-fg">{item.name}</span>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAccept() }}
            className="contacts-request-action-btn contacts-request-accept rounded-lg bg-green-600/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-500"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReject() }}
            className="contacts-request-action-btn contacts-request-reject rounded-lg bg-talkapp-panel border border-talkapp-border px-2.5 py-1.5 text-xs font-medium text-talkapp-fg-muted hover:bg-talkapp-border/50 hover:text-talkapp-fg"
          >
            Rechazar
          </button>
        </div>
      </div>
    </li>
  )
}

function AddContactIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

function ChatArrowIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
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
