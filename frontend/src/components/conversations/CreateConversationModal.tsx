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
      setError('El grupo necesita un nombre')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onCreate(n, Array.from(selectedIds), imageUrl ?? undefined)
      onClose()
    } catch {
      setError('No fue posible crear el grupo')
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
          <h2 className="font-semibold text-talkapp-primary">Crear grupo</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-fg" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="flex flex-col p-4 gap-4 min-h-0 overflow-y-auto">

          {/* Imagen centrada y prominente primero */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-20 h-20 rounded-full overflow-hidden bg-talkapp-panel border-2 border-talkapp-border flex items-center justify-center hover:border-talkapp-primary transition-colors relative group"
            >
              {imageUrl ? (
                <img src={fullUrl(imageUrl)} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-talkapp-fg-muted">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-xs font-medium">Elegir</span>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleImageChange}
            />
            <p className="text-xs text-talkapp-fg-muted">
              {uploading ? 'Subiendo imagen…' : 'Portada del grupo'}
            </p>
          </div>

          {/* Nombre del grupo */}
          <div>
            <label className="block text-sm text-talkapp-fg-muted mb-1">Nombre del grupo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-talkapp-border bg-talkapp-panel px-3 py-2 text-talkapp-fg placeholder-talkapp-fg-muted focus:border-talkapp-primary focus:outline-none focus:ring-1 focus:ring-talkapp-primary/50"
              placeholder="Ej: Amigos del trabajo"
              autoFocus
            />
          </div>

          {/* Participantes */}
          <div>
            <label className="block text-sm text-talkapp-fg-muted mb-2">Participantes</label>
            <div className="chat-messages-scroll max-h-48 overflow-y-auto rounded-lg border border-talkapp-border bg-talkapp-panel divide-y divide-talkapp-border">
              {friends.length === 0 ? (
                <p className="p-3 text-talkapp-fg-muted text-sm">Sin contactos disponibles. Añade amigos primero.</p>
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
              {loading ? 'Creando grupo…' : 'Crear grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
