/**
 * Configuración de entorno y constantes de la app.
 * Las variables VITE_* se exponen al cliente en build time.
 */
export const env = {
  socketUrl: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001',
} as const
