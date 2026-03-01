const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { Chat } = require('../models');
const { getOrCreateDirectChat, getChatsForUser } = require('../services/chatService');

const router = express.Router();
router.use(authMiddleware);

/** GET /chats - Lista mis chats (General + directos). Incluye isBlocked en directos. */
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
    const populated = await Chat.findById(chat._id).populate('participants', 'name avatar').lean();
    const other = populated?.participants?.find((p) => p._id.toString() !== req.userId);
    return res.json({
      id: chat._id.toString(),
      name: other?.name || 'Usuario',
      type: 'direct',
      otherUserId: other?._id?.toString(),
    });
  } catch (err) {
    console.error('Direct chat error:', err);
    res.status(500).json({ error: 'Error al abrir chat' });
  }
});

module.exports = router;
