import { useState, useEffect } from 'react'

interface EditProfileModalProps {
  currentName: string
  currentNickname: string
  onClose: () => void
  onSave: (nickname: string) => Promise<void>
}

export function EditProfileModal({ currentName, currentNickname, onClose, onSave }: EditProfileModalProps) {
  const [nickname, setNickname] = useState(currentNickname)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setNickname(currentNickname)
  }, [currentNickname])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave(nickname.trim() || '')
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
