import { useState, useRef, type FormEvent } from 'react'
import * as api from '../../lib/api'

const EMOJIS = ['😀', '😂', '❤️', '👍', '👎', '😢', '😮', '🎉', '🔥', '👋', '🤔', '✅']
const STICKERS: { path: string; emoji: string }[] = [
  { path: '/stickers/1.svg', emoji: '😀' },
  { path: '/stickers/2.svg', emoji: '😂' },
  { path: '/stickers/3.svg', emoji: '❤️' },
  { path: '/stickers/4.svg', emoji: '👍' },
  { path: '/stickers/5.svg', emoji: '🎉' },
  { path: '/stickers/6.svg', emoji: '🔥' },
]

interface MessageInputProps {
  onSend: (text: string) => void
  onSendImage?: (url: string) => void
  onSendSticker?: (url: string) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSend,
  onSendImage,
  onSendSticker,
  disabled = false,
  placeholder = 'Escribe un mensaje',
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji)
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onSendImage) return
    setUploading(true)
    try {
      const url = await api.uploadImage(file)
      onSendImage(url)
    } catch {} finally {
      setUploading(false)
    }
  }

  return (
    <div className="border-t border-bitchat-border bg-bitchat-panel p-2 safe-b safe-l safe-r md:p-3">
      {(showEmoji || showStickers) && (
        <div className="flex gap-1 p-2 mb-2 rounded-xl bg-bitchat-sidebar border border-bitchat-border">
          {showEmoji && (
            <div className="flex flex-wrap gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="text-2xl p-1 hover:bg-bitchat-panel rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {showStickers && onSendSticker && (
            <div className="flex flex-wrap gap-1">
              {STICKERS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onSendSticker(s.path)
                    setShowStickers(false)
                  }}
                  className="w-12 h-12 rounded-lg border border-bitchat-border hover:border-bitchat-cyan bg-bitchat-panel flex items-center justify-center text-2xl"
                  title="Enviar sticker"
                >
                  {s.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={() => {
            setShowStickers((v) => !v)
            setShowEmoji(false)
          }}
          className="rounded-full p-2.5 text-bitchat-fg-muted hover:bg-bitchat-sidebar hover:text-bitchat-cyan transition-colors"
          aria-label="Stickers"
          title="Stickers"
        >
          <StickerIcon />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowEmoji((v) => !v)
            setShowStickers(false)
          }}
          className="rounded-full p-2.5 text-bitchat-fg-muted hover:bg-bitchat-sidebar hover:text-bitchat-cyan transition-colors"
          aria-label="Emojis"
          title="Emojis"
        >
          <EmojiIcon />
        </button>
        {onSendImage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="rounded-full p-2.5 text-bitchat-fg-muted hover:bg-bitchat-sidebar hover:text-bitchat-cyan transition-colors disabled:opacity-50"
            aria-label="Adjuntar imagen"
            title="Adjuntar imagen"
          >
            {uploading ? <SpinnerIcon /> : <AttachIcon />}
          </button>
        )}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-2xl border border-bitchat-border bg-bitchat-sidebar px-4 py-2.5 text-base text-bitchat-fg placeholder-bitchat-fg-muted focus:border-bitchat-cyan focus:outline-none focus:ring-2 focus:ring-bitchat-cyan/50 md:text-sm"
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
    </div>
  )
}

function EmojiIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75a.75.75 0 0 0 0 1.5.75.75 0 0 0 0-1.5Zm4.5 0a.75.75 0 0 0 0 1.5.75.75 0 0 0 0-1.5Z" clipRule="evenodd" />
    </svg>
  )
}

function StickerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93Zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39Z" />
    </svg>
  )
}

function AttachIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.694a5.25 5.25 0 1 1-7.424-7.425l10.94-10.94a.75.75 0 0 1 1.061 1.06Z" clipRule="evenodd" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-label="Cargando">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905h13.42a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.52 60.52 0 0 0 18.445-8.987.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
    </svg>
  )
}
