import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastMessage = string

interface ToastContextValue {
  showToast: (message: ToastMessage) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 3000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null)

  const showToast = useCallback((msg: ToastMessage) => {
    setMessage(msg)
    const t = setTimeout(() => setMessage(null), TOAST_DURATION_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message != null && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-talkapp-sidebar border border-talkapp-border text-talkapp-fg text-sm shadow-lg animate-toast-in safe-b max-w-[calc(100vw-2rem)]"
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue['showToast'] {
  const ctx = useContext(ToastContext)
  return ctx?.showToast ?? (() => {})
}
