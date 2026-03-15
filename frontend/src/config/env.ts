/** Configuración de entorno para TalkApp */
const API_PORT = import.meta.env.VITE_API_PORT || '3001'
const defaultBaseUrl =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:${API_PORT}`
    : 'http://localhost:3001'
const baseUrl = import.meta.env.VITE_API_URL || defaultBaseUrl

export const env = {
  appName: 'TalkApp',
  apiUrl: baseUrl,
  socketUrl: import.meta.env.VITE_SOCKET_URL || baseUrl,
} as const
