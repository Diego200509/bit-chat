const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { Conversation } = require('../models');
const EVENTS = require('../config/socket.events');
const {
  getOrCreateDirectConversation,
  getConversationsForUser,
  createGroupConversation,
  clearConversationForMe,
  addParticipantToGroup,
  removeParticipantFromGroup,
} = require('../services/conversationService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const list = await getConversationsForUser(req.userId);
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
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Error al listar conversaciones' });
  }
});

router.post('/direct', async (req, res) => {
  try {
    const { otherUserId } = req.body || {};
    if (!otherUserId || otherUserId === req.userId) {
      return res.status(400).json({ error: 'otherUserId inválido' });
    }
    const conv = await getOrCreateDirectConversation(req.userId, otherUserId);
    const populated = await Conversation.findById(conv._id).populate('participants', 'name nickname avatar').lean();
    const other = populated?.participants?.find((p) => p._id.toString() !== req.userId);
    const displayName = other ? (other.nickname?.trim() || other.name) : 'Usuario';
    return res.json({
      id: conv._id.toString(),
      name: displayName,
      type: 'direct',
      otherUserId: other?._id?.toString(),
    });
  } catch (err) {
    console.error('Direct conversation error:', err);
    res.status(500).json({ error: 'Error al abrir conversación' });
  }
});

router.post('/group', async (req, res) => {
  try {
    const { name, image, participantIds } = req.body || {};
    const ids = Array.isArray(participantIds) ? participantIds.filter((id) => id && id !== req.userId) : [];
    const conv = await createGroupConversation(req.userId, name || 'Grupo', ids, image || null);
    return res.status(201).json({
      id: conv._id.toString(),
      name: conv.name || 'Grupo',
      type: 'group',
      image: conv.image,
    });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Error al crear grupo' });
  }
});

function resolveConversationId(id, userId) {
  return Conversation.findOne({ _id: id, participants: userId });
}

router.post('/:id/mute', async (req, res) => {
  try {
    const conv = await resolveConversationId(req.params.id, req.userId);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
    await Conversation.findByIdAndUpdate(conv._id, { $addToSet: { mutedBy: req.userId } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Mute conversation error:', err);
    res.status(500).json({ error: 'Error al silenciar' });
  }
});

router.post('/:id/unmute', async (req, res) => {
  try {
    const conv = await resolveConversationId(req.params.id, req.userId);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
    await Conversation.findByIdAndUpdate(conv._id, { $pull: { mutedBy: req.userId } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Unmute conversation error:', err);
    res.status(500).json({ error: 'Error al activar sonido' });
  }
});

router.post('/:id/clear', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const result = await clearConversationForMe(conversationId, req.userId);
    if (!result) return res.status(404).json({ error: 'Conversación no encontrada' });
    return res.json(result);
  } catch (err) {
    console.error('Clear conversation error:', err);
    res.status(500).json({ error: 'Error al borrar conversación' });
  }
});

function emitConversationUpdated(req, userIdToNotify) {
  try {
    const io = req.app.get('io');
    if (!io) return;
    const roomId = req.params.id;
    io.to(`chat:${roomId}`).emit(EVENTS.CONVERSATION_UPDATED, { conversationId: roomId });
    if (userIdToNotify) io.to(`user:${userIdToNotify}`).emit(EVENTS.CONVERSATION_UPDATED, { conversationId: roomId });
  } catch (e) {
    console.error('Emit conversation_updated:', e);
  }
}

router.post('/:id/participants', async (req, res) => {
  try {
    const conv = await resolveConversationId(req.params.id, req.userId);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId es requerido' });
    const result = await addParticipantToGroup(conv._id.toString(), userId, req.userId);
    if (result.error) {
      if (result.error.includes('administrador') || result.error.includes('No es un grupo')) return res.status(403).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }
    emitConversationUpdated(req, userId);
    return res.json(result);
  } catch (err) {
    console.error('Add participant error:', err);
    res.status(500).json({ error: 'Error al añadir participante' });
  }
});

router.delete('/:id/participants/:userId', async (req, res) => {
  try {
    const conv = await resolveConversationId(req.params.id, req.userId);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
    const removedUserId = req.params.userId;
    const result = await removeParticipantFromGroup(conv._id.toString(), removedUserId, req.userId);
    if (result.error) {
      if (result.error.includes('administrador') || result.error.includes('No es un grupo')) return res.status(403).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }
    emitConversationUpdated(req, removedUserId);
    return res.json(result);
  } catch (err) {
    console.error('Remove participant error:', err);
    res.status(500).json({ error: 'Error al eliminar participante' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const conv = await resolveConversationId(req.params.id, req.userId);
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
    if (conv.type !== 'group') return res.status(400).json({ error: 'Solo se puede actualizar un grupo' });
    const adminIds = (conv.adminIds && conv.adminIds.length > 0)
      ? conv.adminIds.map((id) => id.toString())
      : (conv.createdBy ? [conv.createdBy.toString()] : []);
    if (!adminIds.includes(req.userId)) return res.status(403).json({ error: 'Solo un administrador puede actualizar el grupo' });
    const { name, image } = req.body || {};
    const update = {};
    if (typeof name === 'string') update.name = name.trim() || conv.name;
    if (Object.prototype.hasOwnProperty.call(req.body, 'image')) {
      update.image = typeof image === 'string' && image.trim() ? image.trim() : null;
    }
    if (Object.keys(update).length === 0) return res.json({ name: conv.name, image: conv.image });
    const updated = await Conversation.findByIdAndUpdate(conv._id, { $set: update }, { new: true }).lean();
    emitConversationUpdated(req);
    return res.json({ name: updated.name, image: updated.image });
  } catch (err) {
    console.error('Update group error:', err);
    res.status(500).json({ error: 'Error al actualizar grupo' });
  }
});

module.exports = router;
