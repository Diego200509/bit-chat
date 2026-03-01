import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Message as MessageType } from '../../types/chat'
import { env } from '../../config/env'

const QUICK_EMOJIS = ['👍', '❤️', '😄', '😮', '😢', '👎']
const LONG_TEXT_WORDS = 130

function LongTextContent({ text, isOwn }: { text: string; isOwn: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const words = text.trim() ? text.trim().split(/\s+/) : []
  const isLong = words.length > LONG_TEXT_WORDS
  const displayText = isLong && !expanded
    ? words.slice(0, LONG_TEXT_WORDS).join(' ') + '...'
    : text
  const linkClass = isOwn
    ? 'text-blue-800 hover:text-blue-900 hover:underline'
    : 'text-bitchat-cyan hover:text-bitchat-cyan-bright hover:underline'
  return (
    <span className="block">
      <p className="text-sm break-words whitespace-pre-wrap">{displayText}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={`text-xs font-medium mt-0.5 focus:outline-none ${linkClass}`}
        >
          {expanded ? 'Leer menos' : 'Leer más'}
        </button>
      )}
    </span>
  )
}

function StickerContent({ url, fullUrl }: { url: string | null | undefined; fullUrl: (p: string) => string }) {
  const [failed, setFailed] = useState(false)
  const showImg = url && !failed
  return (
    <span className="inline-block flex items-center justify-center overflow-visible">
      {showImg ? (
        <img
          key={url}
          src={fullUrl(url)}
          alt=""
          className="w-[100px] h-[100px] object-contain flex-shrink-0"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-5xl" title="Sticker">🖼️</span>
      )}
    </span>
  )
}

interface MessageProps {
  message: MessageType
  currentUserId?: string
  onReaction?: (messageId: string, emoji: string) => void
  onEditMessage?: (messageId: string, text: string) => void
  onPinMessage?: (messageId: string) => void
  onUnpinMessage?: (messageId: string) => void
}

function fullUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = env.apiUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

/**
 * Un solo mensaje: texto, imagen, sticker y reacciones.
 */
export function Message({ message, currentUserId, onReaction, onEditMessage, onPinMessage, onUnpinMessage }: MessageProps) {
  const isOwn = message.isOwn ?? false
  const [showReactions, setShowReactions] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.text || '')
  const [pickerStyle, setPickerStyle] = useState<{ top: number; left: number } | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const type = message.type || 'text'
  const hasReactions = message.reactions && message.reactions.length > 0
  const canEdit = isOwn && type === 'text' && onEditMessage
  const showReadBy =
    isOwn &&
    message.readBy &&
    message.readBy.some((id) => String(id) !== String(currentUserId ?? ''))

  useEffect(() => {
    if (!showReactions || !buttonRef.current) {
      setPickerStyle(null)
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    const padding = 8
    const pickerWidth = 220
    const pickerHeight = 48
    const top = rect.top - pickerHeight - padding
    const left = isOwn
      ? Math.min(window.innerWidth - pickerWidth - padding, Math.max(padding, rect.right - pickerWidth))
      : Math.max(padding, Math.min(rect.left, window.innerWidth - pickerWidth - padding))
    setPickerStyle({ top, left })
  }, [showReactions, isOwn])

  useEffect(() => {
    if (!showReactions) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (document.querySelector('[data-reaction-picker]')?.contains(target)) return
      setShowReactions(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [showReactions])

  useEffect(() => {
    if (!showMenu || !menuButtonRef.current) {
      setMenuStyle(null)
      return
    }
    const rect = menuButtonRef.current.getBoundingClientRect()
    const padding = 8
    const menuWidth = 160
    const top = rect.bottom + padding
    const left = isOwn ? Math.max(padding, rect.right - menuWidth) : Math.min(window.innerWidth - menuWidth - padding, rect.left)
    setMenuStyle({ top, left })
  }, [showMenu, isOwn])

  useEffect(() => {
    if (!showMenu) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuButtonRef.current?.contains(target)) return
      if (document.querySelector('[data-message-menu]')?.contains(target)) return
      setShowMenu(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [showMenu])

  const handleSaveEdit = () => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== (message.text || '') && onEditMessage) {
      onEditMessage(message.id, trimmed)
    }
    setEditing(false)
    setEditText(message.text || '')
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setEditText(message.text || '')
  }

  return (
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} mb-2 group overflow-visible`}>
      <div className="relative max-w-[85%] sm:max-w-[75%] overflow-visible">
        <div
          className={`rounded-2xl overflow-visible ${
            type === 'sticker' ? 'p-2' : 'px-4 py-2'
          } ${
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
          {type === 'image' && message.imageUrl && (
            <a href={fullUrl(message.imageUrl)} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden max-w-[280px]">
              <img src={fullUrl(message.imageUrl)} alt="" className="w-full h-auto object-cover" />
            </a>
          )}
          {type === 'sticker' && (
            <StickerContent url={message.stickerUrl} fullUrl={fullUrl} />
          )}
          {(type === 'text' || type === 'emoji' || (type === 'image' && message.text)) && !editing && (
            <LongTextContent text={message.text || ''} isOwn={isOwn} />
          )}
          {editing && (
            <div className="space-y-2 mt-1">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSaveEdit()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    handleCancelEdit()
                  }
                }}
                className="w-full min-h-[60px] rounded-lg px-2 py-1.5 text-sm bg-black/20 border border-bitchat-border text-slate-100 focus:outline-none focus:ring-1 focus:ring-bitchat-cyan resize-none"
                autoFocus
                rows={2}
                placeholder="Enter para guardar, Esc para cancelar"
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveEdit} className="text-xs font-medium text-bitchat-cyan hover:underline">
                  Guardar
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-1 mt-1 flex-wrap">
            {hasReactions && (
              <span className="flex flex-wrap gap-0.5">
                {Array.from(
                  new Map(
                    (message.reactions || []).map((r) => [
                      r.emoji,
                      (message.reactions || []).filter((x) => x.emoji === r.emoji).length,
                    ])
                  ).entries()
                ).map(([emoji, count]) => (
                  <span key={emoji} className="text-xs bg-black/20 rounded px-1" title={`${count}`}>
                    {emoji} {count > 1 ? count : ''}
                  </span>
                ))}
              </span>
            )}
            {message.editedAt != null && message.editedAt > 0 && (
              <span className={`text-[10px] ${isOwn ? 'text-bitchat-blue-dark/70' : 'text-slate-400'}`}>editado</span>
            )}
            <p
              className={`text-[10px] ${hasReactions ? 'ml-1' : ''} ${
                isOwn ? 'text-bitchat-blue-dark/70' : 'text-slate-400'
              }`}
            >
              {formatTime(message.timestamp)}
            </p>
            {showReadBy && (
              <span className="text-[10px] text-bitchat-blue-dark/70" title="Visto" aria-label="Visto">
                <ReadCheckIcon />
              </span>
            )}
          </div>
        </div>
        {(onReaction && currentUserId) || onEditMessage || onPinMessage || onUnpinMessage ? (
          <>
            {onReaction && currentUserId && (
              <>
                <button
                  ref={buttonRef}
                  type="button"
                  onClick={() => setShowReactions((v) => !v)}
                  className="absolute -bottom-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1 bg-bitchat-panel border border-bitchat-border text-slate-400 hover:text-bitchat-cyan"
                  aria-label="Reaccionar"
                >
                  <SmileyIcon />
                </button>
                {showReactions && pickerStyle &&
                  createPortal(
                    <div
                      data-reaction-picker
                      className="fixed flex gap-1 rounded-xl bg-bitchat-sidebar border border-bitchat-border p-2 shadow-xl z-[100]"
                      style={{ top: pickerStyle.top, left: pickerStyle.left }}
                    >
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            onReaction(message.id, emoji)
                            setShowReactions(false)
                          }}
                          className="text-xl hover:scale-110 transition-transform p-1 rounded hover:bg-bitchat-panel"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
              </>
            )}
            {(canEdit || onPinMessage || onUnpinMessage) && (
              <>
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={() => setShowMenu((v) => !v)}
                  className="absolute -bottom-1 right-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1 bg-bitchat-panel border border-bitchat-border text-slate-400 hover:text-bitchat-cyan"
                  aria-label="Opciones del mensaje"
                >
                  <MenuDotsIcon />
                </button>
                {showMenu && menuStyle &&
                  createPortal(
                    <div
                      data-message-menu
                      className="fixed rounded-lg bg-bitchat-sidebar border border-bitchat-border py-1 shadow-xl z-[100] min-w-[140px]"
                      style={{ top: menuStyle.top, left: menuStyle.left }}
                    >
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(true)
                            setEditText(message.text || '')
                            setShowMenu(false)
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-bitchat-panel"
                        >
                          Editar
                        </button>
                      )}
                      {message.pinned ? (
                        onUnpinMessage && (
                          <button
                            type="button"
                            onClick={() => {
                              onUnpinMessage(message.id)
                              setShowMenu(false)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-bitchat-panel"
                          >
                            Desfijar mensaje
                          </button>
                        )
                      ) : (
                        onPinMessage && (
                          <button
                            type="button"
                            onClick={() => {
                              onPinMessage(message.id)
                              setShowMenu(false)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-bitchat-panel"
                          >
                            Fijar mensaje
                          </button>
                        )
                      )}
                    </div>,
                    document.body
                  )}
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

function SmileyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75a.75.75 0 0 0 0 1.5.75.75 0 0 0 0-1.5Zm4.5 0a.75.75 0 0 0 0 1.5.75.75 0 0 0 0-1.5Z" clipRule="evenodd" />
    </svg>
  )
}

function MenuDotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
    </svg>
  )
}

function ReadCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 inline" aria-hidden>
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
    </svg>
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
