/**
 * Nombres de eventos Socket.io (deben coincidir con el backend).
 * Un solo lugar para evitar typos y facilitar cambios.
 */
export const SOCKET_EVENTS = {
  // Cliente -> Servidor
  SET_USER: 'set_user',
  JOIN_CHAT: 'join_chat',
  LEAVE_CHAT: 'leave_chat',
  SEND_MESSAGE: 'send_message',

  // Servidor -> Cliente
  NEW_MESSAGE: 'new_message',
  USERS_ONLINE: 'users_online',
} as const
