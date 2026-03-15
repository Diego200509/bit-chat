import { useState, useRef } from 'react'
import * as api from '../../lib/api'
import { env } from '../../config/env'

const STATUS_OPTIONS = [
  { value: '', label: 'Sin estado' },
  { value: 'Disponible', label: 'Disponible' },
  { value: 'Ocupado', label: 'Ocupado' },
  { value: 'En una reunión', label: 'En una reunión' },
  { value: 'No molestar', label: 'No molestar' },
  { value: 'Ausente', label: 'Ausente' },
] as const

interface EditProfileModalProps {
  currentName: string
  currentNickname: string
  currentAvatar?: string | null
  currentStatus?: string | null
  onClose: () => void
  onSave: (updates: { nickname: string; avatar?: string | null; status?: string | null }) => Promise<void>
}

function fullUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = env.apiUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export function EditProfileModal({
  currentName,
  currentNickname,
  currentAvatar,
  currentStatus = null,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [nickname, setNickname] = useState(currentNickname)
  const [avatar, setAvatar] = useState<string | null>(currentAvatar ?? null)
  const [status, setStatus] = useState<string>(currentStatus?.trim() ?? '')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const url = await api.uploadImage(file)
      setAvatar(url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({
        nickname: nickname.trim() || '',
        avatar: avatar,
        status: status.trim() || null,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 safe-t safe-b safe-l safe-r" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[90dvh] flex flex-col rounded-xl bg-talkapp-sidebar border border-talkapp-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-talkapp-border p-4">
          <h2 className="font-semibold text-talkapp-primary">Editar perfil</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-talkapp-fg-muted hover:bg-talkapp-panel hover:text-talkapp-fg" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <p className="text-sm text-talkapp-fg-muted">Nombre de cuenta: {currentName}</p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-16 h-16 rounded-full overflow-hidden bg-talkapp-panel border-2 border-talkapp-border flex items-center justify-center shrink-0 hover:border-talkapp-primary transition-colors focus:outline-none focus:ring-2 focus:ring-talkapp-primary"
            >
              {avatar ? (
                <img src={fullUrl(avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-500">👤</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-sm font-medium text-talkapp-fg">Foto de perfil</p>
              <p className="text-xs text-talkapp-fg-muted">{uploading ? 'Subiendo…' : 'Clic en la foto para cambiar'}</p>
              {avatar && (
                <button
                  type="button"
                  onClick={() => { setAvatar(null); setUploadError(null); }}
                  className="text-xs text-red-400 hover:text-red-300 focus:outline-none focus:underline text-left"
                >
                  Quitar foto
                </button>
              )}
              {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm text-talkapp-fg-muted mb-1">Apodo (cómo te ven en los chats)</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-lg border border-talkapp-border bg-talkapp-panel px-3 py-2 text-talkapp-fg placeholder-talkapp-fg-muted focus:border-talkapp-primary focus:outline-none focus:ring-1 focus:ring-talkapp-primary/50"
              placeholder={currentName}
            />
          </div>

          <div>
            <label className="block text-sm text-talkapp-fg-muted mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-talkapp-border bg-talkapp-panel px-3 py-2 text-talkapp-fg focus:border-talkapp-primary focus:outline-none focus:ring-1 focus:ring-talkapp-primary/50"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || '_empty'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-talkapp-fg-muted mt-0.5">Ej. Disponible, Ocupado</p>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-talkapp-fg-muted hover:bg-talkapp-panel">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 bg-talkapp-primary text-talkapp-on-primary font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Guardando…' : 'Guardar'}
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
