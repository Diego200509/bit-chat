import { useState, useRef } from 'react'
import * as api from '../../lib/api'
import { env } from '../../config/env'
import { useContacts } from '../../hooks/useContacts'

function fullUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = env.apiUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

interface CreateConversationModalProps {
  onClose: () => void
  onCreate: (name: string, participantIds: string[], image?: string | null) => Promise<void>
}

export function CreateConversationModal({ onClose, onCreate }: CreateConversationModalProps) {
  const { friends } = useContacts()
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await api.uploadImage(file)
      setImageUrl(url)
    } catch {} finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const toggle = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) {
      setError('Escribe un nombre para el grupo')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onCreate(n, Array.from(selectedIds), imageUrl ?? undefined)
      onClose()
    } catch {
      setError('No se pudo crear el grupo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 safe-t safe-b safe-l safe-r" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-xl bg-talkapp-sidebar border border-talkapp-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-talkapp-border p-4">
          <h2 className="font-semibold text-talkapp-primary">Nuevo grupo</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-fg" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="flex flex-col p-4 gap-4 min-h-0 overflow-y-auto">
          <div>
            <label className="block text-sm text-talkapp-fg-muted mb-1">Nombre del grupo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-talkapp-border bg-talkapp-panel px-3 py-2 text-talkapp-fg placeholder-talkapp-fg-muted focus:border-talkapp-primary focus:outline-none focus:ring-1 focus:ring-talkapp-primary/50"
              placeholder="Ej: Familia"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-16 h-16 rounded-full overflow-hidden bg-talkapp-panel border-2 border-talkapp-border flex items-center justify-center shrink-0 hover:border-talkapp-primary transition-colors"
            >
              {imageUrl ? (
                <img src={fullUrl(imageUrl)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-500">👥</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleImageChange}
            />
            <div>
              <p className="text-sm font-medium text-talkapp-fg">Imagen del grupo</p>
              <p className="text-xs text-talkapp-fg-muted">{uploading ? 'Subiendo…' : 'Clic para cambiar'}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm text-talkapp-fg-muted mb-2">Añadir amigos</label>
            <div className="chat-messages-scroll max-h-48 overflow-y-auto rounded-lg border border-talkapp-border bg-talkapp-panel divide-y divide-talkapp-border">
              {friends.length === 0 ? (
                <p className="p-3 text-talkapp-fg-muted text-sm">No tienes amigos. Añade amigos primero.</p>
              ) : (
                friends.map((f) => (
                  <label key={f.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-talkapp-panel/80">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.userId)}
                      onChange={() => toggle(f.userId)}
                      className="rounded border-talkapp-border text-talkapp-primary focus:ring-talkapp-primary"
                    />
                    <span className="text-talkapp-fg truncate">{f.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-talkapp-fg-muted hover:bg-talkapp-panel">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 bg-talkapp-primary text-talkapp-on-primary font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Creando…' : 'Crear grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  )
}
