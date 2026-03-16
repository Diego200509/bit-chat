import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as api from '../../lib/api'
import { env } from '../../config/env'
import type { Conversation } from '../../types/conversation'

function fullGroupImageUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = env.apiUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export interface ManageGroupPanelProps {
  conversation: Conversation
  currentUserId: string
  onClose: () => void
  onGroupUpdated: () => void
}

export function ManageGroupPanel({ conversation, currentUserId, onClose, onGroupUpdated }: ManageGroupPanelProps) {
  const [contacts, setContacts] = useState<api.ContactItem[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [showAddList, setShowAddList] = useState(false)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const groupImageInputRef = useRef<HTMLInputElement>(null)
  const adminSet = useMemo(() => new Set(conversation.adminIds ?? []), [conversation.adminIds])
  const removedSet = useMemo(() => new Set(conversation.removedParticipantIds ?? []), [conversation.removedParticipantIds])
  const participantIds = useMemo(() => new Set((conversation.participants ?? []).map((p) => p.id)), [conversation.participants])

  const handleGroupImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImageError(null)
      setUploadingImage(true)
      try {
        const url = await api.uploadImage(file)
        await api.updateGroupConversation(conversation.id, { image: url })
        onGroupUpdated()
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Error al subir la imagen')
      } finally {
        setUploadingImage(false)
        e.target.value = ''
      }
    },
    [conversation.id, onGroupUpdated]
  )

  const handleRemoveGroupImage = useCallback(async () => {
    setImageError(null)
    try {
      await api.updateGroupConversation(conversation.id, { image: null })
      onGroupUpdated()
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Error al quitar la foto')
    }
  }, [conversation.id, onGroupUpdated])

  useEffect(() => {
    if (!showAddList) return
    setLoadingContacts(true)
    api
      .getContacts()
      .then((data) => {
        const friends = data.friends ?? []
        setContacts(friends.filter((c) => !participantIds.has(c.userId)))
      })
      .catch(() => setContacts([]))
      .finally(() => setLoadingContacts(false))
  }, [showAddList, participantIds])

  const handleAdd = useCallback(
    async (userId: string) => {
      setAdding(true)
      try {
        await api.addGroupParticipant(conversation.id, userId)
        onGroupUpdated()
      } finally {
        setAdding(false)
        setShowAddList(false)
      }
    },
    [conversation.id, onGroupUpdated]
  )

  const handleRemove = useCallback(
    async (userId: string) => {
      setRemovingId(userId)
      try {
        await api.removeGroupParticipant(conversation.id, userId)
        onGroupUpdated()
      } finally {
        setRemovingId(null)
      }
    },
    [conversation.id, onGroupUpdated]
  )

  const handleReincorporate = useCallback(
    async (userId: string) => {
      setRemovingId(userId)
      try {
        await api.addGroupParticipant(conversation.id, userId)
        onGroupUpdated()
      } finally {
        setRemovingId(null)
      }
    },
    [conversation.id, onGroupUpdated]
  )

  return (
    <div className="flex h-full flex-col bg-talkapp-sidebar">
      <header className="flex shrink-0 items-center justify-between border-b border-talkapp-border/50 px-5 py-3 safe-t safe-l safe-r">
        <h1 className="font-bold text-xl tracking-tight text-talkapp-primary ml-5">Gestionar grupo</h1>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-fg"
          aria-label="Cerrar"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="chat-messages-scroll flex-1 min-h-0 overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => groupImageInputRef.current?.click()}
            disabled={uploadingImage}
            className="w-16 h-16 rounded-full overflow-hidden bg-talkapp-panel border-2 border-talkapp-border flex items-center justify-center shrink-0 hover:border-talkapp-primary transition-colors focus:outline-none focus:ring-2 focus:ring-talkapp-primary"
          >
            {conversation.image ? (
              <img src={fullGroupImageUrl(conversation.image)} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-talkapp-fg-muted">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
          </button>
          <input
            ref={groupImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleGroupImageChange}
          />
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm font-medium text-talkapp-fg">Imagen del grupo</p>
            <p className="text-xs text-talkapp-fg-muted">{uploadingImage ? 'Subiendo imagen…' : 'Toca para cambiar'}</p>
            {conversation.image && (
              <button
                type="button"
                onClick={handleRemoveGroupImage}
                className="text-xs text-red-400 hover:text-red-300 focus:outline-none focus:underline text-left"
              >
                Eliminar imagen
              </button>
            )}
            {imageError && <p className="text-xs text-red-400">{imageError}</p>}
          </div>
        </div>
        <p className="mb-3 text-sm font-semibold text-talkapp-fg-muted uppercase tracking-wider text-xs">Miembros</p>
        <div className="space-y-2">
          {(conversation.participants ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-talkapp-border bg-talkapp-panel px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-talkapp-fg">{p.name}</span>
                {adminSet.has(p.id) && (
                  <span className="ml-2 rounded bg-talkapp-primary/20 px-1.5 py-0.5 text-xs text-talkapp-primary">
                    Admin
                  </span>
                )}
                {removedSet.has(p.id) && (
                  <span className="ml-2 rounded bg-talkapp-fg-muted/20 px-1.5 py-0.5 text-xs text-talkapp-fg-muted">
                    Removido
                  </span>
                )}
              </div>
              {p.id !== currentUserId && (
                removedSet.has(p.id) ? (
                  <button
                    type="button"
                    onClick={() => handleReincorporate(p.id)}
                    disabled={!!removingId}
                    className="shrink-0 rounded-lg px-2 py-1 text-sm text-talkapp-primary hover:bg-talkapp-primary/15 disabled:opacity-50"
                  >
                    {removingId === p.id ? '…' : 'Reincorporar'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemove(p.id)}
                    disabled={!!removingId}
                    className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-400 hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {removingId === p.id ? '…' : 'Quitar'}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
        {!showAddList ? (
          <button
            type="button"
            onClick={() => setShowAddList(true)}
            className="mt-4 w-full rounded-lg border border-talkapp-border bg-talkapp-panel py-2.5 text-sm font-medium text-talkapp-fg hover:bg-talkapp-bg"
          >
            Agregar participante
          </button>
        ) : (
          <div className="mt-4 rounded-lg border border-talkapp-border bg-talkapp-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-talkapp-fg">Agregar contacto</span>
              <button
                type="button"
                onClick={() => setShowAddList(false)}
                className="text-sm text-talkapp-fg-muted hover:text-talkapp-fg"
              >
                Cancelar
              </button>
            </div>
            {loadingContacts ? (
              <p className="py-2 text-sm text-talkapp-fg-muted">Cargando…</p>
            ) : contacts.length === 0 ? (
              <p className="py-2 text-sm text-talkapp-fg-muted">No hay contactos para agregar.</p>
            ) : (
              <ul className="chat-messages-scroll max-h-40 overflow-y-auto space-y-1">
                {contacts.map((c) => (
                  <li key={c.userId}>
                    <button
                      type="button"
                      onClick={() => handleAdd(c.userId)}
                      disabled={adding}
                      className="w-full rounded px-2 py-1.5 text-left text-sm text-talkapp-fg hover:bg-talkapp-bg disabled:opacity-50"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
