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
    const user = await User.findById(senderId).select('name');
    if (user) {
      senderObjectId = user._id;
      name = user.name;
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
 */
async function getMessageHistory(chatId, limit = 100) {
  const chat = await getOrCreateChat(chatId);
  if (!chat) return [];

  const messages = await Message.find({ chat: chat._id })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('sender', 'name')
    .lean();

  const resolvedChatId = (chatId === 'chat-1' || chatId === 'general') ? chatId : chat._id.toString();
  return messages.map((m) => ({
    id: m._id.toString(),
    chatId: resolvedChatId,
    text: m.text,
    senderId: m.sender ? m.sender._id.toString() : null,
    senderName: m.sender ? m.sender.name : (m.senderName || 'Anónimo'),
    timestamp: new Date(m.createdAt).getTime(),
  }));
}

module.exports = { getOrCreateChat, saveMessage, getMessageHistory };