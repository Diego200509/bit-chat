import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import * as api from '../../lib/api'

const TYPING_DEBOUNCE_MS = 400
const STOP_TYPING_DELAY_MS = 2000

interface MessageInputProps {
  onSend: (text: string) => void
  onSendImage?: (url: string) => void
  onSendDocument?: (url: string) => void
  onSendVoice?: (url: string) => void
  onTyping?: () => void
  onStopTyping?: () => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSend,
  onSendImage,
  onSendDocument,
  onSendVoice,
  onTyping,
  onStopTyping,
  disabled = false,
  placeholder = 'Escribe un mensaje',
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
      if (stopTypingRef.current) clearTimeout(stopTypingRef.current)
    }
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onStopTyping?.()
    onSend(trimmed)
    setText('')
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

  const onDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onSendDocument) return
    setUploading(true)
    try {
      const url = await api.uploadFile(file)
      onSendDocument(url)
    } catch {} finally {
      setUploading(false)
    }
  }

  const startRecording = useCallback(() => {
    if (!onSendVoice) return
    chunksRef.current = []
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], 'nota.webm', { type: 'audio/webm' })
        setUploading(true)
        try {
          const url = await api.uploadFile(file)
          onSendVoice(url)
        } catch {} finally {
          setUploading(false)
        }
      }
      recorder.start()
      setRecording(true)
    }).catch(() => {})
  }, [onSendVoice])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
      setRecording(false)
    }
  }, [])

  return (
    <div className="border-t border-talkapp-border bg-talkapp-panel p-2 safe-b safe-l safe-r md:p-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onDocumentChange}
        />
        {onSendImage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="rounded-full p-2.5 text-talkapp-fg-muted hover:bg-talkapp-sidebar hover:text-talkapp-primary transition-colors disabled:opacity-50"
            aria-label="Adjuntar imagen"
            title="Adjuntar imagen"
          >
            {uploading ? <SpinnerIcon /> : <AttachIcon />}
          </button>
        )}
        {onSendDocument && (
          <button
            type="button"
            onClick={() => documentInputRef.current?.click()}
            disabled={disabled || uploading}
            className="rounded-full p-2.5 text-talkapp-fg-muted hover:bg-talkapp-sidebar hover:text-talkapp-primary transition-colors disabled:opacity-50"
            aria-label="Adjuntar documento PDF"
            title="Adjuntar documento PDF"
          >
            <DocumentIcon />
          </button>
        )}
        <input
          type="text"
          value={text}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            if (disabled || !onTyping || !onStopTyping) return
            if (stopTypingRef.current) {
              clearTimeout(stopTypingRef.current)
              stopTypingRef.current = null
            }
            if (next.trim().length > 0) {
              if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
              typingDebounceRef.current = setTimeout(() => {
                typingDebounceRef.current = null
                onTyping()
                stopTypingRef.current = setTimeout(() => {
                  stopTypingRef.current = null
                  onStopTyping()
                }, STOP_TYPING_DELAY_MS)
              }, TYPING_DEBOUNCE_MS)
            } else {
              if (typingDebounceRef.current) {
                clearTimeout(typingDebounceRef.current)
                typingDebounceRef.current = null
              }
              onStopTyping()
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-2xl border border-talkapp-border bg-talkapp-sidebar px-4 py-2.5 text-base text-talkapp-fg placeholder-talkapp-fg-muted focus:border-talkapp-primary focus:outline-none focus:ring-2 focus:ring-talkapp-primary/50 md:text-sm"
        />
        {text.trim() ? (
          <button
            type="submit"
            disabled={disabled}
            className="rounded-full bg-talkapp-primary text-talkapp-on-primary p-2.5 hover:bg-talkapp-accent focus:outline-none focus:ring-2 focus:ring-talkapp-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar mensaje"
          >
            <SendIcon />
          </button>
        ) : onSendVoice ? (
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled || uploading}
            className={`rounded-full p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-talkapp-primary disabled:opacity-50 disabled:cursor-not-allowed ${recording ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 focus:ring-red-500/50' : 'bg-talkapp-primary text-talkapp-on-primary hover:bg-talkapp-accent'}`}
            aria-label={recording ? 'Detener grabación' : 'Nota de voz'}
            title={recording ? 'Detener grabación' : 'Nota de voz'}
          >
            <MicIcon />
          </button>
        ) : (
          <button
            type="submit"
            disabled
            className="rounded-full bg-talkapp-primary text-talkapp-on-primary p-2.5 opacity-50 cursor-not-allowed"
            aria-label="Enviar mensaje"
          >
            <SendIcon />
          </button>
        )}
      </form>
    </div>
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

function DocumentIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
      <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
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
