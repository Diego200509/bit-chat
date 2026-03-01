const EVENTS = require('../config/socket.events');
const { getOrCreateChat, saveMessage, getMessageHistory } = require('../services/chatService');
const { User } = require('../models');

/** Usuarios conectados: socketId -> { userId, userName } */
const connectedUsers = new Map();

function generateMessageId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Emite new_message solo a los sockets de la sala que NO tienen bloqueado al sender.
 * En chats directos: quien te tiene bloqueado no recibe tu mensaje.
 */
async function emitMessageToRoomExceptBlocking(io, roomName, message, senderId) {
  const sockets = await io.in(roomName).fetchSockets();
  const senderIdStr = String(senderId);
  for (const s of sockets) {
    const recipientId = s.data.userId;
    if (!recipientId) {
      s.emit(EVENTS.NEW_MESSAGE, message);
      continue;
    }
    try {
      const user = await User.findById(recipientId).select('blockedUsers').lean();
      const blocked = (user?.blockedUsers || []).map((b) => b.toString());
      if (blocked.includes(senderIdStr)) continue;
    } catch {
      // si falla la consulta, enviamos por si acaso
    }
    s.emit(EVENTS.NEW_MESSAGE, message);
  }
}

/**
 * Registra todos los manejadores de Socket.io sobre una instancia de io.
 * @param {import('socket.io').Server} io
 */
function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id, socket.data.userId);
    connectedUsers.set(socket.id, {
      userId: socket.data.userId,
      userName: socket.data.userName,
    });
    io.emit(EVENTS.USERS_ONLINE, Array.from(connectedUsers.values()));

    socket.on(EVENTS.JOIN_CHAT, async (chatId) => {
      socket.join(`chat:${chatId}`);
      try {
        const currentUserId = socket.data.userId || null;
        const history = await getMessageHistory(chatId, 100, currentUserId);
        socket.emit(EVENTS.CHAT_HISTORY, { chatId, messages: history });
      } catch (err) {
        console.error('Error loading chat history:', err);
      }
    });

    socket.on(EVENTS.LEAVE_CHAT, (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on(EVENTS.SEND_MESSAGE, async (payload) => {
      const { chatId, text, senderId, senderName } = payload;
      const userId = socket.data.userId ?? senderId;
      const userName = socket.data.userName ?? senderName ?? 'Anónimo';

      const roomName = `chat:${chatId}`;
      let message;

      try {
        const saved = await saveMessage(chatId, userId, userName, text);
        message = saved || {
          id: generateMessageId(),
          chatId,
          text,
          senderId: userId,
          senderName: userName,
          timestamp: Date.now(),
        };
      } catch (err) {
        console.error('Error saving message:', err);
        message = {
          id: generateMessageId(),
          chatId,
          text,
          senderId: userId,
          senderName: userName,
          timestamp: Date.now(),
        };
      }

      try {
        const chat = await getOrCreateChat(chatId);
        if (chat && chat.type === 'direct') {
          await emitMessageToRoomExceptBlocking(io, roomName, message, userId);
        } else {
          io.to(roomName).emit(EVENTS.NEW_MESSAGE, message);
        }
      } catch (err) {
        console.error('Error emitting message:', err);
        io.to(roomName).emit(EVENTS.NEW_MESSAGE, message);
      }
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
      io.emit(EVENTS.USERS_ONLINE, Array.from(connectedUsers.values()));
      console.log('Cliente desconectado:', socket.id);
    });
  });
}

module.exports = { registerSocketHandlers };
