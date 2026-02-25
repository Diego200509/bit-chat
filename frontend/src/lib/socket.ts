import { io } from 'socket.io-client'
import { env } from '../config/env'

export const socket = io(env.socketUrl, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
})
