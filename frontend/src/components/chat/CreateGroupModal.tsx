import { useState } from 'react'
import { useFriends } from '../../hooks/useFriends'

interface CreateGroupModalProps {
  onClose: () => void
  onCreate: (name: string, participantIds: string[], image?: string | null) => Promise<void>
}

export function CreateGroupModal({ onClose, onCreate }: CreateGroupModalProps) {
  const { friends } = useFriends()
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      await onCreate(n, Array.from(selectedIds), imageUrl.trim() || undefined)
      onClose()
    } catch {
      setError('No se pudo crear el grupo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-bitchat-sidebar border border-bitchat-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-bitchat-border p-4">
          <h2 className="font-semibold text-bitchat-cyan">Nuevo grupo</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-bitchat-panel hover:text-slate-200" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="flex flex-col p-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombre del grupo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-bitchat-border bg-bitchat-panel px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-bitchat-cyan focus:outline-none focus:ring-1 focus:ring-bitchat-cyan/50"
              placeholder="Ej: Familia"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Imagen del grupo (URL, opcional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-lg border border-bitchat-border bg-bitchat-panel px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-bitchat-cyan focus:outline-none focus:ring-1 focus:ring-bitchat-cyan/50"
              placeholder="https://ejemplo.com/imagen.jpg"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Añadir amigos</label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-bitchat-border bg-bitchat-panel divide-y divide-bitchat-border">
              {friends.length === 0 ? (
                <p className="p-3 text-slate-500 text-sm">No tienes amigos. Añade amigos primero.</p>
              ) : (
                friends.map((f) => (
                  <label key={f.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-bitchat-panel/80">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.userId)}
                      onChange={() => toggle(f.userId)}
                      className="rounded border-bitchat-border text-bitchat-cyan focus:ring-bitchat-cyan"
                    />
                    <span className="text-slate-100 truncate">{f.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-300 hover:bg-bitchat-panel">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 bg-bitchat-cyan text-bitchat-blue-dark font-medium hover:opacity-90 disabled:opacity-50"
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
