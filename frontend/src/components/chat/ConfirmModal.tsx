interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  /** Si true, el botón de confirmar usa estilo de peligro (rojo) */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-xl bg-bitchat-sidebar border border-bitchat-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-bitchat-border p-4">
          <h2 className="font-semibold text-slate-200">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-400 hover:bg-bitchat-panel hover:text-slate-200"
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="p-4">
          <p className="text-sm text-slate-400 mb-4">{message}</p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-slate-300 hover:bg-bitchat-panel"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm()
              }}
              className={
                danger
                  ? 'rounded-lg px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-500'
                  : 'rounded-lg px-4 py-2 bg-bitchat-cyan text-bitchat-blue-dark font-medium hover:opacity-90'
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
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
