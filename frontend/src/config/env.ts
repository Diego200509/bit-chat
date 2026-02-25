/**
 * Configuración de entorno y constantes de la app.
 * Las variables VITE_* se exponen al cliente en build time.
 */
const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
export const env = {
  apiUrl: baseUrl,
  socketUrl: import.meta.env.VITE_SOCKET_URL || baseUrl,
} as const
