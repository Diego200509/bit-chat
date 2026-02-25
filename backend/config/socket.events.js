/**
 * Nombres de eventos Socket.io (single source of truth).
 * Útil para evitar typos y para escalar a más eventos.
 */
module.exports = {
  // Cliente -> Servidor
  SET_USER: 'set_user',
  JOIN_CHAT: 'join_chat',
  LEAVE_CHAT: 'leave_chat',
  SEND_MESSAGE: 'send_message',

  // Servidor -> Cliente
  NEW_MESSAGE: 'new_message',
  USERS_ONLINE: 'users_online',
  CHAT_HISTORY: 'chat_history',
};
