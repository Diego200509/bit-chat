const EVENTS = require('../config/socket.events');

/** Usuarios conectados: socketId -> { userId, userName } */
const connectedUsers = new Map();

function generateMessageId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Registra todos los manejadores de Socket.io sobre una instancia de io.
 * @param {import('socket.io').Server} io
 */
function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on(EVENTS.SET_USER, ({ userId, userName }) => {
      socket.data.userId = userId;
      socket.data.userName = userName || 'Anónimo';
      connectedUsers.set(socket.id, {
        userId: socket.data.userId,
        userName: socket.data.userName,
      });
      io.emit(EVENTS.USERS_ONLINE, Array.from(connectedUsers.values()));
    });

    socket.on(EVENTS.JOIN_CHAT, (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on(EVENTS.LEAVE_CHAT, (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on(EVENTS.SEND_MESSAGE, (payload) => {
      const { chatId, text, senderId, senderName } = payload;
      const userId = socket.data.userId ?? senderId;
      const userName = socket.data.userName ?? senderName ?? 'Anónimo';
      const message = {
        id: generateMessageId(),
        chatId,
        text,
        senderId: userId,
        senderName: userName,
        timestamp: Date.now(),
      };
      io.to(`chat:${chatId}`).emit(EVENTS.NEW_MESSAGE, message);
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
      io.emit(EVENTS.USERS_ONLINE, Array.from(connectedUsers.values()));
      console.log('Cliente desconectado:', socket.id);
    });
  });
}

module.exports = { registerSocketHandlers };
