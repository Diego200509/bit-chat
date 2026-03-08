import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Message as MessageType } from '../../types/chat'
import { env } from '../../config/env'
import { ConfirmModal } from './ConfirmModal'

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
    : 'text-bitchat-cyan hover:text-bitchat-cyan-bright hover:underline [.bg-bitchat-received_&]:text-bitchat-received-fg [.bg-bitchat-received_&]:hover:opacity-90'
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
  /** Mostrar nombre del remitente encima del mensaje (solo en grupos) */
  showSenderName?: boolean
  onReaction?: (messageId: string, emoji: string) => void
  onEditMessage?: (messageId: string, text: string) => void
  onPinMessage?: (messageId: string) => void
  onUnpinMessage?: (messageId: string) => void
  onDeleteMessage?: (messageId: string, scope: 'for_me' | 'for_everyone') => void
}

function fullUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = env.apiUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

function SenderAvatar({ avatar, name }: { avatar?: string | null; name?: string }) {
  const url = avatar?.trim() ? fullUrl(avatar) : ''
  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?'
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-bitchat-panel border border-bitchat-border flex items-center justify-center text-bitchat-fg-muted text-sm font-medium">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </div>
  )
}

export function Message({ message, currentUserId, showSenderName = false, onReaction, onEditMessage, onPinMessage, onUnpinMessage, onDeleteMessage }: MessageProps) {
  const isOwn = message.isOwn ?? false
  const [showReactions, setShowReactions] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<'for_me' | 'for_everyone' | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.text || '')
  const [pickerStyle, setPickerStyle] = useState<{ top: number; left: number } | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const type = message.type || 'text'
  const hasReactions = message.reactions && message.reactions.length > 0
  const canEdit = isOwn && type === 'text' && onEditMessage
  const canDeleteForEveryone = isOwn && onDeleteMessage
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
    const menuWidth = 180
    const viewportW = window.innerWidth
    const left = Math.max(padding, Math.min(viewportW - menuWidth - padding, isOwn ? rect.right - menuWidth : rect.left))
    setMenuStyle({ top: rect.bottom + padding, left })
  }, [showMenu, isOwn])

  useLayoutEffect(() => {
    if (!showMenu || !menuStyle || !menuButtonRef.current || !menuRef.current) return
    const rect = menuButtonRef.current.getBoundingClientRect()
    const padding = 8
    const viewportH = window.innerHeight
    const menuHeight = menuRef.current.offsetHeight
    const isCurrentlyBelow = menuStyle.top >= rect.bottom
    if (isCurrentlyBelow && menuStyle.top + menuHeight > viewportH - padding) {
      const topUp = rect.top - menuHeight - padding
      setMenuStyle((prev) => (prev ? { ...prev, top: Math.max(padding, topUp) } : prev))
    }
  }, [showMenu, menuStyle])

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

  if (message.deletedForEveryone) {
    const deletedByMe = message.deletedByUserId != null && String(message.deletedByUserId) === String(currentUserId ?? '')
    const text = deletedByMe ? 'Eliminaste este mensaje.' : 'Este mensaje fue eliminado.'
    const alignRight = deletedByMe
    const bubbleClass = alignRight
      ? 'rounded-br-md bg-bitchat-cyan text-bitchat-blue-dark'
      : 'rounded-bl-md bg-bitchat-received text-bitchat-received-fg'
    const mutedClass = alignRight ? 'text-bitchat-blue-dark/70' : 'text-bitchat-received-muted'
    const showNameDeleted = showSenderName && !deletedByMe && (message.senderName?.trim() ?? '')
    return (
      <div className={`flex w-full ${alignRight ? 'justify-end' : 'justify-start'} mb-2 ${!alignRight && showNameDeleted ? 'gap-2 items-end' : ''}`}>
        {showNameDeleted && <SenderAvatar avatar={message.senderAvatar} name={message.senderName} />}
        <div className={`relative min-w-0 max-w-[85%] sm:max-w-[75%]`}>
          {showNameDeleted && (
            <p className="text-[11px] text-bitchat-fg-muted mb-0.5 px-1 font-medium" aria-label={`De ${message.senderName}`}>
              {message.senderName}
            </p>
          )}
          <div className={`rounded-2xl px-4 py-2.5 max-w-full ${bubbleClass}`}>
            <div className="flex items-start gap-2">
              <span className={`flex-shrink-0 ${mutedClass}`} aria-hidden>
                <DeletedMessageIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm italic">{text}</p>
                <p className={`text-[10px] ${mutedClass} mt-0.5 text-right`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const showName = showSenderName && !isOwn && (message.senderName?.trim() ?? '')
  const showGroupAvatar = showSenderName && !isOwn

  return (
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} mb-2 group overflow-visible ${showGroupAvatar ? 'gap-2 items-end' : ''}`}>
      {showGroupAvatar && <SenderAvatar avatar={message.senderAvatar} name={message.senderName} />}
      <div className="relative min-w-0 max-w-[85%] sm:max-w-[75%] overflow-visible">
        {showName && (
          <p className="text-[11px] text-bitchat-fg-muted mb-0.5 px-1 font-medium" aria-label={`De ${message.senderName}`}>
            {message.senderName}
          </p>
        )}
        <div
          className={`rounded-2xl overflow-visible ${
            type === 'sticker' ? 'p-2' : 'px-4 py-2'
          } ${
            isOwn
              ? 'rounded-br-md bg-bitchat-cyan text-bitchat-blue-dark'
              : 'rounded-bl-md bg-bitchat-received text-bitchat-received-fg'
          }`}
        >
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
              <span className={`text-[10px] ${isOwn ? 'text-bitchat-blue-dark/70' : 'text-bitchat-received-muted'}`}>editado</span>
            )}
            <p
              className={`text-[10px] ${hasReactions ? 'ml-1' : ''} ${
                isOwn ? 'text-bitchat-blue-dark/70' : 'text-bitchat-received-muted'
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
        {(onReaction && currentUserId) || onEditMessage || onPinMessage || onUnpinMessage || onDeleteMessage ? (
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
            {(canEdit || onPinMessage || onUnpinMessage || onDeleteMessage) && (
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
                      ref={menuRef}
                      data-message-menu
                      className="fixed rounded-lg bg-bitchat-sidebar border border-bitchat-border py-1 shadow-xl z-[100] min-w-[180px] max-h-[min(280px,70vh)] overflow-y-auto"
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
                      {onDeleteMessage && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setShowMenu(false)
                              setDeleteConfirm('for_me')
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-bitchat-panel"
                          >
                            Eliminar para mí
                          </button>
                          {canDeleteForEveryone && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowMenu(false)
                                setDeleteConfirm('for_everyone')
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-bitchat-panel"
                            >
                              Eliminar para todos
                            </button>
                          )}
                        </>
                      )}
                    </div>,
                    document.body
                  )}
              </>
            )}
          </>
        ) : null}
      </div>

      {deleteConfirm === 'for_me' && (
        <ConfirmModal
          title="Eliminar para mí"
          message="El mensaje se ocultará solo para ti. Los demás seguirán viéndolo."
          confirmLabel="Eliminar"
          onConfirm={() => {
            onDeleteMessage?.(message.id, 'for_me')
            setDeleteConfirm(null)
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      {deleteConfirm === 'for_everyone' && (
        <ConfirmModal
          title="Eliminar para todos"
          message="El mensaje se borrará para todos los participantes. Esta acción no se puede deshacer."
          confirmLabel="Eliminar para todos"
          danger
          onConfirm={() => {
            onDeleteMessage?.(message.id, 'for_everyone')
            setDeleteConfirm(null)
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

function DeletedMessageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93l14.14 14.14" />
    </svg>
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
