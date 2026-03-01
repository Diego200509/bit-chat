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
 * Guarda un mensaje y devuelve el objeto para emitir.
 * opts: { text?, type?, imageUrl?, stickerUrl? } — type por defecto 'text'.
 */
async function saveMessage(chatId, senderId, senderName, opts = {}) {
  const text = typeof opts === 'string' ? opts : (opts.text ?? '');
  const type = (typeof opts === 'object' && opts.type) || 'text';
  const imageUrl = (typeof opts === 'object' && opts.imageUrl) || null;
  const stickerUrl = (typeof opts === 'object' && opts.stickerUrl) || null;

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
    text: text || '',
    type: ['text', 'image', 'sticker', 'emoji'].includes(type) ? type : 'text',
    imageUrl: type === 'image' ? imageUrl : null,
    stickerUrl: type === 'sticker' ? stickerUrl : null,
  });

  const resolvedChatId = (chatId === 'chat-1' || chatId === 'general') ? chatId : chat._id.toString();
  return messageToPayload(msg, resolvedChatId, name);
}

function messageToPayload(msg, resolvedChatId, senderDisplayName) {
  const senderId = msg.sender ? msg.sender.toString() : null;
  const type = (msg.type && ['text', 'image', 'sticker', 'emoji'].includes(msg.type)) ? msg.type : 'text';
  const stickerUrl = msg.stickerUrl != null && String(msg.stickerUrl).trim() ? String(msg.stickerUrl).trim() : null;
  const imageUrl = msg.imageUrl != null && String(msg.imageUrl).trim() ? String(msg.imageUrl).trim() : null;
  return {
    id: msg._id.toString(),
    chatId: resolvedChatId,
    text: msg.text || '',
    type,
    imageUrl,
    stickerUrl,
    reactions: (msg.reactions || []).map((r) => ({ userId: r.userId.toString(), emoji: r.emoji })),
    senderId,
    senderName: senderDisplayName ?? msg.senderName ?? 'Anónimo',
    timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
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
    text: m.text || '',
    type: m.type || 'text',
    imageUrl: m.imageUrl || null,
    stickerUrl: m.stickerUrl || null,
    reactions: (m.reactions || []).map((r) => ({ userId: r.userId.toString(), emoji: r.emoji })),
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
      lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? 'Imagen' : lastMsg?.type === 'sticker' ? 'Sticker' : ''),
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
      lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? 'Imagen' : lastMsg?.type === 'sticker' ? 'Sticker' : ''),
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
      lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? 'Imagen' : lastMsg?.type === 'sticker' ? 'Sticker' : ''),
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

/**
 * Añade o quita una reacción de un mensaje. Devuelve el mensaje actualizado para emitir.
 */
async function toggleReaction(messageId, userId, emoji) {
  if (!messageId || !userId || !emoji || typeof emoji !== 'string') return null;
  const msg = await Message.findById(messageId);
  if (!msg) return null;
  const userObjId = new mongoose.Types.ObjectId(userId);
  const reactions = (msg.reactions || []).filter((r) => r.userId);
  const idx = reactions.findIndex((r) => r.userId.toString() === userId && r.emoji === emoji);
  if (idx >= 0) {
    reactions.splice(idx, 1);
  } else {
    reactions.push({ userId: userObjId, emoji: emoji.trim().slice(0, 32) });
  }
  msg.reactions = reactions;
  await msg.save();
  const resolvedChatId = msg.chat.toString();
  let senderName = msg.senderName || 'Anónimo';
  if (msg.sender) {
    const u = await User.findById(msg.sender).select('name nickname').lean();
    senderName = u ? (u.nickname?.trim() || u.name) : senderName;
  }
  return messageToPayload(msg, resolvedChatId, senderName);
}

module.exports = { getOrCreateChat, getOrCreateDirectChat, getChatsForUser, createGroupChat, saveMessage, getMessageHistory, toggleReaction };