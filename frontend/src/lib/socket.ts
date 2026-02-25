import { io } from 'socket.io-client'
import { env } from '../config/env'

/** Socket solo se conecta cuando hay token (desde AuthContext). */
export const socket = io(env.socketUrl, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
})
