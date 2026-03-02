import { useState, useRef } from 'react'
import * as api from '../../lib/api'
import { env } from '../../config/env'

interface EditProfileModalProps {
  currentName: string
  currentNickname: string
  currentAvatar?: string | null
  currentVisibility?: 'visible' | 'invisible'
  onClose: () => void
  onSave: (updates: { nickname: string; avatar?: string | null; visibility?: 'visible' | 'invisible' }) => Promise<void>
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
  currentVisibility = 'visible',
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [nickname, setNickname] = useState(currentNickname)
  const [avatar, setAvatar] = useState<string | null>(currentAvatar ?? null)
  const [visibility, setVisibility] = useState<'visible' | 'invisible'>(currentVisibility)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await api.uploadImage(file)
      setAvatar(url)
    } catch {
      // error ya mostrado por api
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
        avatar: avatar ?? undefined,
        visibility,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-bitchat-sidebar border border-bitchat-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-bitchat-border p-4">
          <h2 className="font-semibold text-bitchat-cyan">Editar perfil</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-bitchat-panel hover:text-slate-200" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <p className="text-sm text-slate-400">Nombre de cuenta: {currentName}</p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-16 h-16 rounded-full overflow-hidden bg-bitchat-panel border-2 border-bitchat-border flex items-center justify-center shrink-0 hover:border-bitchat-cyan transition-colors"
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
            <div>
              <p className="text-sm font-medium text-slate-300">Foto de perfil</p>
              <p className="text-xs text-slate-500">{uploading ? 'Subiendo…' : 'Clic para cambiar'}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Apodo (cómo te ven en los chats)</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-lg border border-bitchat-border bg-bitchat-panel px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-bitchat-cyan focus:outline-none focus:ring-1 focus:ring-bitchat-cyan/50"
              placeholder={currentName}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Modo invisible</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibility === 'invisible'}
                onChange={(e) => setVisibility(e.target.checked ? 'invisible' : 'visible')}
                className="rounded border-bitchat-border bg-bitchat-panel text-bitchat-cyan focus:ring-bitchat-cyan"
              />
              <span className="text-sm text-slate-300">No mostrar que estoy en línea</span>
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-300 hover:bg-bitchat-panel">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 bg-bitchat-cyan text-bitchat-blue-dark font-medium hover:opacity-90 disabled:opacity-50"
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
