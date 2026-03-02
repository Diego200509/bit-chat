const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { Chat } = require('../models');
const { getOrCreateDirectChat, getChatsForUser, createGroupChat, clearChatForMe } = require('../services/chatService');

const router = express.Router();
router.use(authMiddleware);

/** GET /chats - Lista mis chats (General + directos + grupos). Incluye isBlocked, isPinned, isArchived. */
router.get('/', async (req, res) => {
  try {
    const list = await getChatsForUser(req.userId);
    const { User } = require('../models');
    const me = await User.findById(req.userId).select('blockedUsers').lean();
    const blockedIds = new Set((me?.blockedUsers || []).map((b) => b.toString()));
    const withBlocked = list.map((item) => {
      if (item.type === 'direct' && item.otherUserId) {
        return { ...item, isBlocked: blockedIds.has(item.otherUserId) };
      }
      return item;
    });
    return res.json(withBlocked);
  } catch (err) {
    console.error('List chats error:', err);
    res.status(500).json({ error: 'Error al listar chats' });
  }
});

/** POST /chats/direct - Obtener o crear chat directo. Body: { otherUserId } */
router.post('/direct', async (req, res) => {
  try {
    const { otherUserId } = req.body || {};
    if (!otherUserId || otherUserId === req.userId) {
      return res.status(400).json({ error: 'otherUserId inválido' });
    }
    const chat = await getOrCreateDirectChat(req.userId, otherUserId);
    const populated = await Chat.findById(chat._id).populate('participants', 'name nickname avatar').lean();
    const other = populated?.participants?.find((p) => p._id.toString() !== req.userId);
    const displayName = other ? (other.nickname?.trim() || other.name) : 'Usuario';
    return res.json({
      id: chat._id.toString(),
      name: displayName,
      type: 'direct',
      otherUserId: other?._id?.toString(),
    });
  } catch (err) {
    console.error('Direct chat error:', err);
    res.status(500).json({ error: 'Error al abrir chat' });
  }
});

/** POST /chats/group - Crear grupo. Body: { name, image?, participantIds: string[] } */
router.post('/group', async (req, res) => {
  try {
    const { name, image, participantIds } = req.body || {};
    const ids = Array.isArray(participantIds) ? participantIds.filter((id) => id && id !== req.userId) : [];
    const chat = await createGroupChat(req.userId, name || 'Grupo', ids, image || null);
    return res.status(201).json({
      id: chat._id.toString(),
      name: chat.name || 'Grupo',
      type: 'group',
      image: chat.image,
    });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Error al crear grupo' });
  }
});

function resolveChatId(id, userId) {
  if (id === 'chat-1') return Chat.findOne({ name: 'General', type: 'group' });
  return Chat.findOne({ _id: id, participants: userId });
}

/** POST /chats/:id/pin - Fijar chat para el usuario actual */
router.post('/:id/pin', async (req, res) => {
  try {
    const chat = await resolveChatId(req.params.id, req.userId);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    await Chat.findByIdAndUpdate(chat._id, { $addToSet: { pinnedBy: req.userId } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Pin chat error:', err);
    res.status(500).json({ error: 'Error al fijar' });
  }
});

/** POST /chats/:id/unpin - Quitar fijado */
router.post('/:id/unpin', async (req, res) => {
  try {
    const chat = await resolveChatId(req.params.id, req.userId);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    await Chat.findByIdAndUpdate(chat._id, { $pull: { pinnedBy: req.userId } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Unpin chat error:', err);
    res.status(500).json({ error: 'Error al quitar fijado' });
  }
});

/** POST /chats/:id/archive - Archivar chat para el usuario actual */
router.post('/:id/archive', async (req, res) => {
  try {
    const id = req.params.id === 'chat-1' ? null : req.params.id;
    const query = id ? { _id: id, participants: req.userId } : { name: 'General', type: 'group' };
    const chat = await Chat.findOne(query);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    await Chat.findByIdAndUpdate(chat._id, { $addToSet: { archivedBy: req.userId } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Archive chat error:', err);
    res.status(500).json({ error: 'Error al archivar' });
  }
});

/** POST /chats/:id/unarchive - Desarchivar */
router.post('/:id/unarchive', async (req, res) => {
  try {
    const id = req.params.id === 'chat-1' ? null : req.params.id;
    const query = id ? { _id: id } : { name: 'General', type: 'group' };
    const chat = await Chat.findOne(query);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    await Chat.findByIdAndUpdate(chat._id, { $pull: { archivedBy: req.userId } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Unarchive chat error:', err);
    res.status(500).json({ error: 'Error al desarchivar' });
  }
});

/** POST /chats/:id/clear - Borrar conversación para mí (soft delete de todos los mensajes para el usuario actual) */
router.post('/:id/clear', async (req, res) => {
  try {
    const chatId = req.params.id === 'chat-1' ? 'chat-1' : req.params.id;
    const result = await clearChatForMe(chatId, req.userId);
    if (!result) return res.status(404).json({ error: 'Chat no encontrado' });
    return res.json(result);
  } catch (err) {
    console.error('Clear chat error:', err);
    res.status(500).json({ error: 'Error al borrar conversación' });
  }
});

/** PATCH /chats/:id - Actualizar chat (p. ej. fondo). Body: { chatBackground?: string | null } */
router.patch('/:id', async (req, res) => {
  try {
    const chat = await resolveChatId(req.params.id, req.userId);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    const { chatBackground } = req.body || {};
    const update = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'chatBackground')) {
      update.chatBackground = typeof chatBackground === 'string' ? (chatBackground.trim() || null) : null;
    }
    if (Object.keys(update).length === 0) return res.json({ ok: true });
    await Chat.findByIdAndUpdate(chat._id, { $set: update });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Update chat error:', err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

module.exports = router;
