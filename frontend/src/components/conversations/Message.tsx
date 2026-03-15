import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Message as MessageType, LinkPreview } from '../../types/conversation'
import { env } from '../../config/env'
import { ConfirmModal } from './ConfirmModal'

const LONG_TEXT_WORDS = 130

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function TextWithHighlight({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || highlight.trim() === '') {
    return <>{text}</>
  }
  const re = new RegExp(`(${escapeRegex(highlight.trim())})`, 'gi')
  const parts = text.split(re)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-talkapp-primary/35 text-talkapp-fg rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

function LongTextContent({ text, isOwn, highlight }: { text: string; isOwn: boolean; highlight?: string }) {
  const [expanded, setExpanded] = useState(false)
  const words = text.trim() ? text.trim().split(/\s+/) : []
  const isLong = words.length > LONG_TEXT_WORDS
  const displayText = isLong && !expanded
    ? words.slice(0, LONG_TEXT_WORDS).join(' ') + '...'
    : text
  const linkClass = isOwn
    ? 'text-blue-800 hover:text-blue-900 hover:underline'
    : 'text-talkapp-primary hover:text-talkapp-accent hover:underline [.bg-talkapp-received_&]:text-talkapp-received-fg [.bg-talkapp-received_&]:hover:opacity-90'
  return (
    <span className="block">
      <p className="text-sm break-words whitespace-pre-wrap">
        <TextWithHighlight text={displayText} highlight={highlight} />
      </p>
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

function LinkPreviewCard({
  linkPreview,
  fullUrlFn,
}: {
  linkPreview: LinkPreview
  fullUrlFn: (p: string) => string
}) {
  const url = linkPreview.url || '#'
  const imageUrl = linkPreview.imageUrl
    ? linkPreview.imageUrl.startsWith('http') || linkPreview.imageUrl.startsWith('data:')
      ? linkPreview.imageUrl
      : fullUrlFn(linkPreview.imageUrl)
    : null
  const title = linkPreview.title?.trim() || 'Enlace'
  const description = linkPreview.description?.trim()
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 rounded-xl overflow-hidden border border-black/20 max-w-[280px] hover:opacity-90 transition-opacity"
    >
      {imageUrl && (
        <div className="aspect-video bg-talkapp-sidebar">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-2.5">
        <p className="text-sm font-medium line-clamp-2">{title}</p>
        {description && <p className="text-xs opacity-90 mt-0.5 line-clamp-2">{description}</p>}
      </div>
    </a>
  )
}

interface MessageProps {
  message: MessageType
  currentUserId?: string
  /** Mostrar nombre del remitente encima del mensaje (solo en grupos) */
  showSenderName?: boolean
  onDeleteMessage?: (messageId: string, scope: 'for_me' | 'for_everyone') => void
}

function fullUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = env.apiUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

function ImageLightbox({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleZoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const handleZoomOut = () => {
    setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))
    if (zoom <= 1) setPan({ x: 0, y: 0 })
  }
  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      setPan({
        x: dragStartRef.current.panX + e.clientX - dragStartRef.current.x,
        y: dragStartRef.current.panY + e.clientY - dragStartRef.current.y,
      })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
    else setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa de imagen"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex h-full max-h-full w-full max-w-full flex-col items-center gap-3">
        <div
          className="flex flex-1 items-center justify-center overflow-hidden"
          onWheel={onWheel}
          style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <div
            className="inline-block select-none"
            onMouseDown={onMouseDown}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={imageUrl}
              alt=""
              className="max-h-[70vh] max-w-full w-auto object-contain pointer-events-none"
              draggable={false}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Alejar"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-colors min-w-[3rem]"
            title="Restablecer zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= ZOOM_MAX}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Acercar"
          >
            +
          </button>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-colors"
          >
            Abrir en nueva pestaña
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-colors"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function SenderAvatar({ avatar, name }: { avatar?: string | null; name?: string }) {
  const url = avatar?.trim() ? fullUrl(avatar) : ''
  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?'
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-talkapp-panel border border-talkapp-border flex items-center justify-center text-talkapp-fg-muted text-sm font-medium">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </div>
  )
}

export function Message({ message, currentUserId, showSenderName = false, onDeleteMessage }: MessageProps) {
  const isOwn = message.isOwn ?? false
  const [showMenu, setShowMenu] = useState(false)
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<'for_me' | 'for_everyone' | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const type = message.type || 'text'
  const canDeleteForEveryone = isOwn && onDeleteMessage
  const hasReadByOther =
    isOwn &&
    message.readBy &&
    message.readBy.some((id) => String(id) !== String(currentUserId ?? ''))
  const hasDeliveredByOther =
    isOwn &&
    message.deliveredBy &&
    message.deliveredBy.some((id) => String(id) !== String(currentUserId ?? ''))
  const messageStatus: 'sent' | 'delivered' | 'read' = hasReadByOther ? 'read' : hasDeliveredByOther ? 'delivered' : 'sent'

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

  if (message.deletedForEveryone) {
    const deletedByMe = message.deletedByUserId != null && String(message.deletedByUserId) === String(currentUserId ?? '')
    const text = deletedByMe ? 'Eliminaste este mensaje.' : 'Este mensaje fue eliminado.'
    const alignRight = deletedByMe
    const bubbleClass = alignRight
      ? 'rounded-br-md bg-talkapp-primary text-talkapp-on-primary'
      : 'rounded-bl-md bg-talkapp-received text-talkapp-received-fg'
    const mutedClass = alignRight ? 'text-talkapp-on-primary/70' : 'text-talkapp-received-muted'
    const showNameDeleted = showSenderName && !deletedByMe && (message.senderName?.trim() ?? '')
    return (
      <div className={`flex w-full ${alignRight ? 'justify-end' : 'justify-start'} mb-2 ${!alignRight && showNameDeleted ? 'gap-2 items-end' : ''}`}>
        {showNameDeleted && <SenderAvatar avatar={message.senderAvatar} name={message.senderName} />}
        <div className={`relative min-w-0 max-w-[85%] sm:max-w-[75%]`}>
          {showNameDeleted && (
            <p className="text-[11px] text-talkapp-fg-muted mb-0.5 px-1 font-medium" aria-label={`De ${message.senderName}`}>
              {message.senderName}
            </p>
          )}
          <div className={`rounded-[18px] px-4 py-2.5 max-w-full ${
            alignRight
              ? 'rounded-tr-[4px] bg-talkapp-primary text-talkapp-on-primary'
              : 'rounded-tl-[4px] bg-talkapp-received text-talkapp-received-fg'
          }`}>
            <div className="flex items-start gap-2">
              <span className={`flex-shrink-0 ${mutedClass}`} aria-hidden>
                <DeletedMessageIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm italic">{text}</p>
              </div>
            </div>
          </div>
          {/* Hora fuera de la burbuja */}
          <div className={`flex items-center gap-1 mt-0.5 px-1 ${alignRight ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-talkapp-fg-muted">{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  const showName = showSenderName && !isOwn && (message.senderName?.trim() ?? '')
  const showGroupAvatar = showSenderName && !isOwn

  return (
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} mb-1 group overflow-visible ${showGroupAvatar ? 'gap-2 items-end' : ''}`}>
      {showGroupAvatar && <SenderAvatar avatar={message.senderAvatar} name={message.senderName} />}
      <div className="relative min-w-0 max-w-[80%] sm:max-w-[68%] overflow-visible">
        {showName && (
          <p className="text-[11px] text-talkapp-primary/80 mb-0.5 px-1 font-semibold" aria-label={`De ${message.senderName}`}>
            {message.senderName}
          </p>
        )}
        {/* Burbuja */}
        <div
          className={`rounded-[20px] overflow-visible px-4 py-2.5 ${
            isOwn
              ? 'rounded-tr-[5px] bg-talkapp-primary text-talkapp-on-primary'
              : 'rounded-tl-[5px] bg-talkapp-received text-talkapp-received-fg'
          }`}
        >
          {type === 'image' && message.imageUrl && (
            <div className="block max-w-[280px]">
              <button
                type="button"
                onClick={() => setImageLightboxOpen(true)}
                className="block w-full rounded-lg overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-talkapp-primary focus:ring-offset-2 focus:ring-offset-transparent"
              >
                <img src={fullUrl(message.imageUrl)} alt="" className="w-full h-auto object-cover cursor-pointer" />
              </button>
              {imageLightboxOpen && (
                <ImageLightbox imageUrl={fullUrl(message.imageUrl)} onClose={() => setImageLightboxOpen(false)} />
              )}
            </div>
          )}
          {type === 'sticker' && (
            <span className="text-sm opacity-80">Sticker</span>
          )}
          {type === 'document' && message.documentUrl && (
            <a href={fullUrl(message.documentUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
              📄 Documento PDF
            </a>
          )}
          {type === 'voice' && message.voiceUrl && (
            <audio controls src={fullUrl(message.voiceUrl)} className="max-w-full min-w-[240px] h-9" />
          )}
          {(type === 'text' || type === 'emoji') && message.linkPreview && (message.linkPreview.title || message.linkPreview.description || message.linkPreview.imageUrl) && (
            <LinkPreviewCard linkPreview={message.linkPreview} fullUrlFn={fullUrl} />
          )}
          {(type === 'text' || type === 'emoji' || (type === 'image' && message.text) || (type === 'document' && message.text) || (type === 'voice' && message.text)) && (
            <LongTextContent text={message.text || ''} isOwn={isOwn} />
          )}
        </div>

        {/* Hora + estado FUERA de la burbuja */}
        <div className={`flex items-center gap-1 mt-0.5 px-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          {message.editedAt != null && message.editedAt > 0 && (
            <span className="text-[9px] text-talkapp-fg-muted italic">editado</span>
          )}
          <span className="text-[10px] text-talkapp-fg-muted">
            {formatTime(message.timestamp)}
          </span>
          {isOwn && (
            <span
              className="text-[10px] shrink-0"
              title={messageStatus === 'read' ? 'Visto' : messageStatus === 'delivered' ? 'Entregado' : 'Enviado'}
              aria-label={messageStatus === 'read' ? 'Visto' : messageStatus === 'delivered' ? 'Entregado' : 'Enviado'}
            >
              {messageStatus === 'read' ? (
                <DoubleCheckIcon className="text-talkapp-primary drop-shadow-sm" />
              ) : messageStatus === 'delivered' ? (
                <DoubleCheckIcon className="text-talkapp-fg-muted" />
              ) : (
                <SingleCheckIcon className="text-talkapp-fg-muted" />
              )}
            </span>
          )}
        </div>

        {onDeleteMessage ? (
          <>
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setShowMenu((v) => !v)}
                className="absolute -bottom-1 right-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1 bg-talkapp-panel border border-talkapp-border text-slate-400 hover:text-talkapp-primary"
                aria-label="Opciones del mensaje"
              >
                <MenuDotsIcon />
              </button>
              {showMenu && menuStyle &&
                createPortal(
                  <div
                    ref={menuRef}
                    data-message-menu
                    className="fixed rounded-lg bg-talkapp-sidebar border border-talkapp-border py-1 shadow-xl z-[100] min-w-[180px] max-h-[min(280px,70vh)] overflow-y-auto"
                    style={{ top: menuStyle.top, left: menuStyle.left }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false)
                        setDeleteConfirm('for_me')
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-talkapp-fg hover:bg-talkapp-panel"
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
                        className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-talkapp-panel"
                      >
                        Eliminar para todos
                      </button>
                    )}
                  </div>,
                    document.body
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

function MenuDotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
    </svg>
  )
}

function SingleCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 inline ${className ?? ''}`} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function DoubleCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-3.5 h-3.5 inline ${className ?? ''}`} aria-hidden>
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
