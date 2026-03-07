const EVENTS = require('../config/socket.events');
const {
  getOrCreateChat,
  saveMessage,
  getMessageHistory,
  toggleReaction,
  editMessage,
  markChatAsRead,
  pinMessage,
  unpinMessage,
} = require('../services/chatService');
const { User } = require('../models');

const connectedUsers = new Map();
const chatPresence = new Map();

function emitChatPresence(io, chatId) {
  const set = chatPresence.get(chatId);
  const userIds = set ? Array.from(set) : [];
  io.to(`chat:${chatId}`).emit(EVENTS.CHAT_PRESENCE, { chatId, userIds });
}

async function getVisibleOnlineUsers() {
  const list = Array.from(connectedUsers.values());
  const userIds = [...new Set(list.map((u) => u.userId).filter(Boolean))];
  if (userIds.length === 0) return list;
  const mongoose = require('mongoose');
  const users = await User.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
    .select('visibility')
    .lean();
  const visibilityByUserId = Object.fromEntries(users.map((u) => [u._id.toString(), u.visibility || 'visible']));
  return list.filter((u) => !u.userId || visibilityByUserId[u.userId] === 'visible');
}

function generateMessageId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
    } catch {}
    s.emit(EVENTS.NEW_MESSAGE, message);
  }
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id, socket.data.userId);
    const userId = socket.data.userId;
    if (userId) socket.join(`user:${userId}`);
    connectedUsers.set(socket.id, {
      userId: socket.data.userId,
      userName: socket.data.userName,
    });
    getVisibleOnlineUsers().then((visible) => io.emit(EVENTS.USERS_ONLINE, visible));

    socket.on(EVENTS.REFRESH_ONLINE_LIST, () => {
      getVisibleOnlineUsers().then((visible) => io.emit(EVENTS.USERS_ONLINE, visible));
    });

    socket.on(EVENTS.JOIN_CHAT, async (chatId) => {
      const currentUserId = socket.data.userId || null;
      const prevChatId = socket.data.currentChatId;
      if (prevChatId && prevChatId !== chatId) {
        const prevSet = chatPresence.get(prevChatId);
        if (prevSet && currentUserId) {
          prevSet.delete(currentUserId);
          if (prevSet.size === 0) chatPresence.delete(prevChatId);
          emitChatPresence(io, prevChatId);
        }
      }
      if (currentUserId) {
        if (!chatPresence.has(chatId)) chatPresence.set(chatId, new Set());
        chatPresence.get(chatId).add(currentUserId);
      }
      socket.data.currentChatId = chatId;
      socket.join(`chat:${chatId}`);
      try {
        const history = await getMessageHistory(chatId, 100, currentUserId);
        socket.emit(EVENTS.CHAT_HISTORY, { chatId, messages: history });
        if (currentUserId) {
          await markChatAsRead(chatId, currentUserId);
          const roomName = `chat:${chatId}`;
          const updatedList = await getMessageHistory(chatId, 200, null);
          for (const payload of updatedList) {
            io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, { ...payload, chatId });
          }
        }
        emitChatPresence(io, chatId);
      } catch (err) {
        console.error('Error loading chat history:', err);
        emitChatPresence(io, chatId);
      }
    });

    socket.on(EVENTS.JOIN_CHAT_ROOMS, (chatIds) => {
      const ids = Array.isArray(chatIds) ? chatIds : [chatIds];
      ids.forEach((id) => id && socket.join(`chat:${id}`));
    });

    socket.on(EVENTS.LEAVE_CHAT, (chatId) => {
      const currentUserId = socket.data.userId;
      if (socket.data.currentChatId === chatId) socket.data.currentChatId = null;
      const set = chatPresence.get(chatId);
      if (set && currentUserId) {
        set.delete(currentUserId);
        if (set.size === 0) chatPresence.delete(chatId);
        emitChatPresence(io, chatId);
      }
      socket.leave(`chat:${chatId}`);
    });

    socket.on(EVENTS.MARK_CHAT_READ, async (chatId) => {
      const currentUserId = socket.data.userId || null;
      if (!chatId || !currentUserId) return;
      try {
        await markChatAsRead(chatId, currentUserId);
        const roomName = `chat:${chatId}`;
        const updatedList = await getMessageHistory(chatId, 200, null);
        for (const payload of updatedList) {
          io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, { ...payload, chatId });
        }
      } catch (err) {
        console.error('Error marking chat as read:', err);
      }
    });

    socket.on(EVENTS.NOTIFY_MESSAGE_DELETED, (payload) => {
      const { messageId, chatId } = payload || {};
      if (messageId && chatId) {
        io.to(`chat:${chatId}`).emit(EVENTS.MESSAGE_DELETED, { messageId, chatId });
      }
    });

    socket.on(EVENTS.VIDEO_CALL_OFFER, async (payload) => {
      const { chatId, roomName, callerId, callerName, callerAvatar } = payload || {};
      const currentUserId = socket.data.userId;
      if (!chatId || !roomName || !callerId || !callerName || currentUserId !== callerId) return;
      try {
        const chat = await getOrCreateChat(chatId);
        if (!chat || !chat.participants || chat.participants.length === 0) return;
        const callerStr = String(callerId);
        const otherParticipants = chat.participants
          .map((p) => (p._id ? p._id.toString() : p.toString()))
          .filter((id) => id !== callerStr);
        for (const targetUserId of otherParticipants) {
          io.to(`user:${targetUserId}`).emit(EVENTS.VIDEO_CALL_INCOMING, {
            chatId,
            roomName,
            callerId,
            callerName,
            callerAvatar: callerAvatar || null,
          });
        }
      } catch (err) {
        console.error('Error video call offer:', err);
      }
    });

    socket.on(EVENTS.VIDEO_CALL_ANSWER, (payload) => {
      const { chatId, roomName, callerId } = payload || {};
      if (!callerId) return;
      io.to(`user:${callerId}`).emit(EVENTS.VIDEO_CALL_ACCEPTED, { chatId, roomName });
    });

    socket.on(EVENTS.VIDEO_CALL_REJECT, (payload) => {
      const { callerId } = payload || {};
      if (!callerId) return;
      io.to(`user:${callerId}`).emit(EVENTS.VIDEO_CALL_REJECTED, {});
    });

    socket.on(EVENTS.VIDEO_CALL_CANCEL, (payload) => {
      const { targetUserId } = payload || {};
      if (!targetUserId) return;
      io.to(`user:${targetUserId}`).emit(EVENTS.VIDEO_CALL_CANCELLED, {});
    });

    socket.on(EVENTS.SEND_MESSAGE, async (payload) => {
      const { chatId, text, type, imageUrl, stickerUrl, senderId, senderName } = payload;
      const userId = socket.data.userId ?? senderId;
      const userName = socket.data.userName ?? senderName ?? 'Anónimo';

      const roomName = `chat:${chatId}`;
      let message;

      const opts = {
        text: typeof text === 'string' ? text : (payload.text ?? ''),
        type: type || 'text',
        imageUrl: imageUrl || null,
        stickerUrl: stickerUrl || null,
      };

      try {
        const saved = await saveMessage(chatId, userId, userName, opts);
        message = saved || {
          id: generateMessageId(),
          chatId,
          text: opts.text,
          type: opts.type || 'text',
          imageUrl: opts.imageUrl ?? null,
          stickerUrl: opts.stickerUrl ?? null,
          reactions: [],
          senderId: userId,
          senderName: userName,
          senderAvatar: socket.data.userAvatar ?? null,
          timestamp: Date.now(),
        };
      } catch (err) {
        console.error('Error saving message:', err);
        message = {
          id: generateMessageId(),
          chatId,
          text: opts.text,
          type: opts.type || 'text',
          imageUrl: opts.imageUrl ?? null,
          stickerUrl: opts.stickerUrl ?? null,
          reactions: [],
          senderId: userId,
          senderName: userName,
          senderAvatar: socket.data.userAvatar ?? null,
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

    socket.on(EVENTS.REACT_TO_MESSAGE, async (payload) => {
      const { messageId, chatId, emoji } = payload;
      const userId = socket.data.userId;
      if (!userId || !messageId || !emoji) return;
      try {
        const updated = await toggleReaction(messageId, userId, String(emoji));
        if (updated) {
          const roomName = `chat:${updated.chatId || chatId}`;
          io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, updated);
        }
      } catch (err) {
        console.error('Error toggling reaction:', err);
      }
    });

    socket.on(EVENTS.EDIT_MESSAGE, async (payload) => {
      const { messageId, chatId, text } = payload;
      const userId = socket.data.userId;
      if (!userId || !messageId) return;
      try {
        const updated = await editMessage(messageId, userId, typeof text === 'string' ? text : '');
        if (updated) {
          const roomName = `chat:${updated.chatId || chatId}`;
          io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, updated);
        }
      } catch (err) {
        console.error('Error editing message:', err);
      }
    });

    socket.on(EVENTS.PIN_MESSAGE, async (payload) => {
      const { messageId, chatId } = payload;
      const userId = socket.data.userId;
      if (!userId || !messageId) return;
      try {
        const result = await pinMessage(messageId, userId);
        if (result) {
          const roomName = `chat:${result.pinned.chatId || chatId}`;
          io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, result.pinned);
          if (result.unpinned) io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, result.unpinned);
        }
      } catch (err) {
        console.error('Error pinning message:', err);
      }
    });

    socket.on(EVENTS.UNPIN_MESSAGE, async (payload) => {
      const { messageId, chatId } = payload;
      const userId = socket.data.userId;
      if (!userId || !messageId) return;
      try {
        const updated = await unpinMessage(messageId, userId);
        if (updated) {
          const roomName = `chat:${updated.chatId || chatId}`;
          io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, updated);
        }
      } catch (err) {
        console.error('Error unpinning message:', err);
      }
    });

    socket.on('disconnect', async () => {
      const userId = socket.data.userId;
      const currentChatId = socket.data.currentChatId;
      if (currentChatId && userId) {
        const set = chatPresence.get(currentChatId);
        if (set) {
          set.delete(userId);
          if (set.size === 0) chatPresence.delete(currentChatId);
          emitChatPresence(io, currentChatId);
        }
      }
      connectedUsers.delete(socket.id);
      if (userId) {
        try {
          await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
          io.emit(EVENTS.USER_LAST_SEEN_UPDATED, { userId, lastSeenAt: Date.now() });
        } catch (err) {
          console.error('Error updating lastSeen:', err);
        }
      }
      getVisibleOnlineUsers().then((visible) => io.emit(EVENTS.USERS_ONLINE, visible));
      console.log('Cliente desconectado:', socket.id);
    });
  });
}

module.exports = { registerSocketHandlers };
