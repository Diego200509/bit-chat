const mongoose = require('mongoose');
const { Chat, Message, User } = require('../models');

/**
 * Obtiene un chat por id o crea el chat "General" si se pide por nombre.
 */
async function getOrCreateChat(chatId) {
  if (mongoose.Types.ObjectId.isValid(chatId) && new mongoose.Types.ObjectId(chatId).toString() === chatId) {
    const chat = await Chat.findById(chatId);
    return chat;
  }
  if (chatId === 'chat-1' || chatId === 'general') {
    let chat = await Chat.findOne({ name: 'General', type: 'group' });
    if (!chat) {
      chat = await Chat.create({ name: 'General', type: 'group', participants: [] });
    }
    return chat;
  }
  return null;
}

/**
 * Guarda un mensaje y devuelve el objeto para emitir (con id, chatId, senderId, senderName, etc.).
 */
async function saveMessage(chatId, senderId, senderName, text) {
  const chat = await getOrCreateChat(chatId);
  if (!chat) return null;

  const isObjectId = mongoose.Types.ObjectId.isValid(senderId) && new mongoose.Types.ObjectId(senderId).toString() === senderId;
  let senderObjectId = null;
  let name = senderName || 'Anónimo';
  if (isObjectId) {
    const user = await User.findById(senderId).select('name nickname');
    if (user) {
      senderObjectId = user._id;
      name = user.nickname?.trim() || user.name;
    }
  }

  const msg = await Message.create({
    chat: chat._id,
    sender: senderObjectId || null,
    senderName: senderObjectId ? null : name,
    text,
    type: 'text',
  });

  return {
    id: msg._id.toString(),
    chatId: chat._id.toString(),
    text: msg.text,
    senderId: senderObjectId ? senderObjectId.toString() : senderId,
    senderName: name,
    timestamp: msg.createdAt.getTime(),
  };
}

/**
 * Historial de mensajes de un chat (para cargar al abrir).
 * Si currentUserId se pasa, se ocultan mensajes de usuarios que ese usuario tiene bloqueados.
 */
async function getMessageHistory(chatId, limit = 100, currentUserId = null) {
  const chat = await getOrCreateChat(chatId);
  if (!chat) return [];

  let messages = await Message.find({ chat: chat._id })
    .sort({ createdAt: 1 })
    .limit(limit * 2)
    .populate('sender', 'name nickname')
    .lean();

  if (currentUserId) {
    const me = await User.findById(currentUserId).select('blockedUsers').lean();
    const blockedIds = new Set((me?.blockedUsers || []).map((b) => b.toString()));
    messages = messages.filter((m) => {
      const senderId = m.sender?._id?.toString() || null;
      return !senderId || !blockedIds.has(senderId);
    });
    messages = messages.slice(-limit);
  }

  const resolvedChatId = (chatId === 'chat-1' || chatId === 'general') ? chatId : chat._id.toString();
  return messages.map((m) => ({
    id: m._id.toString(),
    chatId: resolvedChatId,
    text: m.text,
    senderId: m.sender ? m.sender._id.toString() : null,
    senderName: m.sender ? (m.sender.nickname?.trim() || m.sender.name) : (m.senderName || 'Anónimo'),
    timestamp: new Date(m.createdAt).getTime(),
  }));
}

/**
 * Obtiene o crea un chat directo entre dos usuarios (solo si son amigos si quieres; por ahora sin restricción).
 */
async function getOrCreateDirectChat(userId1, userId2) {
  const id1 = new mongoose.Types.ObjectId(userId1);
  const id2 = new mongoose.Types.ObjectId(userId2);
  let chat = await Chat.findOne({
    type: 'direct',
    participants: { $all: [id1, id2], $size: 2 },
  });
  if (!chat) {
    chat = await Chat.create({
      type: 'direct',
      participants: [id1, id2],
    });
  }
  return chat;
}

/**
 * Lista chats del usuario: General + directos + grupos. Incluye isPinned, isArchived.
 */
async function getChatsForUser(userId, limit = 50) {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const { Message } = require('../models');
  const list = [];

  const general = await Chat.findOne({ name: 'General', type: 'group' }).lean();
  if (general) {
    const lastMsg = await Message.findOne({ chat: general._id }).sort({ createdAt: -1 }).lean();
    const pinned = (general.pinnedBy || []).some((id) => id.toString() === userId);
    const archived = (general.archivedBy || []).some((id) => id.toString() === userId);
    list.push({
      id: 'chat-1',
      name: 'General',
      type: 'group',
      image: general.image,
      isPinned: pinned,
      isArchived: archived,
      lastMessage: lastMsg?.text,
      lastMessageTime: lastMsg ? new Date(lastMsg.createdAt).getTime() : (general.updatedAt ? new Date(general.updatedAt).getTime() : null),
    });
  }

  const directChats = await Chat.find({ type: 'direct', participants: userObjId })
    .populate('participants', 'name nickname avatar')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  for (const c of directChats) {
    const other = c.participants?.find((p) => p._id.toString() !== userId);
    const displayName = other ? (other.nickname?.trim() || other.name) : 'Usuario';
    const lastMsg = await Message.findOne({ chat: c._id }).sort({ createdAt: -1 }).lean();
    const pinned = (c.pinnedBy || []).some((id) => id.toString() === userId);
    const archived = (c.archivedBy || []).some((id) => id.toString() === userId);
    list.push({
      id: c._id.toString(),
      name: displayName,
      type: 'direct',
      otherUserId: other?._id?.toString(),
      isPinned: pinned,
      isArchived: archived,
      lastMessage: lastMsg?.text,
      lastMessageTime: lastMsg ? new Date(lastMsg.createdAt).getTime() : new Date(c.updatedAt).getTime(),
    });
  }

  const groupChats = await Chat.find({ type: 'group', participants: userObjId, name: { $ne: 'General' } })
    .populate('participants', 'name nickname avatar')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  for (const c of groupChats) {
    const lastMsg = await Message.findOne({ chat: c._id }).sort({ createdAt: -1 }).lean();
    const pinned = (c.pinnedBy || []).some((id) => id.toString() === userId);
    const archived = (c.archivedBy || []).some((id) => id.toString() === userId);
    list.push({
      id: c._id.toString(),
      name: c.name || 'Grupo',
      type: 'group',
      image: c.image,
      isPinned: pinned,
      isArchived: archived,
      lastMessage: lastMsg?.text,
      lastMessageTime: lastMsg ? new Date(lastMsg.createdAt).getTime() : new Date(c.updatedAt).getTime(),
    });
  }

  list.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
  });
  return list;
}

/**
 * Crea un chat de tipo grupo.
 */
async function createGroupChat(creatorId, name, participantIds = [], image = null) {
  const allIds = [new mongoose.Types.ObjectId(creatorId), ...participantIds.map((id) => new mongoose.Types.ObjectId(id))];
  const uniqueIds = [...new Set(allIds.map((id) => id.toString()))].map((id) => new mongoose.Types.ObjectId(id));
  const chat = await Chat.create({
    type: 'group',
    name: name || 'Grupo',
    image: image || null,
    participants: uniqueIds,
    createdBy: creatorId,
  });
  return chat;
}

module.exports = { getOrCreateChat, getOrCreateDirectChat, getChatsForUser, createGroupChat, saveMessage, getMessageHistory };