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
    <div className="border-t border-talkapp-border/50 bg-talkapp-panel/90 px-3 py-3 safe-b safe-l safe-r">
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
            className="rounded-full p-2 text-talkapp-fg-muted hover:text-talkapp-primary transition-colors disabled:opacity-40"
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
            className="rounded-full p-2 text-talkapp-fg-muted hover:text-talkapp-primary transition-colors disabled:opacity-40"
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
          className="min-w-0 flex-1 rounded-[999px] border border-talkapp-border/60 bg-talkapp-sidebar/80 px-5 py-2.5 text-base text-talkapp-fg placeholder-talkapp-fg-muted focus:border-talkapp-primary/50 focus:outline-none focus:ring-2 focus:ring-talkapp-primary/25 md:text-sm transition-all"
        />
        {text.trim() ? (
          <button
            type="submit"
            disabled={disabled}
            className="rounded-full bg-talkapp-primary text-white p-2.5 hover:bg-talkapp-accent focus:outline-none focus:ring-2 focus:ring-talkapp-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            aria-label="Enviar mensaje"
          >
            <SendIcon />
          </button>
        ) : onSendVoice ? (
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled || uploading}
            className={`rounded-full p-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-talkapp-primary disabled:opacity-50 disabled:cursor-not-allowed ${recording ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 focus:ring-red-500/50' : 'bg-talkapp-primary text-white hover:bg-talkapp-accent'}`}
            aria-label={recording ? 'Detener grabación' : 'Nota de voz'}
            title={recording ? 'Detener grabación' : 'Nota de voz'}
          >
            <MicIcon />
          </button>
        ) : (
          <button
            type="submit"
            disabled
            className="rounded-full bg-talkapp-primary text-white p-2.5 opacity-40 cursor-not-allowed"
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
