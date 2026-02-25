/**
 * Tipos para eventos y payloads de Socket.io.
 */

/** Mensaje que llega del servidor (evento new_message) */
export interface SocketMessage {
  id: string
  chatId: string
  text: string
  senderId: string
  senderName: string
  timestamp: number
}

/** Payload para emitir send_message */
export interface SendMessagePayload {
  chatId: string
  text: string
  senderId: string
  senderName: string
}

/** Payload para emitir set_user */
export interface SetUserPayload {
  userId: string
  userName: string
}
