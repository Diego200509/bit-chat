import type { Message as MessageType } from '../../types/chat'

interface MessageProps {
  message: MessageType
}

/**
 * Un solo mensaje en la burbuja (estilo WhatsApp).
 * Enviados a la derecha en cyan; recibidos a la izquierda en gris azulado.
 */
export function Message({ message }: MessageProps) {
  const isOwn = message.isOwn ?? false

  return (
    <div
      className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOwn
            ? 'rounded-br-md bg-bitchat-cyan text-bitchat-blue-dark'
            : 'rounded-bl-md bg-bitchat-received text-slate-200'
        }`}
      >
        {!isOwn && (
          <p className="text-xs text-bitchat-cyan-bright mb-0.5 font-medium">
            {message.senderName}
          </p>
        )}
        <p className="text-sm break-words">{message.text}</p>
        <p
          className={`text-[10px] mt-1 ${
            isOwn ? 'text-bitchat-blue-dark/70' : 'text-slate-400'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return date.toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
