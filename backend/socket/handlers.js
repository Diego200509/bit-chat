const EVENTS = require('../config/socket.events');
const {
  getOrCreateConversation,
  saveMessage,
  getMessageHistory,
  fetchAndAttachLinkPreview,
  markConversationAsRead,
  markMessageDelivered,
  markAllConversationsDeliveredForUser,
} = require('../services/conversationService');
const { User } = require('../models');

const connectedUsers = new Map();
const chatPresence = new Map();

function emitChatPresence(io, chatId) {
  const set = chatPresence.get(chatId);
  const userIds = set ? Array.from(set) : [];
  io.to(`chat:${chatId}`).emit(EVENTS.CONVERSATION_PRESENCE, { chatId, userIds });
}

async function getVisibleOnlineUsers() {
  return Array.from(connectedUsers.values());
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

async function emitToRoomExceptRemoved(io, roomName, event, payload, removedParticipantIds) {
  const removedSet = new Set((removedParticipantIds || []).map((id) => id.toString()));
  const sockets = await io.in(roomName).fetchSockets();
  for (const s of sockets) {
    const uid = s.data.userId;
    if (uid && removedSet.has(String(uid))) continue;
    s.emit(event, payload);
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

    if (userId) {
      markAllConversationsDeliveredForUser(userId)
        .then((payloads) => {
          for (const payload of payloads) {
            const roomName = payload.chatId ? `chat:${payload.chatId}` : null;
            if (roomName) io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, payload);
          }
        })
        .catch((err) => console.error('Error marking conversations delivered:', err));
    }

    socket.on(EVENTS.REFRESH_ONLINE_LIST, () => {
      getVisibleOnlineUsers().then((visible) => io.emit(EVENTS.USERS_ONLINE, visible));
    });

    socket.on(EVENTS.JOIN_CONVERSATION, async (chatId) => {
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
      let addToPresence = !!currentUserId;
      if (currentUserId) {
        const conv = await getOrCreateConversation(chatId);
        if (conv?.type === 'group') {
          const removed = (conv.removedParticipantIds || []).map((id) => id.toString());
          if (removed.includes(currentUserId)) addToPresence = false;
        }
        if (addToPresence) {
          if (!chatPresence.has(chatId)) chatPresence.set(chatId, new Set());
          chatPresence.get(chatId).add(currentUserId);
        }
      }
      socket.data.currentChatId = chatId;
      socket.join(`chat:${chatId}`);
      try {
        const history = await getMessageHistory(chatId, 100, currentUserId);
        socket.emit(EVENTS.CONVERSATION_HISTORY, { chatId, messages: history });
        if (currentUserId) {
          await markConversationAsRead(chatId, currentUserId);
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

    socket.on(EVENTS.JOIN_CONVERSATION_ROOMS, (chatIds) => {
      const ids = Array.isArray(chatIds) ? chatIds : [chatIds];
      ids.forEach((id) => id && socket.join(`chat:${id}`));
    });

    socket.on(EVENTS.LEAVE_CONVERSATION, (chatId) => {
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

    socket.on(EVENTS.MARK_CONVERSATION_READ, async (chatId) => {
      const currentUserId = socket.data.userId || null;
      if (!chatId || !currentUserId) return;
      try {
        await markConversationAsRead(chatId, currentUserId);
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

    socket.on(EVENTS.USER_TYPING, async (payload) => {
      const conversationId = payload?.conversationId || payload?.chatId;
      const userId = socket.data.userId;
      const userName = socket.data.userName || 'Alguien';
      if (!conversationId || !userId) return;
      try {
        const conv = await getOrCreateConversation(conversationId);
        const removedIds = conv?.type === 'group' ? (conv.removedParticipantIds || []).map((id) => id.toString()) : [];
        const roomName = `chat:${conversationId}`;
        const payloadOut = { conversationId, userId, userName };
        if (removedIds.length > 0) {
          await emitToRoomExceptRemoved(io, roomName, EVENTS.USER_TYPING, payloadOut, removedIds);
        } else {
          socket.to(roomName).emit(EVENTS.USER_TYPING, payloadOut);
        }
      } catch (err) {
        socket.to(`chat:${conversationId}`).emit(EVENTS.USER_TYPING, { conversationId, userId, userName });
      }
    });

    socket.on(EVENTS.USER_STOPPED_TYPING, async (payload) => {
      const conversationId = payload?.conversationId || payload?.chatId;
      const userId = socket.data.userId;
      const userName = socket.data.userName || 'Alguien';
      if (!conversationId || !userId) return;
      try {
        const conv = await getOrCreateConversation(conversationId);
        const removedIds = conv?.type === 'group' ? (conv.removedParticipantIds || []).map((id) => id.toString()) : [];
        const roomName = `chat:${conversationId}`;
        const payloadOut = { conversationId, userId, userName };
        if (removedIds.length > 0) {
          await emitToRoomExceptRemoved(io, roomName, EVENTS.USER_STOPPED_TYPING, payloadOut, removedIds);
        } else {
          socket.to(roomName).emit(EVENTS.USER_STOPPED_TYPING, payloadOut);
        }
      } catch (err) {
        socket.to(`chat:${conversationId}`).emit(EVENTS.USER_STOPPED_TYPING, { conversationId, userId, userName });
      }
    });

    socket.on(EVENTS.VIDEO_CALL_OFFER, async (payload) => {
      const { chatId, roomName, callerId, callerName, callerAvatar } = payload || {};
      const currentUserId = socket.data.userId;
      if (!chatId || !roomName || !callerId || !callerName || currentUserId !== callerId) return;
      try {
        const conv = await getOrCreateConversation(chatId);
        if (!conv || !conv.participants || conv.participants.length === 0) return;
        const callerStr = String(callerId);
        const otherParticipants = conv.participants
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
      const { chatId, text, type, imageUrl, stickerUrl, documentUrl, voiceUrl, senderId, senderName } = payload;
      const userId = socket.data.userId ?? senderId;
      const userName = socket.data.userName ?? senderName ?? 'Anónimo';

      const roomName = `chat:${chatId}`;
      let message;
      let saved = null;

      const opts = {
        text: typeof text === 'string' ? text : (payload.text ?? ''),
        type: type || 'text',
        imageUrl: imageUrl || null,
        stickerUrl: stickerUrl || null,
        documentUrl: documentUrl || null,
        voiceUrl: voiceUrl || null,
      };

      try {
        saved = await saveMessage(chatId, userId, userName, opts);
        message = saved || {
          id: generateMessageId(),
          chatId,
          text: opts.text,
          type: opts.type || 'text',
          imageUrl: opts.imageUrl ?? null,
          stickerUrl: opts.stickerUrl ?? null,
          documentUrl: opts.documentUrl ?? null,
          voiceUrl: opts.voiceUrl ?? null,
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
          documentUrl: opts.documentUrl ?? null,
          voiceUrl: opts.voiceUrl ?? null,
          reactions: [],
          senderId: userId,
          senderName: userName,
          senderAvatar: socket.data.userAvatar ?? null,
          timestamp: Date.now(),
        };
      }

      if (!saved) return;

      try {
        const conv = await getOrCreateConversation(chatId);
        const removedIds = conv?.type === 'group' ? (conv.removedParticipantIds || []).map((id) => id.toString()) : [];
        if (conv && conv.type === 'direct') {
          await emitMessageToRoomExceptBlocking(io, roomName, message, userId);
        } else if (removedIds.length > 0) {
          await emitToRoomExceptRemoved(io, roomName, EVENTS.NEW_MESSAGE, message, removedIds);
        } else {
          io.to(roomName).emit(EVENTS.NEW_MESSAGE, message);
        }
        if (conv?.participants?.length) {
          const participantIds = [...new Set(conv.participants.map((p) => String(p && p.toString ? p.toString() : p)))];
          for (const uid of participantIds) {
            io.to(`user:${uid}`).emit(EVENTS.CONVERSATION_UPDATED, { conversationId: chatId });
          }
        }
        if (saved && saved.id && opts.type === 'text' && opts.text && opts.text.trim()) {
          setImmediate(() => {
            fetchAndAttachLinkPreview(saved.id)
              .then((updated) => {
                if (updated) {
                  if (removedIds.length > 0) {
                    emitToRoomExceptRemoved(io, roomName, EVENTS.MESSAGE_UPDATED, updated, removedIds);
                  } else {
                    io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, updated);
                  }
                }
              })
              .catch(() => {});
          });
        }
      } catch (err) {
        console.error('Error emitting message:', err);
        io.to(roomName).emit(EVENTS.NEW_MESSAGE, message);
      }
    });

    socket.on(EVENTS.MESSAGE_DELIVERED, async (payload) => {
      const { messageId, chatId } = payload || {};
      const userId = socket.data.userId;
      if (!userId || !messageId) return;
      try {
        const updated = await markMessageDelivered(messageId, userId);
        if (updated) {
          const roomName = `chat:${updated.chatId || chatId}`;
          io.to(roomName).emit(EVENTS.MESSAGE_UPDATED, updated);
        }
      } catch (err) {
        console.error('Error marking message delivered:', err);
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
