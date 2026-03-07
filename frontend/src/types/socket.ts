export interface SocketMessage {
  id: string
  chatId: string
  text: string
  senderId: string
  senderName: string
  timestamp: number
}

export interface SendMessagePayload {
  chatId: string
  text: string
  senderId: string
  senderName: string
}

export interface SetUserPayload {
  userId: string
  userName: string
}
