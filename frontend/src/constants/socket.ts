/**
 * Nombres de eventos Socket.io (deben coincidir con el backend).
 * Un solo lugar para evitar typos y facilitar cambios.
 */
export const SOCKET_EVENTS = {
  // Cliente -> Servidor
  SET_USER: 'set_user',
  JOIN_CHAT: 'join_chat',
  JOIN_CHAT_ROOMS: 'join_chat_rooms',
  LEAVE_CHAT: 'leave_chat',
  SEND_MESSAGE: 'send_message',
  REACT_TO_MESSAGE: 'react_to_message',
  EDIT_MESSAGE: 'edit_message',
  PIN_MESSAGE: 'pin_message',
  UNPIN_MESSAGE: 'unpin_message',
  MARK_CHAT_READ: 'mark_chat_read',
  REFRESH_ONLINE_LIST: 'refresh_online_list',

  // Servidor -> Cliente
  NEW_MESSAGE: 'new_message',
  MESSAGE_UPDATED: 'message_updated',
  MESSAGE_DELETED: 'message_deleted',
  NOTIFY_MESSAGE_DELETED: 'notify_message_deleted',
  USERS_ONLINE: 'users_online',
  USER_LAST_SEEN_UPDATED: 'user_last_seen_updated',
  CHAT_PRESENCE: 'chat_presence',
  CHAT_HISTORY: 'chat_history',
} as const
