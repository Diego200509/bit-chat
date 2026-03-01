import { useState, type FormEvent } from 'react'

interface MessageInputProps {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Input para escribir y enviar mensajes (estilo WhatsApp: botón de enviar a la derecha).
 */
export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Escribe un mensaje',
}: MessageInputProps) {
  const [text, setText] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-bitchat-border bg-bitchat-panel p-3 safe-b md:p-3"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-w-0 flex-1 rounded-2xl border border-bitchat-border bg-bitchat-sidebar px-4 py-2.5 text-base text-slate-100 placeholder-slate-500 focus:border-bitchat-cyan focus:outline-none focus:ring-2 focus:ring-bitchat-cyan/50 md:text-sm"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-full bg-bitchat-cyan text-bitchat-blue-dark p-2.5 hover:bg-bitchat-cyan-bright focus:outline-none focus:ring-2 focus:ring-bitchat-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Enviar mensaje"
      >
        <SendIcon />
      </button>
    </form>
  )
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
    >
      <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905h13.42a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.52 60.52 0 0 0 18.445-8.987.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
    </svg>
  )
}
